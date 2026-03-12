-- FIX SUPABASE ADMINS TABLE SCHEMA
-- Add full_name column with strict constraints
ALTER TABLE admins ADD COLUMN IF NOT EXISTS full_name TEXT DEFAULT '';

-- Update existing rows to use username as full_name where missing
UPDATE admins SET full_name = username WHERE full_name IS NULL OR full_name = '';

-- Enforce NOT NULL constraint
ALTER TABLE admins ALTER COLUMN full_name SET NOT NULL;

-- Note: In Supabase, you may need to go to Settings -> API -> "Reload PostgREST Schema" 
-- if the column doesn't appear immediately in the API.
