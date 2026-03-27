-- Add unique constraint to prevent code reuse race condition
-- Prevents two users from using the same code via constraint violation
ALTER TABLE invite_codes ADD CONSTRAINT unique_code_usage UNIQUE (code, used_by);

-- Index for faster lookups when checking if user has used codes
CREATE INDEX idx_invite_codes_used_by ON invite_codes(used_by);

-- Index for faster code lookups during redemption
CREATE INDEX idx_invite_codes_code ON invite_codes(code);
