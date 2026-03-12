-- Implementation Note: If the `product_type` column does not exist, run this query in your Supabase SQL Editor.
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type VARCHAR(10) NOT NULL DEFAULT 'IPO';
