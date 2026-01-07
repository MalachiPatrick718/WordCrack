-- WordCrack v1.2 - native IAP (no RevenueCat): purchases + entitlements

create table if not exists public.products (
  id text primary key, -- store product id (e.g. wordcrack_premium_monthly)
  type text not null check (type in ('subscription','non_consumable')),
  created_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('ios','android')),
  product_id text not null references public.products(id) on delete restrict,
  -- iOS:
  original_transaction_id text,
  transaction_id text,
  receipt_base64 text,
  -- Android:
  order_id text,
  purchase_token text,
  package_name text,
  -- Common:
  purchase_time timestamptz,
  expires_at timestamptz,
  status text not null check (status in ('pending','active','expired','refunded','canceled')),
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_purchases_ios_original_tx_unique
  on public.purchases (platform, original_transaction_id)
  where platform = 'ios' and original_transaction_id is not null;

create unique index if not exists idx_purchases_android_token_unique
  on public.purchases (platform, purchase_token)
  where platform = 'android' and purchase_token is not null;

create table if not exists public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  premium_until timestamptz, -- null = not premium
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_purchases_updated_at on public.purchases;
create trigger trg_purchases_updated_at
before update on public.purchases
for each row execute function public.set_updated_at();

-- RLS
alter table public.products enable row level security;
alter table public.purchases enable row level security;
alter table public.entitlements enable row level security;

-- Products are readable by clients
drop policy if exists products_read_all on public.products;
create policy products_read_all
on public.products
for select
to anon, authenticated
using (true);

-- Purchases: user can read their own; server writes via service role
drop policy if exists purchases_select_own on public.purchases;
create policy purchases_select_own
on public.purchases
for select
to authenticated
using (user_id = auth.uid());

revoke insert, update, delete on table public.purchases from anon, authenticated;
grant select on table public.purchases to authenticated;

-- Entitlements: user can read their own; server writes via service role
drop policy if exists entitlements_select_own on public.entitlements;
create policy entitlements_select_own
on public.entitlements
for select
to authenticated
using (user_id = auth.uid());

revoke insert, update, delete on table public.entitlements from anon, authenticated;
grant select on table public.entitlements to authenticated;


