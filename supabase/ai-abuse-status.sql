-- Ventorea AI profanity suspensions
-- Run this once in the Supabase SQL Editor for project ncmthgqsrkasesfqvuzk.
create table if not exists public.ai_abuse_status (
  user_id uuid primary key,
  swear_count integer not null default 0 check (swear_count >= 0),
  suspension_level integer not null default 0 check (suspension_level >= 0),
  suspended_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.ai_abuse_status enable row level security;

-- No public or authenticated client access. The server uses SUPABASE_SERVICE_ROLE_KEY.
revoke all on public.ai_abuse_status from anon, authenticated;
grant all on public.ai_abuse_status to service_role;

create or replace function public.set_ai_abuse_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ai_abuse_status_updated_at on public.ai_abuse_status;
create trigger ai_abuse_status_updated_at
before update on public.ai_abuse_status
for each row execute function public.set_ai_abuse_updated_at();
