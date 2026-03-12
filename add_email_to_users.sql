-- Add email and auth_id columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE;

-- Update existing users check if they have email (optional, but good practice)
-- CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
