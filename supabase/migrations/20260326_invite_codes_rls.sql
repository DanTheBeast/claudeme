-- Allow users to insert their own invite codes
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can insert their own invite codes" ON invite_codes;
DROP POLICY IF EXISTS "Users can read invite codes to redeem them" ON invite_codes;

-- Policy: Users can insert their own invite codes (inviter_id must match their id)
CREATE POLICY "Users can insert their own invite codes"
  ON invite_codes FOR INSERT
  WITH CHECK ((select auth.uid()) = inviter_id);

-- Policy: Anyone can read invite codes to validate/redeem them
CREATE POLICY "Anyone can read invite codes"
  ON invite_codes FOR SELECT
  USING (true);
