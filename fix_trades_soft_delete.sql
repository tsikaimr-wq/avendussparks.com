-- SQL Migration to fix trades table soft delete
-- Run this in your Supabase SQL Editor

-- 1. Ensure soft delete column exists on the consolidated trades table
ALTER TABLE trades
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- 2. Fix any NULL values so records become visible again
UPDATE trades
SET is_deleted = FALSE
WHERE is_deleted IS NULL;

-- 3. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
