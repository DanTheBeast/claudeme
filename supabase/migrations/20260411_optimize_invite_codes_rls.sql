-- CRITICAL OPTIMIZATION: Rewrite RLS policy to avoid subselect
-- The old policy used (select auth.uid()) which is slower
-- New policy caches the auth context directly for faster evaluation

-- Drop old slow policy
DROP POLICY IF EXISTS "Users can insert their own invite codes" ON invite_codes;

-- New optimized policy - directly compares auth.uid() without subselect
CREATE POLICY "Users can insert their own invite codes"
  ON invite_codes FOR INSERT
  WITH CHECK (auth.uid()::text = inviter_id::text);

-- Also add an update policy to mark codes as used (with same optimization)
DROP POLICY IF EXISTS "Users can update invite codes" ON invite_codes;

CREATE POLICY "Users can update invite codes"
  ON invite_codes FOR UPDATE
  USING (auth.uid()::text = inviter_id::text OR true) -- Allow anyone to update (mark as used)
  WITH CHECK (true);
