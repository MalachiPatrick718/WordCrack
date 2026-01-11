-- WordCrack v1.x - Optional user location for leaderboards (e.g., "CA", "Austin, TX")
-- Stored on profiles and exposed via public leaderboard views.

alter table public.profiles
  add column if not exists location text;

-- Keep it lightweight + safe (optional field).
alter table public.profiles
  drop constraint if exists profiles_location_len_check,
  add constraint profiles_location_len_check check (location is null or length(location) <= 48);

-- IMPORTANT:
-- `profiles_public` is depended on by leaderboard/rankings views, so we must drop dependents first.
drop view if exists public.daily_leaderboard;
drop view if exists public.global_rankings;

-- Recreate public profile view (adds `location`).
drop view if exists public.profiles_public;
create view public.profiles_public as
select
  user_id,
  username,
  avatar_url,
  location
from public.profiles;

grant select on public.profiles_public to anon, authenticated;

-- Recreate leaderboard view (adds `location`).
create view public.daily_leaderboard as
select
  p.puzzle_date,
  p.puzzle_hour,
  a.puzzle_id,
  a.user_id,
  pr.username,
  pr.avatar_url,
  pr.location,
  a.final_time_ms,
  a.penalty_ms,
  jsonb_array_length(a.hints_used) as hints_used_count
from public.attempts a
join public.puzzles p on p.id = a.puzzle_id
join public.profiles_public pr on pr.user_id = a.user_id
where a.is_completed = true
  and a.mode = 'daily'
  and p.kind = 'daily'
  and coalesce(a.gave_up, false) = false;

grant select on public.daily_leaderboard to anon, authenticated;

-- Recreate global rankings view (adds `location`).
create or replace view public.global_rankings as
select
  a.user_id,
  pr.username,
  pr.avatar_url,
  pr.location,
  count(*)::int as puzzles_solved,
  avg(a.final_time_ms)::int as avg_final_time_ms
from public.attempts a
join public.puzzles p on p.id = a.puzzle_id
join public.profiles_public pr on pr.user_id = a.user_id
where a.is_completed = true
  and a.mode = 'daily'
  and coalesce(a.gave_up, false) = false
  and a.final_time_ms is not null
  and p.kind = 'daily'
group by a.user_id, pr.username, pr.avatar_url, pr.location;

grant select on public.global_rankings to anon, authenticated;

