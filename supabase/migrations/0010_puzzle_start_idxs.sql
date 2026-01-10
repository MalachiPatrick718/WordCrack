-- WordCrack v1.7 - Per-puzzle starting indices for letter columns
--
-- Goal: ensure the UI can start each column on a letter that is NOT the correct answer,
-- so users must cycle through letters.

create or replace function public.validate_start_idxs(start_idxs jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  i int;
  n int;
  v int;
begin
  if start_idxs is null or jsonb_typeof(start_idxs) <> 'array' then
    return false;
  end if;

  -- 5-letter puzzles
  if jsonb_array_length(start_idxs) <> 5 then
    return false;
  end if;

  for i in 0..4 loop
    if jsonb_typeof(start_idxs->i) <> 'number' then
      return false;
    end if;
    v := (start_idxs->>i)::int;
    if v < 0 or v > 4 then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

alter table public.puzzles
  add column if not exists start_idxs jsonb;

-- Optional constraint (allows null for older rows, but enforces shape when present)
alter table public.puzzles
  drop constraint if exists puzzles_start_idxs_valid;
alter table public.puzzles
  add constraint puzzles_start_idxs_valid check (start_idxs is null or public.validate_start_idxs(start_idxs));

-- Update public view to expose start_idxs (safe; doesn't reveal target word)
drop view if exists public.puzzles_public;

create view public.puzzles_public as
select
  id,
  puzzle_date,
  puzzle_hour,
  kind,
  cipher_word,
  letter_sets,
  start_idxs,
  theme_hint
from public.puzzles;

grant select on public.puzzles_public to anon, authenticated;

