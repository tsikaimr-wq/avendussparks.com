-- Add allocation/allotment date to products so IPO modal can read backend value.
ALTER TABLE products
ADD COLUMN IF NOT EXISTS allotment_date TEXT;

