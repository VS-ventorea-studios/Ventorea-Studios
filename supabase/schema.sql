-- Ventorea Studios account profiles and friend requests.
-- Run this entire file in Supabase Dashboard -> SQL Editor.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Ventorea member' check (char_length(display_name) between 1 and 80),
  bio text not null default '' check (char_length(bio) <= 280),
  friend_code text not null unique check (char_length(friend_code) between 5 and 16),
  updated_at timestamptz not null default now()
);
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  constraint friend_requests_no_self check (sender_id <> receiver_id),
  constraint friend_requests_unique_pair unique(sender_id, receiver_id)
);
create table if not exists public.friendships (
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id, friend_id),
  constraint friendships_no_self check(user_id <> friend_id)
);
create index if not exists friend_requests_receiver_status_idx on public.friend_requests(receiver_id,status);
create index if not exists friend_requests_sender_idx on public.friend_requests(sender_id);
alter table public.profiles enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
drop policy if exists "Authenticated users can view public profiles" on public.profiles;
create policy "Authenticated users can view public profiles" on public.profiles for select to authenticated using (true);
drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile" on public.profiles for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Participants can view friend requests" on public.friend_requests;
create policy "Participants can view friend requests" on public.friend_requests for select to authenticated using (auth.uid() = sender_id or auth.uid() = receiver_id);
drop policy if exists "Users can send friend requests as themselves" on public.friend_requests;
create policy "Users can send friend requests as themselves" on public.friend_requests for insert to authenticated with check (auth.uid() = sender_id and status = 'pending' and sender_id <> receiver_id);
drop policy if exists "Receivers can respond to friend requests" on public.friend_requests;
create policy "Receivers can respond to friend requests" on public.friend_requests for update to authenticated using (auth.uid() = receiver_id and status = 'pending') with check (auth.uid() = receiver_id and status in ('accepted','rejected'));
drop policy if exists "Users can view their own friendship rows" on public.friendships;
create policy "Users can view their own friendship rows" on public.friendships for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can create friendship rows for accepted requests" on public.friendships;
create policy "Users can create friendship rows for accepted requests" on public.friendships for insert to authenticated with check (
 (auth.uid() = user_id and exists (
  select 1 from public.friend_requests r where r.status = 'accepted'
  and ((r.sender_id = user_id and r.receiver_id = friend_id) or (r.sender_id = friend_id and r.receiver_id = user_id))
 )) or
 (auth.uid() = friend_id and exists (
  select 1 from public.friend_requests r where r.status = 'accepted'
  and r.sender_id = user_id and r.receiver_id = friend_id
 ))
);
drop policy if exists "Users can delete their own friendship rows" on public.friendships;
create policy "Users can delete their own friendship rows" on public.friendships for delete to authenticated using (auth.uid() = user_id);
grant select,insert,update on public.profiles to authenticated;
grant select,insert,update on public.friend_requests to authenticated;
grant select,insert,delete on public.friendships to authenticated;
