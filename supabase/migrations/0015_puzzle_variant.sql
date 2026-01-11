-- WordCrack v2.0 - Puzzle variants (cipher vs scramble)
--
-- Goal:
-- - Support two distinct hourly daily puzzles (cipher + scramble) in parallel.
-- - Keep practice puzzles supporting both variants as well.

alter table public.puzzles
  add column if not exists variant text not null default 'scramble' check (variant in ('cipher','scramble'));

-- Defensive backfill for any legacy rows (should be none since column is NOT NULL).
update public.puzzles
set variant = 'scramble'
where variant is null;

-- Daily puzzles must be unique per (date, hour, variant).
drop index if exists public.idx_puzzles_daily_date_hour_unique;
create unique index if not exists idx_puzzles_daily_date_hour_variant_unique
  on public.puzzles (puzzle_date, puzzle_hour, variant)
  where kind = 'daily';

-- Recreate public views to include variant (and ensure leaderboards can filter by it).
drop view if exists public.daily_leaderboard;
drop view if exists public.puzzles_public;

create view public.puzzles_public as
select
  id,
  puzzle_date,
  puzzle_hour,
  kind,
  variant,
  cipher_word,
  letter_sets,
  start_idxs,
  theme_hint
from public.puzzles;

create view public.daily_leaderboard as
select
  p.puzzle_date,
  p.puzzle_hour,
  p.variant,
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

grant select on public.puzzles_public to anon, authenticated;
grant select on public.daily_leaderboard to anon, authenticated;

