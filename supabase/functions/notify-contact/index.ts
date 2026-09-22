/**
 * Posts a new contact submission to a Discord channel.
 *
 * Fired by a Supabase database webhook on INSERT into public.contacts — not by
 * the site. That matters: the notification path is downstream of the write, so
 * if Discord is down, the webhook has been deleted, or this function has a bug,
 * the message is still safely in the table. Notification failing must never
 * look like submission failing.
 *
 * Discord over email (decided 2026-09-04): an incoming webhook is a URL you
 * POST JSON to — no bot user, no gateway connection, no token to rotate, and
 * crucially no sender domain to verify, which is what the email path was
 * waiting on. The cost is reply-to: Discord does not linkify mailto:, so
 * answering means copying the address out. Accepted deliberately.
 *
 * Deno, not Node — this runs on Supabase Edge Functions.
 * Deploy: supabase functions deploy notify-contact --no-verify-jwt
 */

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: {
    id: string;
    created_at: string;
    name: string;
    email: string;
    message: string;
    source: string;
  } | null;
};

/**
 * Discord renders embed descriptions as markdown and autolinks bare URLs, so
 * attacker-controlled text needs neutralising on both counts. Not a security
 * boundary the way HTML escaping was in the email version — the worst case is a
 * mangled embed or a link I might click — but this channel is somewhere I read
 * quickly and trust, which is exactly the wrong place to render a stranger's
 * formatting.
 *
 * Only the characters Discord documents as escapable are escaped, because it
 * strips the backslash from those and leaves it visible on anything else — so a
 * wider net would put literal backslashes in front of ordinary punctuation.
 * Mentions are handled by `allowed_mentions` instead, which is the reliable
 * lever; escaping `@` is not.
 */
function neutralise(value: string): string {
  return (
    value
      // Backslash first, or it would escape the escapes added below.
      .replace(/\\/g, '\\\\')
      .replace(/([*_~`|[\]])/g, '\\$1')
      // A zero-width space after the scheme: the text still reads correctly and
      // Discord stops turning it into a clickable link.
      .replace(/(https?|steam|discord):\/\//gi, '$1:/\u200B/')
  );
}

/** Discord rejects the whole payload if any field is over length. */
function clamp(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

Deno.serve(async (request: Request) => {
  // The webhook is configured with a shared secret in a custom header. Without
  // this the function URL is an open relay that will post anything to my
  // channel.
  const expected = Deno.env.get('WEBHOOK_SECRET');
  if (!expected || request.headers.get('x-webhook-secret') !== expected) {
    return new Response('Forbidden', { status: 403 });
  }

  let payload: WebhookPayload;
  try {
    payload = await request.json();
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  if (payload.type !== 'INSERT' || !payload.record) {
    return new Response('Ignored', { status: 200 });
  }

  const discordUrl = Deno.env.get('DISCORD_WEBHOOK_URL');
  if (!discordUrl) {
    console.error('[notify-contact] missing DISCORD_WEBHOOK_URL');
    // 200 on purpose: a misconfiguration here is mine to fix, and returning an
    // error only makes Postgres retry a request that will fail identically.
    return new Response('Not configured', { status: 200 });
  }

  const { name, email, message, created_at, id, source } = payload.record;

  const response = await fetch(`${discordUrl}?wait=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // Belt and braces alongside `neutralise`: even if a submission gets a
      // mention past the escaping, Discord is told to resolve none of them.
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title: clamp(neutralise(name), 256),
          description: clamp(neutralise(message), 4096),
          // --accent in dark mode (#3ddba0). Discord embeds are always on a
          // dark ground, so the dark-theme token is the right one of the pair.
          color: 0x3ddba0,
          timestamp: created_at,
          fields: [
            {
              name: 'Email',
              // Not a mailto: link — Discord will not linkify one, and a
              // half-rendered link is worse than plain text you can select.
              value: clamp(neutralise(email), 1024),
              inline: false,
            },
          ],
          footer: { text: `${source} · ${id}` },
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error(`[notify-contact] discord ${response.status}: ${detail}`);
    // 500 so the webhook retries — the row is already saved either way, so a
    // retry costs nothing and might catch a transient outage. Note Discord
    // rate-limits at 5 requests per 2 s per webhook and answers 429 with a
    // retry_after; a portfolio will never see it, but that is what it means.
    return new Response('Post failed', { status: 500 });
  }

  return new Response('Sent', { status: 200 });
});
