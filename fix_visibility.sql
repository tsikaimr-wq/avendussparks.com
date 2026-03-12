-- DISABLE ROW LEVEL SECURITY (RLS) for deposits and withdrawals
-- This ensures that the frontend can READ the records inserted by the Admin.

ALTER TABLE deposits DISABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals DISABLE ROW LEVEL SECURITY;

-- Optional: Ensure it's off for users table too (usually is)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Grant permissions just in case (for anon/public)
GRANT ALL ON deposits TO anon;
GRANT ALL ON deposits TO authenticated;
GRANT ALL ON withdrawals TO anon;
GRANT ALL ON withdrawals TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE deposits_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE withdrawals_id_seq TO anon;
