-- Fix ON CONFLICT targets for purchases upserts
-- PostgREST upsert uses `on_conflict=col1,col2` which requires a *non-partial* unique index/constraint.
-- Our earlier partial unique indexes don't satisfy that, causing:
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"

begin;

-- Deduplicate any existing rows that would violate the new unique indexes (keep the most recently updated).
with ranked as (
  select
    id,
    row_number() over (
      partition by platform, original_transaction_id
      order by updated_at desc nulls last, created_at desc
    ) as rn
  from public.purchases
  where original_transaction_id is not null
)
delete from public.purchases p
using ranked r
where p.id = r.id and r.rn > 1;

with ranked as (
  select
    id,
    row_number() over (
      partition by platform, purchase_token
      order by updated_at desc nulls last, created_at desc
    ) as rn
  from public.purchases
  where purchase_token is not null
)
delete from public.purchases p
using ranked r
where p.id = r.id and r.rn > 1;

-- Drop older partial unique indexes if present.
drop index if exists public.idx_purchases_ios_original_tx_unique;
drop index if exists public.idx_purchases_android_token_unique;

-- Create non-partial unique indexes so ON CONFLICT (platform,original_transaction_id) works reliably.
create unique index if not exists idx_purchases_platform_original_tx_unique
  on public.purchases (platform, original_transaction_id);

create unique index if not exists idx_purchases_platform_purchase_token_unique
  on public.purchases (platform, purchase_token);

commit;

