# WordCrack — In‑App Purchases (No RevenueCat)

This project uses **native StoreKit / Google Play Billing** in the app and stores **entitlements in Supabase** after **server-side validation**.

## 1) Product IDs (must match stores + Supabase)

These IDs are used by the app:

- `com.wordcrack.premium.monthly` (subscription)
- `com.wordcrack.premium.annual` (subscription)

They live in `src/purchases/products.ts`.

## 2) Supabase setup checklist

### A) Apply migrations

You’ve got a new migration:

- `supabase/migrations/0003_iap_entitlements.sql`

Apply it in your Supabase project (via CLI or Dashboard SQL editor).

### B) Seed `products`

Insert your products once:

```sql
insert into public.products (id, type) values
  ('com.wordcrack.premium.monthly','subscription'),
  ('com.wordcrack.premium.annual','subscription')
on conflict (id) do nothing;
```

### C) Deploy Edge Function: `validate-purchase`

This repo includes:

- `supabase/functions/validate-purchase`

Deploy it using the Supabase CLI.

### D) Set Edge Function secrets (required)

In Supabase, set function secrets:

- `APPLE_SHARED_SECRET` (App Store Connect “App-Specific Shared Secret” for auto-renewable subscriptions)

> Note: iOS validation currently uses Apple’s `verifyReceipt` endpoint and requires the shared secret for subscriptions. One-time purchases also validate with the receipt.

### E) (Android) Configure Google verification (required for Android prod)

`validate-purchase` currently **rejects Android verification** until configured.

To enable Android, you’ll need:

- A Google Play Console **service account** with access to the Android Publisher API
- Secrets like:
  - `GOOGLE_SERVICE_ACCOUNT_JSON` (the JSON key)
  - `GOOGLE_PACKAGE_NAME` (your Android package name)

Then implement Android Publisher API verification in `supabase/functions/validate-purchase/index.ts`.

## 3) App Store / Play Console checklist

### iOS (App Store Connect)

- Create the 3 products above (2 subscriptions + 1 non-consumable)
- Ensure the app has the In-App Purchase capability (EAS build / native build)
- Configure tax/banking and subscription metadata

### Android (Play Console)

- Create the products above
- Link your signing key / release tracks
- Enable Google Play Billing
- (For subscriptions) configure base plans / offers

## 4) App-side flow

- “Go Premium” triggers a store purchase via `react-native-iap`
- “Restore” pulls available purchases and calls `validate-purchase`
- `validate-purchase` grants/upserts `entitlements.premium_until`


