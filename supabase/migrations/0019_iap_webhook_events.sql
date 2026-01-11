-- Track IAP webhook deliveries (Apple S2S + Google RTDN) for idempotency + debugging

create table if not exists public.iap_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('apple','google')),
  event_id text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  process_error text,
  raw jsonb not null
);

create unique index if not exists idx_iap_webhook_events_provider_event_unique
  on public.iap_webhook_events (provider, event_id);

-- RLS: only server should read/write these
alter table public.iap_webhook_events enable row level security;
revoke all on table public.iap_webhook_events from anon, authenticated;

