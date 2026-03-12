-- Create Products Table for Admin Managed Products (OTC/IPO)
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    profit TEXT,
    price DECIMAL(20, 2) DEFAULT 0.00,
    start_date TEXT,
    end_date TEXT,
    allotment_date TEXT,
    listing_date TEXT,
    min_invest DECIMAL(20, 2) DEFAULT 0.00,
    max_invest DECIMAL(20, 2) DEFAULT 10000000.00,
    description TEXT,
    status TEXT DEFAULT 'Active',
    is_premium BOOLEAN DEFAULT FALSE,
    type TEXT DEFAULT 'IPO', -- Default to IPO, can also be OTC
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Disable RLS for easy integration (Matching other tables)
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
