/**
 * Emails a new contact submission via Resend.
 *
 * Fired by a Supabase database webhook on INSERT into public.contacts — not by
 * the site. That matters: the notification path is downstream of the write, so
 * if Resend is down, the free tier is exhausted, or this function has a bug,
 * the message is still safely in the table. Notification failing must never
 * look like submission failing.
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

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/** The message is attacker-controlled text going into an HTML email. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

Deno.serve(async (request: Request) => {
  // The webhook is configured with a shared secret in a custom header. Without
  // this the function URL is an open relay that will email you anything.
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

  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('NOTIFY_FROM');
  const to = Deno.env.get('NOTIFY_TO');
  if (!apiKey || !from || !to) {
    console.error(
      '[notify-contact] missing RESEND_API_KEY / NOTIFY_FROM / NOTIFY_TO',
    );
    // 200 on purpose: a misconfiguration here is mine to fix, and returning an
    // error only makes Postgres retry a request that will fail identically.
    return new Response('Not configured', { status: 200 });
  }

  const { name, email, message, created_at, id } = payload.record;

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      // Replying to the notification replies to the person. The whole point.
      reply_to: email,
      subject: `Portfolio: ${name}`,
      text: `${message}\n\n---\nFrom: ${name} <${email}>\nAt:   ${created_at}\nRow:  ${id}`,
      html: `
        <div style="font-family:ui-sans-serif,system-ui,sans-serif;line-height:1.6;max-width:36rem">
          <p style="white-space:pre-wrap;margin:0 0 1.5rem">${escapeHtml(message)}</p>
          <hr style="border:none;border-top:1px solid #e2e2dd">
          <p style="font-size:0.85rem;color:#5f6570;margin:1rem 0 0">
            From <strong>${escapeHtml(name)}</strong>
            &lt;<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>&gt;<br>
            ${escapeHtml(created_at)}<br>
            <code style="font-size:0.8em">${escapeHtml(id)}</code>
          </p>
        </div>`,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error(`[notify-contact] resend ${response.status}: ${detail}`);
    // 500 so the webhook retries — the row is already saved either way, so a
    // retry costs nothing and might catch a transient Resend outage.
    return new Response('Send failed', { status: 500 });
  }

  return new Response('Sent', { status: 200 });
});
