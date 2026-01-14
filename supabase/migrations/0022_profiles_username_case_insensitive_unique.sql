-- Enforce case-insensitive unique usernames and normalize existing data.
-- This prevents "Bob" and "bob" from being treated as different usernames.

-- 1) Normalize to lowercase (best-effort) and resolve any case-collisions deterministically.
-- If duplicates exist after lowercasing, keep the earliest profile and suffix the rest
-- with a stable user_id-based suffix.
with ranked as (
  select
    user_id,
    lower(username) as base_username,
    row_number() over (partition by lower(username) order by created_at asc, user_id asc) as rn
  from public.profiles
),
updates as (
  select
    user_id,
    case
      when rn = 1 then base_username
      else base_username || '_' || substr(replace(user_id::text, '-', ''), 1, 6)
    end as new_username
  from ranked
)
update public.profiles p
set username = u.new_username
from updates u
where p.user_id = u.user_id
  and p.username is distinct from u.new_username;

-- 2) Enforce lowercase going forward (defense-in-depth).
alter table public.profiles
  drop constraint if exists profiles_username_lowercase;

alter table public.profiles
  add constraint profiles_username_lowercase check (username = lower(username));

-- 3) Enforce uniqueness case-insensitively.
create unique index if not exists idx_profiles_username_lower_unique
  on public.profiles (lower(username));

