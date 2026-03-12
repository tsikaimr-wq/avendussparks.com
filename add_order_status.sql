-- Migration: Add Sell Time & Order Status Columns to trades table
-- This script adds the necessary columns to track sell-side execution details and order state.

ALTER TABLE trades 
ADD COLUMN IF NOT EXISTS sell_price DECIMAL,
ADD COLUMN IF NOT EXISTS total_sale_value DECIMAL,
ADD COLUMN IF NOT EXISTS sell_timestamp TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS realised_profit DECIMAL,
ADD COLUMN IF NOT EXISTS sell_tax DECIMAL,
ADD COLUMN IF NOT EXISTS sell_fees DECIMAL,
ADD COLUMN IF NOT EXISTS order_status TEXT DEFAULT 'OPEN';

-- Update existing Sold trades to CLOSED
UPDATE trades SET order_status = 'CLOSED' WHERE status = 'Sold';
UPDATE trades SET order_status = 'OPEN' WHERE status != 'Sold' AND order_status IS NULL;

-- Ensure the column has a default for new records
ALTER TABLE trades ALTER COLUMN order_status SET DEFAULT 'OPEN';
