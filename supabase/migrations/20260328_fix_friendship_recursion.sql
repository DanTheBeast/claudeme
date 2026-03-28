-- Fix infinite recursion in friendships RLS policy
-- The "limit outgoing pending requests" policy tries to COUNT(*) from friendships
-- during an INSERT, which causes recursion.
-- Solution: Replace RLS with a trigger that enforces the limit

-- Drop the problematic RLS policy
DROP POLICY IF EXISTS "limit outgoing pending requests" ON public.friendships;

-- Create a trigger function to enforce the rate limit
CREATE OR REPLACE FUNCTION check_friendship_request_limit()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the user already has 20 or more pending requests
  IF (SELECT COUNT(*) FROM public.friendships 
      WHERE user_id = NEW.user_id AND status = 'pending') >= 20 THEN
    RAISE EXCEPTION 'User has reached the maximum number of pending friend requests (20)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS check_friendship_request_limit_trigger ON public.friendships;
CREATE TRIGGER check_friendship_request_limit_trigger
BEFORE INSERT ON public.friendships
FOR EACH ROW
EXECUTE FUNCTION check_friendship_request_limit();
