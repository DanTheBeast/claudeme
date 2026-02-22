-- Add timezone to profiles so schedule windows can be correctly converted
-- between users in different timezones.
-- Defaults to UTC if not yet set (will be updated on first app load).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';
