-- Add negative_balance flag to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS negative_balance BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS outstanding DECIMAL(20, 2) DEFAULT 0.00;
