-- Create Settings Table for Platform Configuration
CREATE TABLE IF NOT EXISTS platform_settings (
    key TEXT PRIMARY KEY,
    value JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Disable RLS for easy integration
ALTER TABLE platform_settings DISABLE ROW LEVEL SECURITY;

-- Insert Initial Institutional Configuration
INSERT INTO platform_settings (key, value)
VALUES ('institutional_config', '{"status": "Online", "max_qty": 1000000}')
ON CONFLICT (key) DO NOTHING;
