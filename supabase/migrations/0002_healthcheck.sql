-- A heartbeat the keep-alive workflow can actually assert on.
--
-- Why this exists: the obvious probe, GET /rest/v1/, returns 401 for anon on
-- this project — measured, not guessed. That is fine as a security posture and
-- useless as a health check, because a 401 cannot be told apart from a wrong
-- key, a dropped grant or a paused project. And PostgREST serves that root from
-- a cached schema, so it is not clear it touches Postgres at all — which is the
-- one thing a pause-prevention ping has to do.
--
-- The contacts table is deliberately unreadable by anon, so it cannot serve as
-- the probe either. Hence a function: it returns no data about anything, it
-- unambiguously executes inside Postgres, and a 200 means 200.

create or replace function public.healthcheck()
returns timestamptz
language sql
stable
set search_path = ''
as $$ select now() $$;

comment on function public.healthcheck() is
  'Liveness probe for the keep-alive workflow. Returns the server clock and nothing else.';

revoke all on function public.healthcheck() from public;
grant execute on function public.healthcheck() to anon;
