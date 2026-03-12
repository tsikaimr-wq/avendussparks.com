-- SQL Migration to support soft-delete for loan records
-- Run this in your Supabase SQL Editor

-- 1. Create the column if it doesn't exist
ALTER TABLE loans 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- 2. Update existing rows to ensure they are visible
UPDATE loans
SET is_deleted = false
WHERE is_deleted IS NULL;

-- 3. Enabling RLS or other policies if needed (Optional)
-- No changes to existing policies required as the logic is handled in the application layer.
