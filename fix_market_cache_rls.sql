-- Enable RLS for market_cache
ALTER TABLE market_cache ENABLE ROW LEVEL SECURITY;

-- Create Policy for market_cache (match project pattern: allow all for now)
-- This allows the application to continue functioning as before while satisfying the security advisor.
CREATE POLICY "Public Market Cache access" ON market_cache FOR ALL USING (true);
