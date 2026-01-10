-- WordCrack v1.9 - Separate puzzle banks for daily vs practice
--
-- We keep a single table but add `kind` so we can claim from different pools.

alter table public.puzzle_bank
  add column if not exists kind text not null default 'daily' check (kind in ('daily','practice'));

-- Index to support LRU selection within a bank kind.
create index if not exists idx_puzzle_bank_kind_lru
  on public.puzzle_bank (kind, enabled, last_used_at, id);

-- Update claim function to take a bank kind and only claim from that pool.
create or replace function public.claim_puzzle_bank_entry(p_kind text default 'daily')
returns table(id bigint, target_word text, theme_hint text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_kind is null or p_kind not in ('daily','practice') then
    raise exception 'Invalid kind: %', p_kind;
  end if;

  return query
  with picked as (
    select pb.id
    from public.puzzle_bank pb
    where pb.enabled = true
      and pb.kind = p_kind
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

revoke all on function public.claim_puzzle_bank_entry(text) from public;
grant execute on function public.claim_puzzle_bank_entry(text) to service_role;

