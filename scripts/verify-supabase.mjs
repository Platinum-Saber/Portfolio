/**
 * Phase 5 verification - run this against the real project.
 *
 *   npm run verify:supabase
 *
 * Reads SUPABASE_URL and SUPABASE_ANON_KEY from .env.local, then checks the
 * things that are easy to get subtly wrong and hard to notice: that the table
 * exists, that anon genuinely cannot read it back, that the column-level grant
 * blocks a forged timestamp, and that the CHECK constraints bite.
 *
 * Every row it writes is tagged so you can delete them all in one statement.
 * The SQL is printed at the end.
 *
 * Re-run it after any change to the migration, the keys, or the policies.
 */

import { readFileSync } from 'node:fs';

/**
 * A twelve-line .env reader, rather than `@next/env`.
 *
 * That package is only present here because `next` depends on it and npm
 * happens to hoist it - importing it directly is an undeclared dependency that
 * would vanish under pnpm, yarn PnP, or a different hoisting decision. This
 * script has one job and should not be the thing that breaks on a fresh clone.
 */
function readEnvFile(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return {};
  }
  const values = {};
  for (const line of raw.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match || line.trimStart().startsWith('#')) continue;
    // Strip one layer of matching quotes, then any trailing CR the editor left.
    values[match[1]] = match[2]
      .trim()
      .replace(/^(['"])(.*)\1$/, '$2')
      .replace(/\r$/, '');
  }
  return values;
}

// .env.local wins over .env, matching Next's own precedence. Anything already
// in the real environment wins over both, so CI can override without a file.
const fileEnv = { ...readEnvFile('.env'), ...readEnvFile('.env.local') };

const URL_ = process.env.SUPABASE_URL ?? fileEnv.SUPABASE_URL;
const KEY = process.env.SUPABASE_ANON_KEY ?? fileEnv.SUPABASE_ANON_KEY;

const C = process.stdout.isTTY
  ? { pass: '[32m', fail: '[31m', warn: '[33m', off: '[0m' }
  : { pass: '', fail: '', warn: '', off: '' };

const PASS = `${C.pass}PASS${C.off}`;
const FAIL = `${C.fail}FAIL${C.off}`;
const WARN = `${C.warn}WARN${C.off}`;

let failures = 0;

function report(verdict, title, detail) {
  if (verdict === FAIL) failures += 1;
  console.log(`${verdict}  ${title}`);
  if (detail) console.log(`      ${detail}`);
}

if (!URL_ || !KEY) {
  console.error(
    'SUPABASE_URL / SUPABASE_ANON_KEY are not set. Copy .env.example to .env.local and fill them in.',
  );
  process.exit(1);
}

// The anon key is a JWT and its payload says which role it carries. Catching a
// service_role key here is the single most valuable check in this file.
try {
  const payload = JSON.parse(
    Buffer.from(KEY.split('.')[1], 'base64url').toString(),
  );
  if (payload.role === 'anon') {
    report(PASS, 'The key is the anon key');
  } else {
    report(
      FAIL,
      `The key carries role "${payload.role}", not "anon"`,
      'A service_role key bypasses RLS entirely. Replace it with the anon public key before deploying.',
    );
  }
} catch {
  report(
    WARN,
    'Could not decode the key payload',
    'Is it really a Supabase JWT?',
  );
}

/** Every row this script writes carries it, so cleanup is one statement. */
const PROBE_SOURCE = 'verify-probe';

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

async function call(path, init = {}) {
  try {
    const response = await fetch(`${URL_}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(15000),
    });
    return { status: response.status, body: await response.text() };
  } catch (error) {
    return { status: 0, body: String(error) };
  }
}

// 1 - awake and reachable.
//
// Via public.healthcheck(), not GET /rest/v1/. Measured on this project, the
// root endpoint answers 401 to the anon key, which is indistinguishable from a
// wrong key or a paused project - and PostgREST may serve it from a cached
// schema without touching Postgres at all.
const started = Date.now();
const health = await call('/rest/v1/rpc/healthcheck', {
  method: 'POST',
  body: '{}',
});
if (health.status === 0) {
  report(FAIL, 'Project unreachable', health.body);
  console.log('\nNothing else can be checked. Stopping.');
  process.exit(1);
}
if (health.status === 200) {
  report(PASS, `healthcheck() responded (200 in ${Date.now() - started}ms)`);
} else if (health.status === 404) {
  report(
    WARN,
    'healthcheck() does not exist (404)',
    'Apply supabase/migrations/0002_healthcheck.sql. Until you do, the keep-alive workflow has nothing to call.',
  );
} else {
  report(
    FAIL,
    `healthcheck() returned ${health.status}`,
    'A paused project, a wrong URL and a missing grant all look like this.',
  );
}

// 2 - the table must NOT be readable by anon.
const read = await call('/rest/v1/contacts?limit=1');
if (
  read.status === 404 ||
  /does not exist|not find the table/i.test(read.body)
) {
  report(
    FAIL,
    'The contacts table does not exist',
    'Run supabase/migrations/0001_contacts.sql in the SQL Editor first.',
  );
} else if (read.status === 200) {
  report(
    FAIL,
    'anon CAN read the contacts table',
    'A SELECT policy exists that should not. Every message you receive would be public. Drop it.',
  );
} else {
  report(PASS, `anon cannot read the table (${read.status})`);
}

// 3 - the real insert, exactly as the API route performs it.
const marker = `SETUP-CHECK-${new Date().toISOString().slice(0, 19)}`;
const insert = await call('/rest/v1/contacts', {
  method: 'POST',
  headers: { Prefer: 'return=minimal' },
  body: JSON.stringify({
    name: marker,
    email: 'setup-check@example.com',
    message: 'Automated Phase 5 verification. Safe to delete.',
    source: PROBE_SOURCE,
  }),
});
report(
  insert.status === 201 ? PASS : FAIL,
  `Insert with Prefer: return=minimal (${insert.status})`,
  insert.status === 201 ? undefined : insert.body.slice(0, 200),
);

// 4 - asking PostgREST to hand the row back MUST fail, because anon has no
//     select privilege. This is the check that catches a SELECT policy
//     creeping in later.
//
//     An earlier version of this file tested the opposite thing - an insert
//     with no Prefer header at all - and expected it to fail. It does not.
//     PostgREST already defaults to `return=minimal` for POST, so omitting the
//     header changes nothing. That test wrote a junk row and taught nothing.
const representation = await call('/rest/v1/contacts', {
  method: 'POST',
  headers: { Prefer: 'return=representation' },
  body: JSON.stringify({
    name: 'representation-probe',
    email: 'probe@example.com',
    message: 'Asking for the row back should be refused.',
    source: PROBE_SOURCE,
  }),
});
report(
  representation.status >= 400 ? PASS : FAIL,
  `Asking for the inserted row back is refused (${representation.status})`,
  representation.status < 400
    ? 'anon can read rows back. A SELECT policy exists that should not - every message you receive would be public.'
    : undefined,
);

// 5 - the column-level grant should stop anon backdating a row.
const forged = await call('/rest/v1/contacts', {
  method: 'POST',
  headers: { Prefer: 'return=minimal' },
  body: JSON.stringify({
    name: 'forge-probe',
    email: 'probe@example.com',
    message: 'Attempting to backdate this row to 2001.',
    source: PROBE_SOURCE,
    created_at: '2001-01-01T00:00:00Z',
  }),
});
report(
  forged.status >= 400 ? PASS : FAIL,
  `Forging created_at is refused (${forged.status})`,
  forged.status < 400
    ? 'The INSERT grant is table-level. Re-run the migration - it should grant only (name, email, message, source).'
    : undefined,
);

// 6 - anon must not be able to delete.
const removed = await call(
  `/rest/v1/contacts?name=eq.${encodeURIComponent(marker)}`,
  { method: 'DELETE' },
);
report(
  removed.status >= 400 ? PASS : FAIL,
  `anon cannot delete (${removed.status})`,
  removed.status < 400 ? 'A DELETE policy exists that should not.' : undefined,
);

// 7 - the CHECK constraints should reject a too-short message.
const short = await call('/rest/v1/contacts', {
  method: 'POST',
  headers: { Prefer: 'return=minimal' },
  body: JSON.stringify({
    name: 'constraint-probe',
    email: 'probe@example.com',
    message: 'short',
    source: PROBE_SOURCE,
  }),
});
report(
  short.status >= 400 ? PASS : WARN,
  `CHECK constraints reject a 5-character message (${short.status})`,
  short.status < 400
    ? 'The constraints did not apply. Re-run the migration.'
    : undefined,
);

console.log(
  `\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}`,
);

console.log(`
Every row this script writes is tagged source = '${PROBE_SOURCE}'.
Clear them all in the SQL Editor with:

  delete from public.contacts where source = '${PROBE_SOURCE}';

If no Discord message arrived for the inserted row, the webhook is not wired up
yet - see section 3 of docs/PHASE-5-SUPABASE.md.`);

process.exit(failures === 0 ? 0 : 1);
