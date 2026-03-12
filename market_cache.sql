-- Create market_cache table for storing cached prices from external providers
CREATE TABLE IF NOT EXISTS market_cache (
    symbol TEXT PRIMARY KEY,
    price NUMERIC NOT NULL,
    source TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (optional, following project pattern of disabling if needed)
-- ALTER TABLE market_cache DISABLE ROW LEVEL SECURITY;
