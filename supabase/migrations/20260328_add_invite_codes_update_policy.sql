-- Add missing UPDATE policy for invite_codes
-- Users should be able to update codes they created (mark as used)
CREATE POLICY "Users can update their own invite codes"
  ON invite_codes FOR UPDATE
  WITH CHECK ((select auth.uid()) = inviter_id)
  USING ((select auth.uid()) = inviter_id);
