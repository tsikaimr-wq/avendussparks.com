-- Add full_name to admins table for CSR management
ALTER TABLE admins ADD COLUMN IF NOT EXISTS full_name TEXT;
