-- WordCrack v2.1 - Variant-specific word lengths
--
-- Requirements:
-- - Cipher puzzles: 5-letter words
-- - Scramble puzzles: 6-letter words
--
-- This migration updates validation helpers and adds variant-aware CHECK constraints.

-- (Re)introduce explicit helpers
create or replace function public.is_upper_alpha_5(s text)
returns boolean
language sql
immutable
as $$
  select s is not null
     and length(s) = 5
     and s = upper(s)
     and s ~ '^[A-Z]{5}$';
$$;

-- Drop old word constraints BEFORE changing `is_upper_alpha_6()`, otherwise any update touching existing
-- 5-letter rows could fail (old constraints reference is_upper_alpha_6 from the 5-letter era).
alter table public.puzzles
  drop constraint if exists puzzles_target_word_check,
  drop constraint if exists puzzles_cipher_word_check;

-- Drop old shape constraints BEFORE any UPDATEs, otherwise legacy puzzles with old letter_sets shapes will block backfills.
alter table public.puzzles
  drop constraint if exists puzzles_letter_sets_check,
  drop constraint if exists puzzles_start_idxs_valid;

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

-- Allow either 5x5 or 6x6 letter set shapes.
create or replace function public.validate_letter_sets(letter_sets jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  i int;
  n int;
  cols int;
begin
  if letter_sets is null or jsonb_typeof(letter_sets) <> 'array' then
    return false;
  end if;

  cols := jsonb_array_length(letter_sets);
  if cols <> 5 and cols <> 6 then
    return false;
  end if;

  for i in 0..(cols-1) loop
    if jsonb_typeof(letter_sets->i) <> 'array' then
      return false;
    end if;
    n := jsonb_array_length(letter_sets->i);
    -- Cipher uses 5 letters/col; Scramble uses 6 letters/col.
    if n <> cols then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

-- Allow either 5 or 6 start indices, with bounds 0..(len-1).
create or replace function public.validate_start_idxs(start_idxs jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  i int;
  len int;
  v int;
begin
  if start_idxs is null or jsonb_typeof(start_idxs) <> 'array' then
    return false;
  end if;

  len := jsonb_array_length(start_idxs);
  if len <> 5 and len <> 6 then
    return false;
  end if;

  for i in 0..(len-1) loop
    if jsonb_typeof(start_idxs->i) <> 'number' then
      return false;
    end if;
    v := (start_idxs->>i)::int;
    if v < 0 or v > (len-1) then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

-- Backfill existing rows so the new constraints can be applied.
-- Historically, ALL puzzles were 5 letters and defaulted to variant='scramble'.
-- We now map: 5-letter => cipher, 6-letter => scramble.
--
-- Important: some environments may already have created true cipher daily puzzles (variant='cipher').
-- In that case, converting legacy 5-letter 'scramble' rows to 'cipher' can violate the unique index
-- on (puzzle_date, puzzle_hour, variant) for daily puzzles. We delete the legacy rows that would collide.

delete from public.puzzles p
where p.kind = 'daily'
  and p.variant = 'scramble'
  and length(p.target_word) = 5
  and length(p.cipher_word) = 5
  and exists (
    select 1
    from public.puzzles c
    where c.kind = 'daily'
      and c.puzzle_date = p.puzzle_date
      and c.puzzle_hour = p.puzzle_hour
      and c.variant = 'cipher'
  );

update public.puzzles
set variant = case
  when length(target_word) = 6 and length(cipher_word) = 6 then 'scramble'
  when length(target_word) = 5 and length(cipher_word) = 5 then 'cipher'
  else variant
end;

-- Defensive fallback: any remaining invalid variant rows get mapped to cipher so we can add constraints.
update public.puzzles
set variant = 'cipher'
where variant not in ('cipher','scramble')
   or variant is null;

-- Remove any legacy puzzles whose shapes don't match the new required formats (they will be regenerated on demand).
delete from public.puzzles
where
  -- word length must match variant
  not (
    (variant = 'cipher' and length(target_word) = 5 and length(cipher_word) = 5)
    or
    (variant = 'scramble' and length(target_word) = 6 and length(cipher_word) = 6)
  )
  or
  -- letter sets must be a perfect 5x5 or 6x6 grid
  not public.validate_letter_sets(letter_sets)
  or
  -- start idxs shape must be valid when present
  (start_idxs is not null and not public.validate_start_idxs(start_idxs));

alter table public.puzzles
  add constraint puzzles_target_word_by_variant check (
    (variant = 'cipher' and public.is_upper_alpha_5(target_word))
    or
    (variant = 'scramble' and public.is_upper_alpha_6(target_word))
  ),
  add constraint puzzles_cipher_word_by_variant check (
    (variant = 'cipher' and public.is_upper_alpha_5(cipher_word))
    or
    (variant = 'scramble' and public.is_upper_alpha_6(cipher_word))
  );

-- Ensure letter_sets/start_idxs match the expected shape for the variant.
alter table public.puzzles
  drop constraint if exists puzzles_letter_sets_by_variant,
  add constraint puzzles_letter_sets_by_variant check (
    (variant = 'cipher' and jsonb_array_length(letter_sets) = 5 and public.validate_letter_sets(letter_sets))
    or
    (variant = 'scramble' and jsonb_array_length(letter_sets) = 6 and public.validate_letter_sets(letter_sets))
  );

alter table public.puzzles
  drop constraint if exists puzzles_start_idxs_by_variant,
  add constraint puzzles_start_idxs_by_variant check (
    start_idxs is null
    or
    (variant = 'cipher' and jsonb_array_length(start_idxs) = 5 and public.validate_start_idxs(start_idxs))
    or
    (variant = 'scramble' and jsonb_array_length(start_idxs) = 6 and public.validate_start_idxs(start_idxs))
  );

