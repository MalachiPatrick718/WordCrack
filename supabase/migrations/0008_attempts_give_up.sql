-- WordCrack v1.5 - "Give Up" support
-- Marks attempts that were abandoned and should NOT appear on leaderboards or in stats.

alter table public.attempts
  add column if not exists gave_up boolean not null default false,
  add column if not exists gave_up_at timestamptz;

-- Recreate leaderboard view to exclude gave_up attempts
drop view if exists public.daily_leaderboard;

create view public.daily_leaderboard as
select
  p.puzzle_date,
  p.puzzle_hour,
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
  and a.mode = 'daily'
  and p.kind = 'daily'
  and coalesce(a.gave_up, false) = false;

grant select on public.daily_leaderboard to anon, authenticated;

