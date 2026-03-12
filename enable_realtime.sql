-- Enable replication for the users table (required for Realtime)
ALTER TABLE users REPLICA IDENTITY FULL;

-- Add the users table to the supabase_realtime publication
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR ALL TABLES;
COMMIT;
