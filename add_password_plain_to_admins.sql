-- PART 1: Database Update for Plain Password Storage
ALTER TABLE admins ADD COLUMN IF NOT EXISTS password_plain TEXT DEFAULT '';

-- Optional: Update existing rows if any
-- UPDATE admins SET password_plain = '******' WHERE role = 'csr';
