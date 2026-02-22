-- Fix RLS performance: replace auth.uid() with (select auth.uid()) in profiles policy
-- This prevents re-evaluation of auth.uid() for every row scanned.
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

drop policy if exists "Users can update their own profile" on profiles;

create policy "Users can update their own profile"
  on profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
