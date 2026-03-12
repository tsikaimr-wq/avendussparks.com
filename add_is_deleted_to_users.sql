-- SQL Migration to add is_deleted column to users table
-- Run this in your Supabase SQL Editor

-- 1. Add the column with a default value of FALSE
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- 2. Update existing records to ensure they have the FALSE value (optional in Postgres 11+)
UPDATE users 
SET is_deleted = FALSE 
WHERE is_deleted IS NULL;

-- 3. Reload PostgREST schema cache (optional but recommended)
NOTIFY pgrst, 'reload schema';
