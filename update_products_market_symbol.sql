-- Add market_symbol column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS market_symbol TEXT;
