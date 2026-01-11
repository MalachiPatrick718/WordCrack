-- WordCrack v2.2 - Puzzle bank variants (cipher vs scramble)
--
-- We keep a single `puzzle_bank` table and add `variant` so we can claim the right pool.
-- Cipher pool = 5-letter words, Scramble pool = 6-letter words.

alter table public.puzzle_bank
  add column if not exists variant text not null default 'cipher' check (variant in ('cipher','scramble'));

-- Enforce target_word length by variant.
alter table public.puzzle_bank
  drop constraint if exists puzzle_bank_target_word_check;

-- Remove any legacy rows that aren't 5 or 6 letters (they can't satisfy the new constraint).
delete from public.puzzle_bank
where length(target_word) not in (5, 6);

-- Backfill variant for existing rows now that the legacy constraint is dropped.
update public.puzzle_bank
set variant = case
  when length(target_word) = 6 then 'scramble'
  else 'cipher'
end;

alter table public.puzzle_bank
  add constraint puzzle_bank_target_word_by_variant check (
    (variant = 'cipher' and public.is_upper_alpha_5(target_word))
    or
    (variant = 'scramble' and public.is_upper_alpha_6(target_word))
  );

-- Replace claim function to include variant filtering.
create or replace function public.claim_puzzle_bank_entry(p_kind text default 'daily', p_variant text default 'cipher')
returns table(id bigint, target_word text, theme_hint text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_kind is null or p_kind not in ('daily','practice') then
    raise exception 'Invalid kind: %', p_kind;
  end if;
  if p_variant is null or p_variant not in ('cipher','scramble') then
    raise exception 'Invalid variant: %', p_variant;
  end if;

  return query
  with picked as (
    select pb.id
    from public.puzzle_bank pb
    where pb.enabled = true
      and pb.kind = p_kind
      and pb.variant = p_variant
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

revoke all on function public.claim_puzzle_bank_entry(text,text) from public;
grant execute on function public.claim_puzzle_bank_entry(text,text) to service_role;

