-- Anonymous, opt-in device analytics for Ventorea Studios.
-- Run in Supabase Dashboard -> SQL Editor.
create table if not exists public.device_analytics (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  device_type text not null check (device_type in ('Mobile phone','Tablet','Desktop / laptop')),
  operating_system text not null check (char_length(operating_system) between 1 and 40),
  browser text not null check (char_length(browser) between 1 and 50),
  page_path text not null check (char_length(page_path) between 1 and 180),
  viewport_bucket text not null check (viewport_bucket in ('small','medium','large'))
);
create index if not exists device_analytics_created_at_idx on public.device_analytics(created_at desc);
alter table public.device_analytics enable row level security;
revoke all on public.device_analytics from anon, authenticated;
grant insert on public.device_analytics to anon, authenticated;
grant usage, select on sequence public.device_analytics_id_seq to anon, authenticated;
grant select on public.device_analytics to authenticated;
drop policy if exists "Visitors can submit opt-in anonymous device analytics" on public.device_analytics;
create policy "Visitors can submit opt-in anonymous device analytics"
on public.device_analytics for insert to anon, authenticated
with check (
  device_type in ('Mobile phone','Tablet','Desktop / laptop')
  and char_length(operating_system) between 1 and 40
  and char_length(browser) between 1 and 50
  and char_length(page_path) between 1 and 180
  and viewport_bucket in ('small','medium','large')
);
drop policy if exists "Only studio owner can read device analytics" on public.device_analytics;
create policy "Only studio owner can read device analytics"
on public.device_analytics for select to authenticated
using (lower(coalesce(auth.jwt()->>'email','')) = 'ventoreastudios.support@gmail.com');
