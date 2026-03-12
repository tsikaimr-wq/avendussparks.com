-- Rename 'profit' to 'est_profit_percent' in products table
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='profit') THEN
        ALTER TABLE products RENAME COLUMN profit TO est_profit_percent;
    END IF;
END $$;

-- Ensure product_id exists and is indexed in trades table for efficient joining
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trades' AND column_name='product_id') THEN
        ALTER TABLE trades ADD COLUMN product_id INTEGER REFERENCES products(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_trades_product_id ON trades(product_id);
