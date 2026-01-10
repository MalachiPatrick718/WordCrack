-- WordCrack v1.8 - Global Rankings (average solve time across daily puzzles)
--
-- This view powers the "Global Rankings" section in the app.
-- It ranks users by their average final_time_ms across completed daily attempts.
-- Excludes gave-up attempts and non-daily puzzles.

drop view if exists public.global_rankings;

create view public.global_rankings as
select
  a.user_id,
  pr.username,
  pr.avatar_url,
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
group by a.user_id, pr.username, pr.avatar_url;

grant select on public.global_rankings to anon, authenticated;

