-- WordCrack v1.4 - Support practice puzzles stored in `puzzles` safely
--
-- We add `puzzles.kind` so:
-- - Daily puzzles remain unique per (puzzle_date, puzzle_hour)
-- - Practice puzzles can be created on-demand without violating uniqueness

alter table public.puzzles
  add column if not exists kind text not null default 'daily' check (kind in ('daily','practice'));

-- Replace global uniqueness with a partial unique index for daily only.
drop index if exists public.idx_puzzles_date_hour_unique;
create unique index if not exists idx_puzzles_daily_date_hour_unique
  on public.puzzles (puzzle_date, puzzle_hour)
  where kind = 'daily';

-- Recreate public views to include kind (and ensure leaderboards only show daily puzzles).
drop view if exists public.daily_leaderboard;
drop view if exists public.puzzles_public;

create view public.puzzles_public as
select
  id,
  puzzle_date,
  puzzle_hour,
  kind,
  cipher_word,
  letter_sets,
  theme_hint
from public.puzzles;

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
  and p.kind = 'daily';

grant select on public.puzzles_public to anon, authenticated;
grant select on public.daily_leaderboard to anon, authenticated;
