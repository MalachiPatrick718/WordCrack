-- WordCrack v1.2 - Hourly puzzles (UTC)
--
-- We keep `puzzle_date` (UTC date) but add `puzzle_hour` (UTC hour 0-23).
-- This allows one puzzle per hour and avoids rewriting the entire schema.

alter table public.puzzles
  add column if not exists puzzle_hour int not null default 0;

alter table public.puzzles
  drop constraint if exists puzzles_puzzle_date_key;

-- Defensive constraint
alter table public.puzzles
  drop constraint if exists puzzles_puzzle_hour_range;
alter table public.puzzles
  add constraint puzzles_puzzle_hour_range check (puzzle_hour >= 0 and puzzle_hour <= 23);

create unique index if not exists idx_puzzles_date_hour_unique
  on public.puzzles (puzzle_date, puzzle_hour);

-- Update public views to include the hour
-- NOTE: Postgres cannot "insert" a new column into an existing view with CREATE OR REPLACE VIEW
-- unless the column list matches (same names/order). So we drop + recreate.
drop view if exists public.daily_leaderboard;
drop view if exists public.puzzles_public;

create view public.puzzles_public as
select
  id,
  puzzle_date,
  puzzle_hour,
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
  and a.mode = 'daily';

-- Re-grant view access (drops reset privileges)
grant select on public.puzzles_public to anon, authenticated;
grant select on public.daily_leaderboard to anon, authenticated;
