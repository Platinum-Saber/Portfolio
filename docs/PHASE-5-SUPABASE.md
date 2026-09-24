# Phase 5 - contact form setup

Everything in the repo is written and tested. What remains are the steps that
need your accounts. Work top to bottom; each section ends with a way to check
it worked.

Until you finish, **the site is already correct** - an unconfigured deployment
returns `unavailable` from the API route and the form degrades to a `mailto:`
link. There is no broken intermediate state to rush through.

---

## Status

Ticked off as of 2026-09-04. **The contact form is fully working**: a
submission is stored and lands in Discord seconds later. What is left is
hygiene, not function.

- [x] **1. Create the table** - both migrations applied.
- [x] **2. Point the site at the project** - Production only; Preview and
      Development still to tick, and §5 needs Preview.
- [x] **2b. Deployment settings** - `vercel.json` pins `"framework": "nextjs"`.
- [x] **3. Notification** - Discord, end to end. Resend was swapped out; §3
      says why and §3d says how to go back.
- [x] **4. Keep-alive** - green as of run #9.
- [ ] **5. Prove the failure path** - five minutes, worth it.
- [ ] **Clear the probe rows** - `verify:supabase` has run, so there are rows
      to clear.

---

## 1. Create the table

> **Done.** Both migrations are applied to project `qvcozegphyjdmabhmhjq`.
> `healthcheck()` returning 200 to the keep-alive workflow is proof that at
> least `0002` landed.

Supabase dashboard → **SQL Editor** → paste and run, in order:

1. [`supabase/migrations/0001_contacts.sql`](../supabase/migrations/0001_contacts.sql) - the table, RLS and grants.
2. [`supabase/migrations/0002_healthcheck.sql`](../supabase/migrations/0002_healthcheck.sql) - a one-line function the keep-alive workflow calls. Needed because `GET /rest/v1/` answers 401 to the anon key on this project, so there is otherwise nothing anon may successfully request.

It is written to be safely re-runnable, so if you are unsure whether it already
applied, just run it again.

**Check it.** In **Table Editor** you should see `contacts` with a green _RLS
enabled_ badge. Then, in SQL Editor:

```sql
select tablename, policyname, cmd, roles
from pg_policies where tablename = 'contacts';
```

Exactly one row, `cmd = INSERT`, `roles = {anon}`. If you see a SELECT policy,
something else created it - drop it.

---

## 2. Point the site at the project

**Project Settings → API.** You need two values:

| Value               | Where it goes       |
| ------------------- | ------------------- |
| Project URL         | `SUPABASE_URL`      |
| `anon` `public` key | `SUPABASE_ANON_KEY` |

> **Not the `service_role` key.** It bypasses RLS completely. The anon key is
> the correct level of authority here - RLS restricts it to appending rows it
> can never read back, which is exactly what the endpoint needs and nothing
> more. If a future session suggests "upgrading" to the service role key to fix
> something, the actual bug is elsewhere.

**Vercel → your project → Settings → Environment Variables.** Add both, for
Production, Preview and Development.

> **Done for Production, 2026-09-04** - a real message went through the
> deployed form and appeared in the table. **Preview and Development are still
> unticked**, which is fine for the live site and not fine for §5: a preview
> with no variables at all fails the bad-key test for the wrong reason. Edit
> each variable and add the other two environments before doing that step.

**Then redeploy. This is not optional and the earlier wording here was wrong.**
Vercel resolves environment variables into a deployment when that deployment is
created; an existing one keeps whatever the environment held at build time and
never picks up values added later. The form went on returning `unavailable`
after both variables were saved, for exactly that reason.

> **Test the right URL.** A hashed URL like
> `portfolio-lake-delta-0qhmdtfj5a.vercel.app` is pinned to one build and will
> show the `mailto:` panel forever regardless of what you redeploy. Redeploying
> creates a *new* deployment at a *new* hashed URL and moves the alias. Test the
> alias, or click through to the new deployment from the dashboard.

For local development, copy `.env.example` to `.env.local` and fill in the same
two values. `.env*` is gitignored.

> **If you edit `.env.local` on Windows**, watch the line endings. The file
> currently has CRLF, which Next.js and `dotenv` handle fine - but `source
> .env.local` in a shell does not: the trailing `\r` rides along into the value
> and every request 401s for no visible reason. `dos2unix .env.local`, or read
> the values with `tr -d '\r' < .env.local`.

**Check it.** With `.env.local` filled in, run:

```bash
npm run verify:supabase
```

> **All eight checks PASS as of 2026-09-04.** The key is the anon key;
> `healthcheck()` answered 200; anon cannot read, cannot delete, cannot forge
> `created_at`, cannot ask for the inserted row back; the insert returns 201;
> and a 5-character message is rejected 400. The database side is finished.

That exercises the real project the same way the API route does, and checks the
things that are easy to get subtly wrong: that the key is the anon key and not
the service role key, that the table exists, that anon genuinely _cannot_ read
it back, that a forged `created_at` is refused, and that the CHECK constraints
bite. It writes one tagged row and prints the SQL to delete it.

Then send yourself a real message through the deployed form - the row should
appear in the Table Editor. **Confirmed 2026-09-04.**

**If the panel persists**, the function logs say which of the three failure
branches fired. Vercel → **Logs**, filtered to `/api/contact`:

| What you see | What it means |
| --- | --- |
| _nothing at all_ | The variables are not reaching the function. The unconfigured branch returns 503 silently, on purpose. |
| `[contact] insert failed: 401 …` | They arrived; Supabase refused the key. Usually a stray space or newline in the pasted JWT. |
| `[contact] insert threw: … TimeoutError` | The 6 s abort fired - the project is paused or unreachable. |

Silence means Vercel, a log line means Supabase.

---

## 2b. Deployment settings

The build failing with **`No Output Directory named "public" found`** does not
mean the build failed - read the log again and `next build` completed fine, all
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
> `vercel.json` moves the function next door to it. Not urgent - the form is
> not on the render path - but it is free to fix.

---

## 3. Notification (Discord)

Without this the messages still arrive - they sit in the table. This step is
only about finding out promptly.

> **Discord, not email - decided 2026-09-04.** The original plan was Resend, and
> it is a good plan for a site that owns a domain. This one does not yet, which
> meant a sender stuck on `onboarding@resend.dev` (deliverable only to my own
> signup address) until Phase 6 resolves the domain question. A Discord incoming
> webhook is a URL you POST JSON to: no bot user, no gateway connection, no
> token to rotate, no sender to verify, one secret instead of three.
>
> **What this gives up is reply-to.** The email version set `reply_to` to the
> visitor's address, so answering was one click from the notification. Discord
> does not linkify `mailto:`, so the address is plain selectable text in the
> embed and answering means pasting it into a mail client. That is the whole
> cost, and it is worth naming because it is the one thing email did better.
>
> The shape did not change: the database webhook still fires the same Edge
> Function on INSERT, notification is still strictly downstream of storage, and
> a Discord outage still cannot fail a submission. Only the function's outbound
> call is different. Reinstating Resend later means editing one function body
> and swapping the secrets - nothing else in the chain knows the difference.

### 3a. The Discord webhook

**Server Settings → Integrations → Webhooks → New Webhook.** Point it at a
channel only you can read, name it something like `portfolio-contact`, and
**Copy Webhook URL**.

> Treat that URL as a credential, not an address. Anyone holding it can post to
> the channel. It is not the same thing as `WEBHOOK_SECRET` below - that one
> proves an inbound request to the *function* came from Postgres. Two secrets,
> two directions.

Channel choice matters: a stranger's name, email and message land there in full.
On a private server that is equivalent to your inbox. On a shared one it is not,
and someone writing about an internship did not agree to it.

### 3b. Deploy the Edge Function

```bash
npx supabase login
npx supabase link --project-ref qvcozegphyjdmabhmhjq

npx supabase secrets set \
  DISCORD_WEBHOOK_URL='https://discord.com/api/webhooks/<id>/<token>' \
  WEBHOOK_SECRET="$(openssl rand -hex 32)"

npx supabase functions deploy notify-contact --no-verify-jwt
```

> **On PowerShell**, which is where this repo actually gets worked on, that block
> does not run as written: `\` is not a line continuation, `$(...)` is not
> command substitution, and `openssl` may not be on PATH. The equivalent:
>
> ```powershell
> npx supabase login
> npx supabase link --project-ref qvcozegphyjdmabhmhjq
>
> $secret = -join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Max 256) })
> $secret   # print it - you need this exact value in 3c
>
> npx supabase secrets set "DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/<id>/<token>" "WEBHOOK_SECRET=$secret"
>
> npx supabase functions deploy notify-contact --no-verify-jwt
> ```

**Check what actually landed** before deploying:

```powershell
npx supabase secrets list
```

The `DIGEST` column is a plain SHA-256 of the value, so you can confirm a secret
is exactly right without the CLI ever printing it back:

```powershell
$sha = [System.Security.Cryptography.SHA256]::Create()
-join ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes('the-value-you-meant')) | ForEach-Object { '{0:x2}' -f $_ })
```

Worth the thirty seconds. `Finished supabase secrets set` only means Supabase
stored what you handed it - on the first attempt here that was the literal
string `https://discord.com/api/webhooks/...`, placeholder and all, copied
straight out of this document. That deploys perfectly happily and then fails at
runtime as `[notify-contact] discord 404`, which sends you looking at Discord
rather than at the secret. A digest that matches is proof, and it also rules out
the trailing whitespace that a copy-paste sometimes carries.

Keep the `WEBHOOK_SECRET` value - you need it in the next step. `--no-verify-jwt`
is required because the caller is Postgres, not a logged-in user; the shared
secret is what authenticates it instead, and the function rejects anything
without the matching header.

> `link` may ask for the **database** password (Project Settings → Database).
> That is not the anon key. And if the CLI rejects `--no-verify-jwt` as
> deprecated, `link` will have written `supabase/config.toml` - put
> `verify_jwt = false` under `[functions.notify-contact]` there instead. It must
> be off either way.

### 3c. Wire the webhook

Dashboard → **Integrations → Webhooks** → _Create a new hook_.

> **Not under Database.** It used to be, and older guides (including earlier
> drafts of this one) still say so. The dashboard files the wrapper under
> Integrations now:
> `/project/qvcozegphyjdmabhmhjq/integrations/webhooks/overview`. Underneath it
> is unchanged - a Postgres trigger calling `supabase_functions.http_request()`
> through `pg_net`.

Fill in:

- **Table:** `public.contacts`
- **Events:** Insert only
- **Type:** HTTP Request, `POST`
- **URL:** `https://qvcozegphyjdmabhmhjq.supabase.co/functions/v1/notify-contact`
- **HTTP Headers:** add `x-webhook-secret` with the value you generated above
- **Timeout:** raise it from the default 1000 ms to **5000**. The round trip to
  Discord routinely exceeds a second. The post still lands when this trips, but
  the hook records a failure, which is an hour spent chasing a problem that is
  not one.

If the dashboard has moved it again, the SQL Editor is the stable route:

```sql
create trigger notify_contact_on_insert
after insert on public.contacts
for each row
execute function supabase_functions.http_request(
  'https://qvcozegphyjdmabhmhjq.supabase.co/functions/v1/notify-contact',
  'POST',
  '{"Content-Type":"application/json","x-webhook-secret":"<the secret>"}',
  '{}',
  '5000'
);
```

> **This one does not belong in `supabase/migrations/`**, unlike the other two
> scripts - it embeds the shared secret and that directory is tracked. Run it in
> the SQL Editor and leave it out of the repo. That is the whole reason this
> step is a dashboard step rather than a third migration file.

**Check it.** Send another test message. The embed should appear within a few
seconds - **confirmed working 2026-09-04**: the sender's name as the title, their message as the body, their email
in a field below, and the row id in the footer. If nothing arrives, **Edge
Functions → notify-contact → Logs** says why:

| What you see | What it means |
| --- | --- |
| `403`, no body | The `x-webhook-secret` header does not match. Usually the secret was regenerated between 3b and 3c. |
| `[notify-contact] missing DISCORD_WEBHOOK_URL` | The secret did not take. Check `npx supabase secrets list`. |
| `[notify-contact] discord 401` | The webhook URL is wrong or was deleted in Discord. |
| `[notify-contact] discord 400` | Discord refused the payload - an embed field over length, most likely, though `clamp()` exists to prevent exactly that. |
| _no invocation at all_ | The database webhook is not firing. Check it is enabled and on INSERT. |

None of these can lose a message. The row is committed before the webhook fires;
the worst case is finding out by opening the table instead of Discord.

### 3d. If you want email back later

Once Phase 6 settles the domain, the email path becomes strictly better -
`reply_to` is worth having. Reinstating it means rewriting the one `fetch` in
`supabase/functions/notify-contact/index.ts` to call `api.resend.com/emails`
and swapping `DISCORD_WEBHOOK_URL` for `RESEND_API_KEY` / `NOTIFY_FROM` /
`NOTIFY_TO`. The git history has the Resend version in full. Nothing else in the
chain - the table, the trigger, the webhook, the shared secret - changes.

---

## 4. Keep-alive

Free projects pause after roughly a week of inactivity, which is exactly a
portfolio's traffic pattern. [`.github/workflows/supabase-keepalive.yml`](../.github/workflows/supabase-keepalive.yml)
pings every other day.

GitHub → repo → **Settings → Secrets and variables → Actions** → add
`SUPABASE_URL` and `SUPABASE_ANON_KEY` as repository secrets.

> **Done** - run #9, 2026-09-04, green.
>
> Runs #1–#7 were red, all with the same annotation: _SUPABASE_URL /
> SUPABASE_ANON_KEY repository secrets are not set_. Nothing was wrong with the
> workflow or the database; the secrets had simply never been added. Worth
> stating because it is the easy thing to misread: **Actions secrets are a
> separate store.** `.env.local` is on your laptop and Vercel's environment
> variables are Vercel's - neither is visible to a GitHub runner. The workflow
> checks for both up front and exits 1 before making any request, which is why
> the failure took 3 seconds and named itself precisely.

**Check it.** Actions tab → _Supabase keep-alive_ → **Run workflow**. It should
print `healthcheck() responded 200: "<a timestamp>"`. A red run later on is your
early warning that the project has paused.

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

Already verified locally against a stubbed PostgREST - a 401, a 403 from RLS,
and a hung connection all produce that same panel, the last within a six-second
timeout. Doing it once for real is still worth your five minutes.

---

## Clearing the probe rows

Every row `npm run verify:supabase` writes is tagged `source = 'verify-probe'`:

```sql
delete from public.contacts where source = 'verify-probe';
```

The first two runs of the script predate that tagging and left four rows behind -
two `SETUP-CHECK-…` and two `no-prefer-probe`. Clear those with:

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
- **Notification is downstream of storage.** If Discord is down, the webhook has
  been deleted, or the function has a bug, the message is still in the table.
  Check the dashboard if things go quiet for a suspiciously long time.
- **No IP address is stored anywhere.** The rate limiter hashes it in memory for
  ten minutes and the table has no column for it.
- **`Prefer: return=minimal` is explicit, not required.** PostgREST defaults to
  it for POST - verified against the live project. It is set at the call site
  because `@supabase/supabase-js` defaults to `return=representation` instead,
  and anon has no select privilege, so anyone swapping the raw `fetch` for the
  client library without noticing would break the form.
