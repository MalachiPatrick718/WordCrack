-- WordCrack v1.x - User feedback
-- Insert-only from clients (via Edge Function or direct insert), review in Supabase Dashboard.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  category text,
  rating int,
  message text not null,
  context jsonb not null default '{}'::jsonb
);

-- Basic validation
alter table public.feedback
  drop constraint if exists feedback_category_len_check,
  add constraint feedback_category_len_check check (category is null or length(category) <= 32);

alter table public.feedback
  drop constraint if exists feedback_message_len_check,
  add constraint feedback_message_len_check check (length(message) between 1 and 4000);

alter table public.feedback
  drop constraint if exists feedback_rating_range_check,
  add constraint feedback_rating_range_check check (rating is null or (rating >= 1 and rating <= 5));

create index if not exists feedback_user_id_created_at_idx on public.feedback (user_id, created_at desc);
create index if not exists feedback_created_at_idx on public.feedback (created_at desc);

-- Lock down base table access.
revoke all on table public.feedback from anon, authenticated;

-- RLS: allow users to insert their own feedback rows.
alter table public.feedback enable row level security;

drop policy if exists feedback_insert_own on public.feedback;
create policy feedback_insert_own
on public.feedback
for insert
to authenticated
with check (user_id = auth.uid());

-- No client selects/updates/deletes (review via service_role / dashboard).
