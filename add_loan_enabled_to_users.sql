-- Add 'loan_enabled' column to 'users' table if it doesn't already exist
-- This column controls user eligibility for the loan feature
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS loan_enabled BOOLEAN DEFAULT FALSE;

-- Ensure the column can be updated by all roles that have access to the users table
-- (Assuming RLS is handled or disabled as per previous schema logs)

-- Refresh PostgREST schema cache to recognize the new column immediately
NOTIFY pgrst, 'reload schema';

-- Verification Query (Manual Step)
-- SELECT id, username, loan_enabled FROM users LIMIT 10;
