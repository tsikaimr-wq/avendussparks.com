-- Add Tax and Transaction Fee columns to trades table
ALTER TABLE trades ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(20, 2) DEFAULT 0.00;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS txn_charge DECIMAL(20, 2) DEFAULT 0.00;

-- Optional: Add comments for clarity
COMMENT ON COLUMN trades.tax_amount IS 'Tax calculated at 0.12% of base amount';
COMMENT ON COLUMN trades.txn_charge IS 'Transaction charge calculated at 0.03% of base amount';
