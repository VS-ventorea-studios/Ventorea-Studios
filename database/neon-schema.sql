-- Ventorea Studios account backend.
-- This schema is intended for a private Neon Postgres database accessed only by Vercel server functions.
-- Do not expose the app schema through a public Data API.

create schema if not exists app;
revoke all on schema app from public;

create table if not exists app.users (
  id uuid primary key,
  google_sub text not null unique,
  email text not null,
  email_verified boolean not null default true,
  display_name text not null default 'Ventorea member'
    check (char_length(display_name) between 1 and 80),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz,
  legacy_supabase_user_id uuid unique
);

create index if not exists app_users_email_lower_idx
  on app.users (lower(email));

create table if not exists app.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app.users(id) on delete cascade,
  token_hash char(64) not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz,
  user_agent text
);

create index if not exists app_sessions_user_id_idx on app.sessions(user_id);
create index if not exists app_sessions_expiry_idx on app.sessions(expires_at);

create table if not exists app.profiles (
  user_id uuid primary key references app.users(id) on delete cascade,
  display_name text not null default 'Ventorea member'
    check (char_length(display_name) between 1 and 80),
  bio text not null default '' check (char_length(bio) <= 280),
  friend_code text not null unique
    check (char_length(friend_code) between 5 and 16),
  avatar_url text,
  updated_at timestamptz not null default now()
);

create table if not exists app.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references app.users(id) on delete cascade,
  receiver_id uuid not null references app.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  constraint friend_requests_no_self check (sender_id <> receiver_id),
  constraint friend_requests_unique_pair unique(sender_id, receiver_id)
);

create index if not exists friend_requests_receiver_status_idx
  on app.friend_requests(receiver_id,status);
create index if not exists friend_requests_sender_idx
  on app.friend_requests(sender_id);

create table if not exists app.friendships (
  user_id uuid not null references app.users(id) on delete cascade,
  friend_id uuid not null references app.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id, friend_id),
  constraint friendships_no_self check(user_id <> friend_id)
);

create index if not exists friendships_friend_id_idx on app.friendships(friend_id);

create table if not exists app.ai_abuse_status (
  user_id uuid primary key references app.users(id) on delete cascade,
  swear_count integer not null default 0 check (swear_count >= 0),
  suspension_level integer not null default 0 check (suspension_level >= 0),
  suspended_until timestamptz,
  updated_at timestamptz not null default now()
);

-- All tables live in the private app schema. Vercel server functions connect with
-- DATABASE_URL. No browser client or public role receives table access.
