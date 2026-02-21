-- Add is_muted to friendships
-- When true: the person who set it won't see the friend's availability
-- and won't receive push notifications from them. Invisible to the friend.
ALTER TABLE friendships ADD COLUMN IF NOT EXISTS is_muted BOOLEAN NOT NULL DEFAULT FALSE;
