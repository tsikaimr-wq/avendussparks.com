-- Add invitation_code to users table to store the code used during registration
ALTER TABLE users ADD COLUMN IF NOT EXISTS invitation_code TEXT;

-- Create index for faster searching if needed
CREATE INDEX IF NOT EXISTS idx_users_invitation_code ON users(invitation_code);
