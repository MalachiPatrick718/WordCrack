-- WordCrack v2.3 - Allow authenticated users to INSERT their own profile row
--
-- Normally profiles are created by the `handle_new_user` trigger, but in rare cases
-- (migration drift / trigger disabled / legacy users) the app may need to create the row.

-- Privileges
grant insert, select, update on table public.profiles to authenticated;

-- RLS: allow inserting only your own row
alter table public.profiles enable row level security;

drop policy if exists profiles_owner_insert on public.profiles;
create policy profiles_owner_insert
on public.profiles
for insert
to authenticated
with check (user_id = auth.uid());

