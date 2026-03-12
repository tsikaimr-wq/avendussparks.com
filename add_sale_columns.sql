-- Add historical data columns to trades table if they don't exist
ALTER TABLE trades ADD COLUMN IF NOT EXISTS total_sale_value DECIMAL(18, 2);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS realised_profit DECIMAL(18, 2);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS sell_timestamp TIMESTAMP WITH TIME ZONE;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS sell_price DECIMAL(18, 2);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS sell_tax DECIMAL(18, 2);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS sell_fees DECIMAL(18, 2);

-- Update existing Sold trades if any (best effort)
UPDATE trades 
SET sell_timestamp = processed_at 
WHERE status = 'Sold' AND sell_timestamp IS NULL;
