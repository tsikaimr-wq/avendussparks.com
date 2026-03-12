-- 1. Ensure Table Structure (Adds columns if missing)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admins' AND column_name='role') THEN
        ALTER TABLE admins ADD COLUMN role TEXT DEFAULT 'super_admin';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admins' AND column_name='status') THEN
        ALTER TABLE admins ADD COLUMN status TEXT DEFAULT 'active';
    END IF;
END $$;

-- 2. Create CSR Account
-- Username: csr1
-- Password: 123456
-- Role: csr
-- Status: active
INSERT INTO admins (username, password, role, status) 
VALUES ('csr1', '123456', 'csr', 'active')
ON CONFLICT (username) DO UPDATE 
SET password = '123456', 
    role = 'csr', 
    status = 'active';

-- Verify structure (optional safety)
ALTER TABLE admins ALTER COLUMN role SET NOT NULL;
ALTER TABLE admins ALTER COLUMN status SET NOT NULL;
