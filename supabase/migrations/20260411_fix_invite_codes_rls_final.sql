-- FINAL FIX: Clean up and fix the invite_codes RLS policies
-- The problem: Multiple conflicting policies from previous migrations
-- Solution: Drop all and create one clean, simple policy that works

-- Drop ALL old policies to start fresh
DROP POLICY IF EXISTS "Users can insert their own invite codes" ON invite_codes;
DROP POLICY IF EXISTS "Anyone can read invite codes" ON invite_codes;
DROP POLICY IF EXISTS "Users can update their own invite codes" ON invite_codes;
DROP POLICY IF EXISTS "Users can update invite codes" ON invite_codes;
DROP POLICY IF EXISTS "public can read invite codes" ON invite_codes;

-- Create ONE simple, working INSERT policy
-- Compare UUIDs directly without subselect (faster and more reliable)
CREATE POLICY "insert_own_codes"
  ON invite_codes FOR INSERT
  WITH CHECK (auth.uid() = inviter_id);

-- Create ONE simple SELECT policy - anyone can read (to redeem)
CREATE POLICY "read_any_code"
  ON invite_codes FOR SELECT
  USING (true);

-- Create UPDATE policy so users can mark their codes as used
CREATE POLICY "update_own_codes"
  ON invite_codes FOR UPDATE
  WITH CHECK (auth.uid() = inviter_id);
