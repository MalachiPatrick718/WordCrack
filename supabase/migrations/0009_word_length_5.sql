-- WordCrack v1.6 - Switch to 5-letter words
--
-- Goals:
-- - Enforce 5-letter (A-Z) words for target_word/cipher_word and puzzle_bank.target_word
-- - Enforce letter_sets to be 5 columns, each exactly 5 letters (harder)
-- - Disable any existing puzzle_bank rows that are not 5 letters so generators can't claim them

-- IMPORTANT ORDERING NOTE:
-- `puzzle_bank.target_word` has a CHECK constraint referencing `public.is_upper_alpha_6(target_word)`.
-- If we change `is_upper_alpha_6()` to enforce 5 letters *before* we disable legacy rows, then any
-- UPDATE touching those legacy 6-letter rows will fail the CHECK constraint. So we disable them first.

-- Safety: prevent claiming legacy non-5-letter bank rows (run BEFORE tightening the check function)
update public.puzzle_bank
set enabled = false
where enabled = true
  and length(target_word) <> 5;

-- Keep the function name for compatibility with existing CHECK constraints.
create or replace function public.is_upper_alpha_6(s text)
returns boolean
language sql
immutable
as $$
  select s is not null
     and length(s) = 5
     and s = upper(s)
     and s ~ '^[A-Z]{5}$';
$$;

create or replace function public.validate_letter_sets(letter_sets jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  i int;
  n int;
begin
  if letter_sets is null or jsonb_typeof(letter_sets) <> 'array' then
    return false;
  end if;

  -- 5 columns for a 5-letter word
  if jsonb_array_length(letter_sets) <> 5 then
    return false;
  end if;

  for i in 0..4 loop
    if jsonb_typeof(letter_sets->i) <> 'array' then
      return false;
    end if;
    n := jsonb_array_length(letter_sets->i);
    -- exactly 5 letters per column (harder + consistent UI)
    if n <> 5 then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

