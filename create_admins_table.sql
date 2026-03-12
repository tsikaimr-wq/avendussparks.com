-- Create admins table in Supabase (PostgreSQL)
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'super_admin' CHECK (role IN ('super_admin', 'csr')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Disable RLS for easier integration as per project pattern
ALTER TABLE admins DISABLE ROW LEVEL SECURITY;

-- Insert default admin if it doesn't exist
INSERT INTO admins (username, password, role, status) 
VALUES ('admin', 'admin123', 'super_admin', 'active')
ON CONFLICT (username) DO NOTHING;
