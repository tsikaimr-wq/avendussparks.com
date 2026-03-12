-- SQL Migration to add is_deleted column to transaction tables
-- Run this in your Supabase SQL Editor

ALTER TABLE stock_trades ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE ipo_subscriptions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- Optional: ensure all names from request are covered
ALTER TABLE large_transactions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE ipo_records ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- Update existing records to FALSE
UPDATE stock_trades SET is_deleted = FALSE WHERE is_deleted IS NULL;
UPDATE trades SET is_deleted = FALSE WHERE is_deleted IS NULL;
UPDATE ipo_subscriptions SET is_deleted = FALSE WHERE is_deleted IS NULL;

-- Notify pgrst to reload schema cache
NOTIFY pgrst, 'reload schema';
