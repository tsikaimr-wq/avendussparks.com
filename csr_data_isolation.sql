-- Add invitation_code to admins table
ALTER TABLE admins ADD COLUMN IF NOT EXISTS invitation_code TEXT UNIQUE;

-- Add csr_id to users table to link them to a CSR
ALTER TABLE users ADD COLUMN IF NOT EXISTS csr_id INTEGER REFERENCES admins(id);

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_users_csr_id ON users(csr_id);
CREATE INDEX IF NOT EXISTS idx_admins_invitation_code ON admins(invitation_code);
