-- WordCrack v1.1 - attempts safety constraints & indexes

-- Enforce: only one daily attempt per user per puzzle
create unique index if not exists idx_attempts_daily_unique
  on public.attempts (user_id, puzzle_id)
  where mode = 'daily';

-- Enforce: max 3 hints per attempt (defense-in-depth; server enforces too)
alter table public.attempts
  drop constraint if exists attempts_hints_max_3;
alter table public.attempts
  add constraint attempts_hints_max_3 check (jsonb_array_length(hints_used) <= 3);

-- Enforce non-negative timings when present
alter table public.attempts
  drop constraint if exists attempts_solve_time_nonneg;
alter table public.attempts
  add constraint attempts_solve_time_nonneg check (solve_time_ms is null or solve_time_ms >= 0);

alter table public.attempts
  drop constraint if exists attempts_final_time_nonneg;
alter table public.attempts
  add constraint attempts_final_time_nonneg check (final_time_ms is null or final_time_ms >= 0);

-- Helpful indexes for friends + leaderboard lookups
create index if not exists idx_friends_user_status on public.friends (user_id, status);
create index if not exists idx_friends_friend_status on public.friends (friend_user_id, status);


