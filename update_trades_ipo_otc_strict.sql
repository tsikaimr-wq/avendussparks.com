-- Add new columns to 'trades' table for STRICT IPO/OTC control
ALTER TABLE trades ADD COLUMN IF NOT EXISTS requested_quantity DECIMAL(20, 2);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS approved_quantity DECIMAL(20, 2);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES admins(id);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS approved_role TEXT;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS final_total_amount DECIMAL(20, 2);

-- Also add 'total_shares' and 'available_shares' to 'products' table for limit validation
ALTER TABLE products ADD COLUMN IF NOT EXISTS total_shares DECIMAL(20, 2) DEFAULT 1000000;
ALTER TABLE products ADD COLUMN IF NOT EXISTS available_shares DECIMAL(20, 2) DEFAULT 1000000;
ALTER TABLE products ADD COLUMN IF NOT EXISTS subscription_count INTEGER DEFAULT 0;
