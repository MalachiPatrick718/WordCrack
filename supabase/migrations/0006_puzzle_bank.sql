-- WordCrack v1.3 - Puzzle Bank
--
-- Goal:
-- - Keep theme hints aligned with target words by sourcing puzzles from a curated bank.
-- - Allow Edge Functions (service_role) to claim the next entry safely (no duplicates under concurrency).
--
-- Usage:
-- - Seed `public.puzzle_bank` from a local JSON file (see scripts/seed-puzzle-bank.js)
-- - `get-today-puzzle` can claim + create puzzles as needed.

create table if not exists public.puzzle_bank (
  id bigserial primary key,
  target_word text not null unique check (public.is_upper_alpha_6(target_word)),
  theme_hint text not null,
  enabled boolean not null default true,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.puzzles
  add column if not exists bank_id bigint references public.puzzle_bank(id);

create or replace function public.claim_puzzle_bank_entry()
returns table(id bigint, target_word text, theme_hint text)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Pick the least-recently-used enabled entry (never-used first), safely under concurrency.
  return query
  with picked as (
    select pb.id
    from public.puzzle_bank pb
    where pb.enabled = true
    order by pb.last_used_at nulls first, pb.id
    limit 1
    for update skip locked
  )
  update public.puzzle_bank pb
  set last_used_at = now()
  from picked
  where pb.id = picked.id
  returning pb.id, pb.target_word, pb.theme_hint;
end;
$$;

-- Lock down: clients should never be able to claim bank entries.
revoke all on function public.claim_puzzle_bank_entry() from public;
grant execute on function public.claim_puzzle_bank_entry() to service_role;

