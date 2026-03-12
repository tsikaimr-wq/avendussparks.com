-- Migration script to add role and status to admins table

DO $$ 
BEGIN 
    -- 1. Add role column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admins' AND column_name='role') THEN
        ALTER TABLE admins ADD COLUMN role TEXT DEFAULT 'super_admin';
    END IF;

    -- 2. Add status column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admins' AND column_name='status') THEN
        ALTER TABLE admins ADD COLUMN status TEXT DEFAULT 'active';
    END IF;

    -- 3. Ensure role and status are NOT NULL (if we just added them, they will have defaults)
    ALTER TABLE admins ALTER COLUMN role SET NOT NULL;
    ALTER TABLE admins ALTER COLUMN status SET NOT NULL;

    -- 4. Add constraints if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name='check_admin_role') THEN
        ALTER TABLE admins ADD CONSTRAINT check_admin_role CHECK (role IN ('super_admin', 'csr'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name='check_admin_status') THEN
        ALTER TABLE admins ADD CONSTRAINT check_admin_status CHECK (status IN ('active', 'inactive'));
    END IF;

    -- 5. Ensure existing entries have consistent roles (Default everything to super_admin or csr as appropriate)
    -- This assumes existing admins are super admins.
    UPDATE admins SET role = 'super_admin' WHERE role IS NULL;
    UPDATE admins SET status = 'active' WHERE status IS NULL;
    
END $$;
