-- 1. Enable RLS on valid tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- 2. Create Policies for 'users' table
CREATE POLICY "Public Read Access" ON users FOR SELECT USING (true);
CREATE POLICY "Public Insert Access" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Users Update Own" ON users FOR UPDATE USING (true);

-- 3. Create General Policies (Allow all access for existing app logic)
-- KYC Submissions
CREATE POLICY "Public KYC access" ON kyc_submissions FOR ALL USING (true);

-- Trades
CREATE POLICY "Public Trades access" ON trades FOR ALL USING (true);

-- Bank Accounts
CREATE POLICY "Public Banks access" ON bank_accounts FOR ALL USING (true);

-- Loans
CREATE POLICY "Public Loans access" ON loans FOR ALL USING (true);

-- Withdrawals & Deposits
CREATE POLICY "Public Withdrawals access" ON withdrawals FOR ALL USING (true);
CREATE POLICY "Public Deposits access" ON deposits FOR ALL USING (true);

-- Products & Messages
CREATE POLICY "Public Products access" ON products FOR ALL USING (true);
CREATE POLICY "Public Messages access" ON messages FOR ALL USING (true);

-- Admins
CREATE POLICY "Public Admins access" ON admins FOR ALL USING (true);
