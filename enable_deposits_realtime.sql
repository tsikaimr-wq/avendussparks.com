-- Enable replication for the deposits table (required for Realtime)
ALTER TABLE deposits REPLICA IDENTITY FULL;

-- (Re)Create the publication to ensure all tables are included
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR ALL TABLES;
COMMIT;
