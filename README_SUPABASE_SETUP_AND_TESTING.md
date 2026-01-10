# WordCrack — Supabase Setup (from scratch) + Testing Guide

This guide assumes you’re starting with **no Supabase project yet**.

## 1) Create a Supabase project

- Go to the Supabase dashboard and **create a new project**
- Save these two values (you’ll use them in the app):
  - **Project URL** (looks like `https://xxxxx.supabase.co`)
  - If you paste URL/keys into this doc, avoid committing it publicly. The anon key is publishable, but still treat it as configuration (best stored via EAS/CI secrets for release builds).
  https://bqdsadzvihhvermeobiv.supabase.co
  - **Anon key** (public)
  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxZHNhZHp2aWhodmVybWVvYml2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3OTM5ODIsImV4cCI6MjA4MzM2OTk4Mn0.FQRX5bD-IK87eqTfk_9izwl6VEhOt9CE4zQzpuU29pM
  - (Keep your **Service Role key** private; it’s for Edge Functions only.)

## 2) Configure Auth

### A) Enable providers you need

In Supabase Dashboard → **Authentication**:
- **Anonymous / Guest**: enable anonymous sign-ins (required for Guest Mode in the app)
- **Email**: enable Email OTP (the app uses OTP right now)

### B) Set redirect URLs (optional for mobile OTP)

For OTP, mobile generally works without deep links, but if you later add magic-link redirects:
- Add your app scheme URLs / EAS URLs in **Auth → URL configuration**

## 3) Apply database migrations

You have migrations in:
- `WordCrack/supabase/migrations/0001_init.sql`
- `WordCrack/supabase/migrations/0002_attempts_constraints_and_indexes.sql`
- `WordCrack/supabase/migrations/0003_iap_entitlements.sql`

### Option 1 (simplest): run in Supabase SQL editor

Dashboard → **SQL Editor**:
- Paste and run each migration in order (0001 → 0002 → 0003)

### Option 2 (recommended): use Supabase CLI

Install Supabase CLI, then in `WordCrack/`:
- `supabase link` (link to your new project)
- `supabase db push` (applies migrations)

## 4) Seed required data

### A) Seed IAP products

Run this once:

```sql
insert into public.products (id, type) values
  ('wordcrack_premium_monthly','subscription'),
  ('wordcrack_premium_annual','subscription'),
  ('wordcrack_premium_lifetime','non_consumable')
on conflict (id) do nothing;
```

### B) Seed today’s puzzle (required to test gameplay)

You must insert a puzzle for **today’s UTC date**.

#### Recommended (Puzzle Bank)

To keep `theme_hint` aligned with `target_word`, maintain a curated bank in `puzzle_bank.json`, then seed it into Supabase:

```bash
cd "WordCrack"
SUPABASE_URL="https://<your-project-ref>.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<your service role key>" \
npm run seed:puzzle-bank
```

After that, `get-today-puzzle` will automatically claim the next bank entry and generate:
- `cipher_word` (random shift amount + some unshifted positions)
- `letter_sets` (decoys + the correct letter)

So you no longer need to run `admin-create-puzzle` for every new puzzle window.

#### Optional (hands‑off): Daily auto‑replenish via GitHub Actions

If you want **minimal involvement**, you can auto-add **30 new unique 5‑letter words** to Supabase daily (no file edits).

This repo includes:
- `WordCrack/scripts/replenish-puzzle-bank.js`
- `.github/workflows/replenish_puzzle_bank.yml`

Setup (GitHub):
1. Repo → **Settings → Secrets and variables → Actions** → add:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
2. The workflow runs daily at **03:00 UTC** (edit the cron in `.github/workflows/replenish_puzzle_bank.yml`).
3. You can also run it manually: **Actions → Replenish WordCrack Puzzle Bank → Run workflow**.

#### Recommended (admin function)

Deploy `admin-create-puzzle`, set the secret `ADMIN_PUZZLE_KEY`, then create today’s puzzle like:

```bash
curl -i -X POST \
  -H "x-admin-key: <ADMIN_PUZZLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"target_word":"LETTER","theme_hint":"Space object"}' \
  "https://bqdsadzvihhvermeobiv.supabase.co/functions/v1/admin-create-puzzle"
```

This will:
- Choose a **random shift amount** (same for the whole puzzle) and a direction (server-only)
- Choose some **unshifted positions**
- Generate `cipher_word` and 6×5 `letter_sets` that always allow forming the target word

Example:

```sql
insert into public.puzzles (puzzle_date, target_word, cipher_word, letter_sets, theme_hint)
values (
  (now() at time zone 'utc')::date,
  'PLANET',
  'PLXNET',
  '[
    ["P","Q","R","S"],
    ["L","I","T","O","A"],
    ["A","X","E","O"],
    ["N","M","H","U","X"],
    ["E","T","R","O"],
    ["T","S","D","L"]
  ]'::jsonb,
  'Theme: Space / Astronomy'
)
on conflict (puzzle_date) do nothing;
```

Notes:
- `target_word` must be **6 uppercase letters**.
- `cipher_word` must be **6 uppercase letters**.
- `letter_sets` must be a JSON array of length 6, each inner array length 4–5.

## 5) Deploy Edge Functions

Your app calls these functions:
- `get-today-puzzle`
- `start-attempt`
- `use-hint`
- `submit-attempt`
- `get-daily-leaderboard`
- `get-friends-leaderboard`
- `add-friend-by-invite-code`
- `get-my-stats`
- `validate-purchase` (IAP entitlement)
- `get-practice-puzzle` (premium practice)

### Deploy (CLI)

From `WordCrack/`:
- `supabase functions deploy get-today-puzzle`
- `supabase functions deploy start-attempt`
- `supabase functions deploy use-hint`
- `supabase functions deploy submit-attempt`
- `supabase functions deploy get-daily-leaderboard`
- `supabase functions deploy get-friends-leaderboard`
- `supabase functions deploy add-friend-by-invite-code`
- `supabase functions deploy get-my-stats`
- `supabase functions deploy validate-purchase`
- `supabase functions deploy get-practice-puzzle`

#### Important: JWT verification flag

If you see `401 Invalid JWT` from auth-required functions even when signed in, deploy with **gateway JWT verification disabled**:

```bash
supabase functions deploy <fn-name> --no-verify-jwt
```

This repo includes `supabase/config.toml` that sets `verify_jwt = false` for all WordCrack functions, because we validate auth inside the function (via `requireUser()`).

## 6) Configure Edge Function secrets

### Required (iOS IAP validation)

Set:
- `APPLE_SHARED_SECRET`

CLI:
- `supabase secrets set APPLE_SHARED_SECRET="..." --project-ref <your_ref>`

### Android IAP validation (Google Play verification)

Android verification is supported via the Google Play Developer API, but you must set:

- `GOOGLE_SERVICE_ACCOUNT_JSON` (the full service account JSON key)

And make sure:
- The service account has access to your Play Console app
- The **Android Publisher API** is enabled for that Google Cloud project

## 7) Configure the app to point at your Supabase project

Edit:
- `WordCrack/app.json` → `expo.extra.supabaseUrl`
- `WordCrack/app.json` → `expo.extra.supabaseAnonKey`

Then restart Expo:
- `npm run start`

## 7.1) Fix Email OTP / confirmation emails (Supabase Auth SMTP)

If you see **"Error sending confirmation email"** when tapping **Send OTP**, your Supabase project cannot deliver emails yet.

### Option A (recommended): Resend via SMTP

In **Supabase Dashboard**:
- Authentication → **SMTP Settings** → enable custom SMTP and set:
  - **Host**: `smtp.resend.com`
  - **Port**: `465` (TLS) or `587` (STARTTLS)
  - **Username**: `resend`
  - **Password**: your **Resend API key** (starts with `re_...`)  ← this is the "SMTP password"
  - **Sender name**: `WordCrack`
  - **Sender email**: an address from a **verified domain** in Resend (example: `no-reply@yourdomain.com`)

In **Resend Dashboard**:
- Verify your sending domain (DNS records) and use that domain in the **Sender email** above.

### Option B (quick test): use Resend’s default sender

If you don’t have a domain verified yet, temporarily set the Sender email to a Resend-provided address (e.g. `onboarding@resend.dev`) to confirm the OTP flow works, then switch to your domain later.

## 7.2) Make Email OTP send a 6‑digit code (not a link)

In Supabase, `signInWithOtp()` **sends a Magic Link by default** unless your email templates include the OTP token.

To make your emails contain a **6‑digit code** (so it matches the app UI):

In **Supabase Dashboard**:
- Authentication → **Email Templates**
- Update these templates to use `{{ .Token }}` instead of `{{ .ConfirmationURL }}`:

**Magic Link** template (for returning users):

```html
<h2>WordCrack login code</h2>
<p>Enter this code in the app:</p>
<p style="font-size: 24px; font-weight: 800; letter-spacing: 2px;">{{ .Token }}</p>
```

**Confirm Signup** template (for first-time signups / email confirmation):

```html
<h2>Confirm your WordCrack email</h2>
<p>Enter this code in the app to finish signing in:</p>
<p style="font-size: 24px; font-weight: 800; letter-spacing: 2px;">{{ .Token }}</p>
```

After this, when you tap **Send OTP**, the email will contain the 6‑digit code and you can complete sign-in using `verifyOtp({ email, token, type: "email" })` (which the app already does).

### Optional: make the emails look nicer (subject + emojis)

In **Supabase Dashboard → Authentication → Email Templates**, you can edit the **Subject** and **Body**.

Here’s a ready-to-paste **Confirm Signup** template (uses the 6‑digit OTP and includes the 🧩 emoji):

- **Subject**:
  - `🧩 WordCrack — Confirm your email`

- **Body (HTML)**:

```html
<div style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
  <h2 style="margin: 0 0 8px 0;">🧩 Welcome to WordCrack!</h2>
  <p style="margin: 0 0 16px 0; color: #334155;">
    Enter this code in the app to confirm your email and start cracking today's puzzle.
  </p>

  <div
    style="
      display: inline-block;
      background: #0b2a4a;
      color: #ffffff;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: 4px;
    "
  >
    {{ .Token }}
  </div>

  <p style="margin: 16px 0 0 0; color: #64748b; font-size: 12px;">
    This code expires soon. If you didn’t request it, you can ignore this email.
  </p>
</div>
```

Tip: you can also update the **Magic Link** template to the same style + subject (for returning users who request a code).

## 8) Testing (Backend + App)

## Note about `supabase/migrations/0000_fix_all.sql`

If `supabase db push` tells you:
> Found local migration files to be inserted before the last migration on remote database

and lists `0000_fix_all.sql`, that file is a **manual “fix-all” script**, not a true migration.

To apply migrations to your hosted Supabase project, use the ordered migrations (`0001_...`, `0002_...`, etc).
If you keep `0000_fix_all.sql` in the migrations folder, you’ll need to run:
- `supabase db push --include-all`

Otherwise, remove/move that file out of the migrations folder and run:
- `supabase db push`

## 8.1) Build & run on real devices (iPhone + Android)

Because this app uses **native modules** (notably `react-native-iap`), you should **NOT** use Expo Go for testing purchases. Use an **Expo Dev Build**.

### A) One-time setup (bundle IDs)

Edit `WordCrack/app.json` and set:
- `expo.ios.bundleIdentifier` (example: `com.wordcrack.app`)
- `expo.android.package` (example: `com.wordcrack.app`)

These must match what you’ll create in **App Store Connect** and **Play Console** for IAP.

### B) Create an EAS development build

Install EAS CLI:

```bash
npm i -g eas-cli
eas login
```

From `WordCrack/`:

```bash
cd "/Users/malachi/Word Crack/WordCrack"
eas build:configure
```

Build dev clients:

```bash
eas build --profile development --platform ios
eas build --profile development --platform android
```

Install on devices:
- iOS: install the build via the link/QR EAS provides (requires Apple dev account/device registration)
- Android: download and install the APK/AAB provided by EAS

### C) Run the app against your dev server

Start Metro in dev-client mode:

```bash
cd "/Users/malachi/Word Crack/WordCrack"
npm run start -- --dev-client
```

Open the installed **WordCrack Dev** app on your phone(s). It should connect to Metro automatically on the same Wi‑Fi.

### A) Quick “does the backend work?” test (no IAP)

1) Sign in (Guest is easiest).
2) Tap **Play Today**.
3) Confirm puzzle loads (cipher word + 6 columns).
4) Tap **Hint** 3 times max (penalty increases immediately).
5) Submit until correct (you must match the seeded `target_word`, but the app doesn’t show it).
6) Check **Leaderboards** (daily entries should appear after completion).
7) Check **Stats** (streak/best/avg will populate after at least 1 completion).

If puzzle doesn’t load:
- Ensure today’s `puzzles.puzzle_date` matches **UTC date**.
- Ensure `get-today-puzzle` is deployed.

### B) Local Supabase testing (recommended for iteration)

Use Supabase CLI:
- `supabase start`
- Apply migrations locally
- Seed puzzle locally

Then point the app to the local Supabase URL/anon key (or use a dev project).

### C) Testing iOS purchases (Sandbox)

Prereqs:
- Your iOS `bundleIdentifier` in `app.json` must match the app record in App Store Connect.

1) In App Store Connect:
   - Create the products with IDs in `src/purchases/products.ts`
   - Create a **Sandbox Tester** account
2) Build a dev client / internal build (Expo Go won’t support IAP reliably):
   - Use EAS Dev Build or a local run
3) On device:
   - Sign into the **Sandbox** account when prompted during purchase
4) In the app:
   - Settings → Purchases → **Go Premium**
   - Then **Restore** (calls `validate-purchase` and updates Supabase entitlement)

What “success” looks like:
- `public.purchases` gets a row (platform = ios)
- `public.entitlements.premium_until` is set (future date for subs, far-future for lifetime)

### D) Testing Android purchases
Prereqs:
- Your Android `package` in `app.json` must match the Play Console app.
- You must install the app from an **internal testing** track (Play Store), not a random sideloaded APK, for reliable billing testing.

Steps:
1) In Play Console:
   - Create the same product IDs from `src/purchases/products.ts`
   - Add your testers (license testers / internal testing list)
2) Upload a build to an **Internal testing** track and install it from Play Store.
3) In Supabase secrets set:
   - `GOOGLE_SERVICE_ACCOUNT_JSON`
4) In the app:
   - Settings → Purchases → Go Premium

Success:
- `public.purchases` gets a row (platform = android)
- `public.entitlements.premium_until` is set


