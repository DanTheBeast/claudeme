-- Add available_until to profiles
-- NULL means available indefinitely (no auto-expiry)
-- A timestamp means auto-expire availability at that time
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS available_until TIMESTAMPTZ NULL;
