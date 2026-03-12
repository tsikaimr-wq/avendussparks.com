-- FIX: Disable Row Level Security (RLS) on the 'trades' table
-- Since the application uses custom authentication (not Supabase Auth), 
-- all requests come as 'anon'. RLS blocks 'anon' inserts by default.
-- Run this in your Supabase SQL Editor.

ALTER TABLE "public"."trades" DISABLE ROW LEVEL SECURITY;

-- If you prefer keeping RLS enabled, use this policy instead (comment out the above line):
-- CREATE POLICY "Enable access for all users" ON "public"."trades" 
-- FOR ALL USING (true) WITH CHECK (true);
