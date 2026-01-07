-- WordCrack v1 schema
-- Safe defaults:
-- - Clients NEVER read puzzles.target_word (server-only)
-- - Attempts are strictly per-user via RLS
-- - Leaderboards read from views that do not expose sensitive fields

create extension if not exists pgcrypto;

-- Helpers
create or replace function public.is_upper_alpha_6(s text)
returns boolean
language sql
immutable
as $$
  select s is not null
     and length(s) = 6
     and s = upper(s)
     and s ~ '^[A-Z]{6}$';
$$;

create or replace function public.validate_letter_sets(letter_sets jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  i int;
  n int;
begin
  if letter_sets is null or jsonb_typeof(letter_sets) <> 'array' then
    return false;
  end if;

  if jsonb_array_length(letter_sets) <> 6 then
    return false;
  end if;

  for i in 0..5 loop
    if jsonb_typeof(letter_sets->i) <> 'array' then
      return false;
    end if;
    n := jsonb_array_length(letter_sets->i);
    if n < 4 or n > 5 then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

-- Tables
create table if not exists public.puzzles (
  id uuid primary key default gen_random_uuid(),
  puzzle_date date not null unique,
  target_word text not null check (public.is_upper_alpha_6(target_word)),
  cipher_word text not null check (public.is_upper_alpha_6(cipher_word)),
  letter_sets jsonb not null check (public.validate_letter_sets(letter_sets)),
  theme_hint text,
  created_at timestamptz not null default now()
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  puzzle_id uuid not null references public.puzzles(id) on delete cascade,
  mode text not null default 'daily' check (mode in ('daily','practice')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  solve_time_ms integer,
  penalty_ms integer not null default 0 check (penalty_ms >= 0),
  final_time_ms integer,
  hints_used jsonb not null default '[]'::jsonb,
  is_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attempts_completed_fields check (
    (is_completed = false and completed_at is null and solve_time_ms is null and final_time_ms is null)
    or
    (is_completed = true and completed_at is not null and solve_time_ms is not null and final_time_ms is not null)
  )
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_attempts_updated_at on public.attempts;
create trigger trg_attempts_updated_at
before update on public.attempts
for each row
execute function public.set_updated_at();

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  avatar_url text,
  invite_code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace function public.generate_invite_code()
returns text
language sql
stable
as $$
  select substring(encode(gen_random_bytes(6), 'hex') from 1 for 8);
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  candidate text;
  suffix int := 0;
begin
  base_username := coalesce(nullif(new.raw_user_meta_data->>'username',''), 'player');
  base_username := regexp_replace(lower(base_username), '[^a-z0-9_]', '', 'g');
  if length(base_username) < 3 then
    base_username := 'player';
  end if;

  candidate := base_username;
  while exists(select 1 from public.profiles where username = candidate) loop
    suffix := suffix + 1;
    candidate := base_username || '_' || suffix::text;
  end loop;

  insert into public.profiles (user_id, username, avatar_url, invite_code)
  values (
    new.id,
    candidate,
    nullif(new.raw_user_meta_data->>'avatar_url',''),
    public.generate_invite_code()
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create table if not exists public.friends (
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, friend_user_id),
  constraint friends_not_self check (user_id <> friend_user_id)
);

drop trigger if exists trg_friends_updated_at on public.friends;
create trigger trg_friends_updated_at
before update on public.friends
for each row execute function public.set_updated_at();

create table if not exists public.notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  push_enabled boolean not null default false,
  push_time_local time,
  timezone text,
  sms_enabled boolean not null default false,
  sms_time_local time,
  phone_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_notification_prefs_updated_at on public.notification_prefs;
create trigger trg_notification_prefs_updated_at
before update on public.notification_prefs
for each row execute function public.set_updated_at();

-- Public views (sanitize sensitive fields)
create or replace view public.puzzles_public as
select
  id,
  puzzle_date,
  cipher_word,
  letter_sets,
  theme_hint
from public.puzzles;

create or replace view public.profiles_public as
select
  user_id,
  username,
  avatar_url
from public.profiles;

create or replace view public.daily_leaderboard as
select
  p.puzzle_date,
  a.puzzle_id,
  a.user_id,
  pr.username,
  pr.avatar_url,
  a.final_time_ms,
  a.penalty_ms,
  jsonb_array_length(a.hints_used) as hints_used_count
from public.attempts a
join public.puzzles p on p.id = a.puzzle_id
join public.profiles_public pr on pr.user_id = a.user_id
where a.is_completed = true
  and a.mode = 'daily';

-- Lock down base table access; expose only sanitized views to clients.
revoke all on table public.puzzles from anon, authenticated;
revoke all on table public.profiles from anon, authenticated;
-- Attempts are server-authoritative (Edge Functions). Clients can read their attempts, but cannot write timing/penalties.
revoke insert, update, delete on table public.attempts from anon, authenticated;
grant select on table public.attempts to authenticated;

grant select on public.puzzles_public to anon, authenticated;
grant select on public.profiles_public to anon, authenticated;
grant select on public.daily_leaderboard to anon, authenticated;

-- RLS
alter table public.puzzles enable row level security;
alter table public.attempts enable row level security;
alter table public.profiles enable row level security;
alter table public.friends enable row level security;
alter table public.notification_prefs enable row level security;

-- Puzzles: no direct client access (views only). Keep RLS defensive.
drop policy if exists puzzles_no_client_select on public.puzzles;
create policy puzzles_no_client_select
on public.puzzles
for select
to anon, authenticated
using (false);

-- Attempts: users only access their own rows
drop policy if exists attempts_select_own on public.attempts;
create policy attempts_select_own
on public.attempts
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists attempts_insert_own on public.attempts;
create policy attempts_insert_own
on public.attempts
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists attempts_update_own on public.attempts;
create policy attempts_update_own
on public.attempts
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists attempts_delete_own on public.attempts;
create policy attempts_delete_own
on public.attempts
for delete
to authenticated
using (user_id = auth.uid());

-- Profiles: only owner can read/update full profile (invite_code is private); public view used elsewhere
drop policy if exists profiles_owner_select on public.profiles;
create policy profiles_owner_select
on public.profiles
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists profiles_owner_update on public.profiles;
create policy profiles_owner_update
on public.profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Friends: both sides can view; either side can update (edge functions should enforce semantics)
drop policy if exists friends_select_involved on public.friends;
create policy friends_select_involved
on public.friends
for select
to authenticated
using (user_id = auth.uid() or friend_user_id = auth.uid());

drop policy if exists friends_insert_self on public.friends;
create policy friends_insert_self
on public.friends
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists friends_update_involved on public.friends;
create policy friends_update_involved
on public.friends
for update
to authenticated
using (user_id = auth.uid() or friend_user_id = auth.uid())
with check (user_id = auth.uid() or friend_user_id = auth.uid());

drop policy if exists friends_delete_involved on public.friends;
create policy friends_delete_involved
on public.friends
for delete
to authenticated
using (user_id = auth.uid() or friend_user_id = auth.uid());

-- Notification prefs: owner only
drop policy if exists notification_prefs_owner_select on public.notification_prefs;
create policy notification_prefs_owner_select
on public.notification_prefs
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists notification_prefs_owner_upsert on public.notification_prefs;
create policy notification_prefs_owner_upsert
on public.notification_prefs
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists notification_prefs_owner_update on public.notification_prefs;
create policy notification_prefs_owner_update
on public.notification_prefs
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Useful index for leaderboard queries
create index if not exists idx_attempts_puzzle_completed_final_time
  on public.attempts (puzzle_id, is_completed, final_time_ms)
  where is_completed = true;


