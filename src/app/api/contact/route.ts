import { NextResponse } from 'next/server';
import { MIN_FILL_MS, normalise, validate } from '@/lib/contact/schema';
import { callerKey, checkRateLimit } from '@/lib/contact/rateLimit';

/**
 * The only server-side code on this site.
 *
 * It talks to PostgREST with `fetch` rather than `@supabase/supabase-js`,
 * because this is one POST to one table and the client library would add
 * roughly a hundred kilobytes to the function bundle to save four lines.
 *
 * The key it uses is the *anon* key, not the service role key. That is not a
 * shortcut - the anon key is exactly the right level of authority here, since
 * RLS restricts it to appending rows it can never read. A service role key
 * would give this endpoint the power to read every message ever sent, which it
 * has no reason to have. Do not "upgrade" it.
 */

export const runtime = 'nodejs';
// Nothing here is cacheable and everything here has side effects.
export const dynamic = 'force-dynamic';

type Outcome =
  | { ok: true }
  | { ok: false; reason: 'invalid'; errors: Record<string, string> }
  | { ok: false; reason: 'rate-limited'; retryAfter: number }
  | { ok: false; reason: 'unavailable' };

function json(body: Outcome, status: number, headers?: HeadersInit) {
  return NextResponse.json(body, { status, headers });
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, reason: 'invalid', errors: {} }, 400);
  }

  const body = (payload ?? {}) as Record<string, unknown>;

  // Honeypot. A field no human ever sees, so anything in it came from a bot
  // filling every input it found. Answer 200 and drop it on the floor -
  // telling a spammer they were caught only teaches them to adapt.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return json({ ok: true }, 200);
  }

  // Timing. Client-supplied and therefore forgeable - an attacker who reads
  // this file can send any number they like. It costs nothing and stops the
  // large majority of drive-by bots, which submit in double figures of
  // milliseconds and do not read source. Same silent success.
  //
  // It fails OPEN: a missing or unparseable value is accepted, not dropped.
  // The floor is a spam heuristic, and quietly binning a real person's message
  // because their clock or our own effect misbehaved is a far worse outcome
  // than letting one more bot through to the honeypot and the rate limiter.
  // `typeof`, not `Number(...)`: Number(null) is 0, which is finite and below
  // the floor, so coercing would silently bin every submission that arrived
  // without a measurement - the precise fail-closed behaviour this is meant to
  // avoid. Only an actual number is judged.
  if (
    typeof body.elapsedMs === 'number' &&
    Number.isFinite(body.elapsedMs) &&
    body.elapsedMs < MIN_FILL_MS
  ) {
    return json({ ok: true }, 200);
  }

  const draft = normalise({
    name: typeof body.name === 'string' ? body.name : '',
    email: typeof body.email === 'string' ? body.email : '',
    message: typeof body.message === 'string' ? body.message : '',
  });

  const errors = validate(draft);
  if (Object.keys(errors).length > 0) {
    return json(
      {
        ok: false,
        reason: 'invalid',
        errors: errors as Record<string, string>,
      },
      422,
    );
  }

  const limit = checkRateLimit(await callerKey(request));
  if (!limit.allowed) {
    return json(
      { ok: false, reason: 'rate-limited', retryAfter: limit.retryAfter },
      429,
      {
        'Retry-After': String(limit.retryAfter),
      },
    );
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  // Unconfigured is a normal state, not an error: the site is designed to ship
  // and run perfectly before Supabase exists. The client turns `unavailable`
  // into a mailto: link, so an unconfigured deployment is merely a site whose
  // contact form is a very elaborate email button.
  if (!url || !key) {
    return json({ ok: false, reason: 'unavailable' }, 503);
  }

  // A paused free project does not fail fast - it hangs. Without this the
  // visitor watches a spinner until the platform's own timeout, which is the
  // one failure mode the whole design is meant to avoid.
  const abort = AbortSignal.timeout(6000);

  try {
    const response = await fetch(`${url}/rest/v1/contacts`, {
      method: 'POST',
      signal: abort,
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
        // Explicit rather than required. PostgREST already defaults to
        // `return=minimal` for POST, so omitting this changes nothing today -
        // verified against the live project, where the header-less insert
        // returns 201 just the same. It is here because anon has no select
        // privilege, so asking for the row back is a 401, and the day someone
        // swaps this fetch for @supabase/supabase-js they inherit that client's
        // `return=representation` default and break the form. Stating the
        // requirement at the call site is cheaper than that afternoon.
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ ...draft, source: 'portfolio' }),
    });

    if (!response.ok) {
      // Deliberately not surfaced to the visitor. Whether this was a bad key,
      // a dropped policy or a paused project, their move is identical: email
      // instead. The detail belongs in the function logs.
      console.error(
        `[contact] insert failed: ${response.status} ${await response.text().catch(() => '')}`,
      );
      return json({ ok: false, reason: 'unavailable' }, 503);
    }

    return json({ ok: true }, 200);
  } catch (error) {
    console.error('[contact] insert threw:', error);
    return json({ ok: false, reason: 'unavailable' }, 503);
  }
}

/** Anything that is not a POST is a misunderstanding, not an error worth logging. */
export async function GET() {
  return NextResponse.json(
    { error: 'POST a contact submission to this endpoint.' },
    { status: 405, headers: { Allow: 'POST' } },
  );
}
