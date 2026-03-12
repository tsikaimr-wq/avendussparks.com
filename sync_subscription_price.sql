-- Add subscription_price to products table and sync with price
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='subscription_price') THEN
        ALTER TABLE products ADD COLUMN subscription_price NUMERIC;
    END IF;
END $$;

-- Update existing products where subscription_price is null or 0
UPDATE products 
SET subscription_price = price 
WHERE subscription_price IS NULL OR subscription_price = 0;
