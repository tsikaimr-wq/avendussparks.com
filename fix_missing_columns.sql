-- Add missing columns to 'deposits' table
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS method TEXT;
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS admin_note TEXT;
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE;

-- Add missing columns to 'withdrawals' table
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS admin_note TEXT;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE;

-- Add missing columns to 'users' table
ALTER TABLE users ADD COLUMN IF NOT EXISTS loan_enabled BOOLEAN DEFAULT FALSE;

-- Notify Supabase to refresh schema cache
NOTIFY pgrst, 'reload schema';
