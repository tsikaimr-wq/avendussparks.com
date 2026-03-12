-- SQL Migration to fix Supabase read permissions for the loans table
-- Run this in your Supabase SQL Editor if data is not appearing in the console

-- 1. Enable RLS on the table (if not already enabled)
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;

-- 2. Create a policy to allow anyone to read the data
-- This is useful for debugging to see if RLS was blocking the request.
DROP POLICY IF EXISTS "Allow public read loans" ON loans;
CREATE POLICY "Allow public read loans" ON loans FOR SELECT USING (true);
