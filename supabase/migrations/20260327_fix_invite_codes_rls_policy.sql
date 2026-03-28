-- Fix invite_codes RLS policy to cache auth.uid()
-- The old policy used auth.uid() directly which could cause evaluation issues
-- The fix wraps it with (select auth.uid()) to cache the result

DROP POLICY IF EXISTS "Users can insert their own invite codes" ON invite_codes;

CREATE POLICY "Users can insert their own invite codes"
  ON invite_codes FOR INSERT
  WITH CHECK ((select auth.uid()) = inviter_id);
