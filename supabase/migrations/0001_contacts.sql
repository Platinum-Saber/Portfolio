-- Phase 5 — contact form storage.
--
-- Threat model, stated plainly: the anon key is public by definition. It ships
-- in this repo's deployment environment and anyone who wants it can read it out
-- of a request. Everything below assumes an attacker holds that key, so the
-- only thing it is permitted to do is append a row it can never read back.

create table if not exists public.contacts (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null check (char_length(trim(name)) between 1 and 120),
  email       text not null check (
                char_length(email) between 3 and 254
                and position('@' in email) > 1
              ),
  message     text not null check (char_length(trim(message)) between 10 and 5000),
  -- Set by the API route, not the browser. Lets a future second entry point
  -- (say a project-page enquiry) be told apart without a schema change.
  source      text not null default 'portfolio' check (char_length(source) <= 40)
);

comment on table public.contacts is
  'Contact form submissions. Insert-only for anon; read exclusively through the dashboard or the service role.';

-- Reading the newest first is the only access pattern that exists.
create index if not exists contacts_created_at_idx
  on public.contacts (created_at desc);

alter table public.contacts enable row level security;

-- Supabase grants broadly to anon on new public tables by default. Do not rely
-- on RLS alone to compensate — take the grants away and hand back exactly one.
revoke all on public.contacts from anon, authenticated;
-- Column-level, deliberately: anon may supply the four content columns and
-- nothing else, so `id` and `created_at` always come from their defaults and
-- cannot be forged or backdated by whoever holds the key.
grant insert (name, email, message, source) on public.contacts to anon;

-- Insert only. There is deliberately no select, update or delete policy, so
-- those operations are denied for anon no matter what the grants say.
drop policy if exists "anon may insert a contact" on public.contacts;
create policy "anon may insert a contact"
  on public.contacts
  for insert
  to anon
  with check (true);

-- Note for anyone tempted to add a "created_at must not be in the future"
-- CHECK here: Postgres rejects it. now() is STABLE, and CHECK constraints only
-- accept IMMUTABLE functions. The column-level grant above is what actually
-- makes backdating impossible, and it does the job properly.
