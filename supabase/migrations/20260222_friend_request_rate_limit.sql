-- Rate-limit outgoing friend requests to 20 pending at a time.
-- Prevents spam from both the app and direct API calls.
-- The check runs server-side on every INSERT so it cannot be bypassed client-side.

CREATE POLICY "limit outgoing pending requests"
ON public.friendships
FOR INSERT
WITH CHECK (
  (
    SELECT COUNT(*)
    FROM public.friendships
    WHERE user_id = (SELECT auth.uid())
      AND status = 'pending'
  ) < 20
);
