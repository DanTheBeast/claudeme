-- Fix RLS performance issues: Cache auth.uid() checks instead of re-evaluating per row
-- Paste this entire query into Supabase SQL Editor and run it

BEGIN;

ALTER POLICY "Users can insert their own profile" ON "public"."profiles"
WITH CHECK ((select auth.uid()) = id);

ALTER POLICY "Users can view their own friendships" ON "public"."friendships"
USING (((select auth.uid()) = user_id) OR ((select auth.uid()) = friend_id));

ALTER POLICY "Users can create friendships" ON "public"."friendships"
WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users can update friendships they're part of" ON "public"."friendships"
USING (((select auth.uid()) = user_id) OR ((select auth.uid()) = friend_id))
WITH CHECK (((select auth.uid()) = user_id) OR ((select auth.uid()) = friend_id));

ALTER POLICY "Users can delete their own friendships" ON "public"."friendships"
USING (((select auth.uid()) = user_id) OR ((select auth.uid()) = friend_id));

ALTER POLICY "Users can manage their own availability" ON "public"."availability_windows"
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users can update their own availability" ON "public"."availability_windows"
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users can delete their own availability" ON "public"."availability_windows"
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users manage own push tokens" ON "public"."push_tokens"
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users can insert their own invite codes" ON "public"."invite_codes"
WITH CHECK ((select auth.uid()) = inviter_id);

COMMIT;
