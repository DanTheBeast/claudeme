-- Prevent users from sending friend requests to themselves at the DB level.
CREATE POLICY "no self friend requests"
ON public.friendships
FOR INSERT
WITH CHECK (
  (SELECT auth.uid()) != friend_id
);
