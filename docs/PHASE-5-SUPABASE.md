# Phase 5 — contact form setup

Everything in the repo is written and tested. What remains are the steps that
need your accounts. Work top to bottom; each section ends with a way to check
it worked.

Until you finish, **the site is already correct** — an unconfigured deployment
returns `unavailable` from the API route and the form degrades to a `mailto:`
link. There is no broken intermediate state to rush through.

---

## 1. Create the table

Supabase dashboard → **SQL Editor** → paste and run, in order:

1. [`supabase/migrations/0001_contacts.sql`](../supabase/migrations/0001_contacts.sql) — the table, RLS and grants.
2. [`supabase/migrations/0002_healthcheck.sql`](../supabase/migrations/0002_healthcheck.sql) — a one-line function the keep-alive workflow calls. Needed because `GET /rest/v1/` answers 401 to the anon key on this project, so there is otherwise nothing anon may successfully request.

It is written to be safely re-runnable, so if you are unsure whether it already
applied, just run it again.

**Check it.** In **Table Editor** you should see `contacts` with a green _RLS
enabled_ badge. Then, in SQL Editor:

```sql
select tablename, policyname, cmd, roles
from pg_policies where tablename = 'contacts';
```

Exactly one row, `cmd = INSERT`, `roles = {anon}`. If you see a SELECT policy,
something else created it — drop it.

---

## 2. Point the site at the project

**Project Settings → API.** You need two values:

| Value               | Where it goes       |
| ------------------- | ------------------- |
| Project URL         | `SUPABASE_URL`      |
| `anon` `public` key | `SUPABASE_ANON_KEY` |

> **Not the `service_role` key.** It bypasses RLS completely. The anon key is
> the correct level of authority here — RLS restricts it to appending rows it
> can never read back, which is exactly what the endpoint needs and nothing
> more. If a future session suggests "upgrading" to the service role key to fix
> something, the actual bug is elsewhere.

**Vercel → your project → Settings → Environment Variables.** Add both, for
Production, Preview and Development. Redeploy — env vars are read at request
time, but a redeploy is the simplest way to be sure.

For local development, copy `.env.example` to `.env.local` and fill in the same
two values. `.env*` is gitignored.

**Check it.** With `.env.local` filled in, run:

```bash
npm run verify:supabase
```

That exercises the real project the same way the API route does, and checks the
things that are easy to get subtly wrong: that the key is the anon key and not
the service role key, that the table exists, that anon genuinely _cannot_ read
it back, that a forged `created_at` is refused, and that the CHECK constraints
bite. It writes one tagged row and prints the SQL to delete it.

Then send yourself a real message through the deployed form — the row should
appear in the Table Editor.

---

## 2b. Deployment settings

The build failing with **`No Output Directory named "public" found`** does not
mean the build failed — read the log again and `next build` completed fine, all
17 pages generated. It means Vercel was not treating this as a Next.js project:
with the Framework Preset set to _Other_, it runs your build command and then
looks for a folder of static files to serve, which a Next.js app does not
produce.

[`vercel.json`](../vercel.json) now pins `"framework": "nextjs"`, and settings
in that file override the dashboard. If you would rather fix it at the source as
well: **Vercel → Settings → Build & Deployment → Framework Preset → Next.js**.

> **Function region.** Vercel defaults to `iad1` (Washington). Every contact
> submission is a round trip from there to your Supabase project, so if that
> project lives in Singapore or Mumbai the insert pays a transatlantic hop it
> does not need. Once you know the region, `"regions": ["sin1"]` (or `bom1`) in
> `vercel.json` moves the function next door to it. Not urgent — the form is
> not on the render path — but it is free to fix.

---

## 3. Email notification (Resend)

Without this the messages still arrive — they sit in the table. This step is
only about finding out promptly.

### 3a. Resend

1. Sign up at resend.com (free tier: 3,000 emails/month, no card).
2. Verify a sender. Two options:
   - **Once you own the domain** (Phase 6): add it under **Domains** and use
     something like `portfolio@yourdomain`. Best deliverability.
   - **Before then**: use Resend's `onboarding@resend.dev` sender, which can
     only send to the address you signed up with. Fine for now — that is you.
3. **API Keys** → create one with **Sending access** only.

### 3b. Deploy the Edge Function

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>

npx supabase secrets set \
  RESEND_API_KEY=re_xxx \
  NOTIFY_FROM='Portfolio <onboarding@resend.dev>' \
  NOTIFY_TO=sansikasuhan5@gmail.com \
  WEBHOOK_SECRET="$(openssl rand -hex 32)"

npx supabase functions deploy notify-contact --no-verify-jwt
```

Keep the `WEBHOOK_SECRET` value — you need it in the next step. `--no-verify-jwt`
is required because the caller is Postgres, not a logged-in user; the shared
secret is what authenticates it instead, and the function rejects anything
without the matching header.

### 3c. Wire the webhook

Dashboard → **Database → Webhooks** → _Create a new hook_:

- **Table:** `public.contacts`
- **Events:** Insert only
- **Type:** HTTP Request, `POST`
- **URL:** `https://<project-ref>.supabase.co/functions/v1/notify-contact`
- **HTTP Headers:** add `x-webhook-secret` with the value you generated above

**Check it.** Send another test message. The email should arrive within a few
seconds, and replying to it should reply to the sender's address, not to
Supabase. If nothing arrives, **Edge Functions → notify-contact → Logs** will
say why — a 403 there means the header did not match.

---

## 4. Keep-alive

Free projects pause after roughly a week of inactivity, which is exactly a
portfolio's traffic pattern. [`.github/workflows/supabase-keepalive.yml`](../.github/workflows/supabase-keepalive.yml)
pings every other day.

GitHub → repo → **Settings → Secrets and variables → Actions** → add
`SUPABASE_URL` and `SUPABASE_ANON_KEY` as repository secrets.

**Check it.** Actions tab → _Supabase keep-alive_ → **Run workflow**. It should
print `PostgREST responded 200`. A red run later on is your early warning that
the project has paused.

> GitHub disables scheduled workflows in repositories with no activity for 60
> days. If you stop committing for two months, check that this is still enabled.

---

## 5. Prove the failure path deliberately

This is the part people skip, and it is the part the whole design is for. Do it
once, on a preview deployment, and you will know the site cannot be taken down
by its own database.

1. In Vercel, change `SUPABASE_ANON_KEY` on a **Preview** environment to
   `deliberately-wrong`, and redeploy the preview.
2. Submit the form on the preview URL.
3. You should get a calm paragraph and an **Open this message in my mail app**
   button, prefilled with what you typed. No error text, no red, nothing lost.
4. Put the key back.

Already verified locally against a stubbed PostgREST — a 401, a 403 from RLS,
and a hung connection all produce that same panel, the last within a six-second
timeout. Doing it once for real is still worth your five minutes.

---

## Clearing the probe rows

Every row `npm run verify:supabase` writes is tagged `source = 'verify-probe'`:

```sql
delete from public.contacts where source = 'verify-probe';
```

The first two runs of the script predate that tagging and left four rows behind
— two `SETUP-CHECK-…` and two `no-prefer-probe`. Clear those with:

```sql
delete from public.contacts
where email in ('setup-check@example.com', 'probe@example.com');
```

---

## What this setup does not do

Written down so nobody has to rediscover it.

- **The rate limit is per serverless instance.** Vercel runs several and
  recycles them, so the real ceiling is a multiple of 3 per 10 minutes and a
  cold start resets it. It stops stuck retry loops and casual abuse, not a
  determined attacker. Upgrade path if it ever matters: a `SECURITY DEFINER`
  Postgres function that counts recent inserts against a hashed IP, called
  before the insert. That keeps the count in one place across instances.
- **The timing check is client-supplied** and therefore forgeable by anyone who
  reads the source. It fails open on purpose: a missing measurement is accepted,
  because binning a real person's message is worse than accepting a bot's.
- **The honeypot only catches bots that fill every field.** Targeted spam aimed
  at this specific form would get through. That is an acceptable trade for a
  personal site with no captcha and no third-party script.
- **Notification is downstream of storage.** If Resend is down or the free tier
  is exhausted, the message is still in the table. Check the dashboard if things
  go quiet for a suspiciously long time.
- **No IP address is stored anywhere.** The rate limiter hashes it in memory for
  ten minutes and the table has no column for it.
- **`Prefer: return=minimal` is explicit, not required.** PostgREST defaults to
  it for POST — verified against the live project. It is set at the call site
  because `@supabase/supabase-js` defaults to `return=representation` instead,
  and anon has no select privilege, so anyone swapping the raw `fetch` for the
  client library without noticing would break the form.
