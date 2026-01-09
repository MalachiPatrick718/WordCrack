-- Allow signed-in users to read/update their own profile.
-- Row-level security policies still restrict access to `auth.uid()` only.

grant select, update on table public.profiles to authenticated;

