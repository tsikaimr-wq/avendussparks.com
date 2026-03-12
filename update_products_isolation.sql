-- Add created_by column to products table for CSR isolation
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='created_by') THEN
        ALTER TABLE products ADD COLUMN created_by INTEGER REFERENCES admins(id);
    END IF;
END $$;

-- Enable index for faster filtering by creator
CREATE INDEX IF NOT EXISTS idx_products_created_by ON products(created_by);
