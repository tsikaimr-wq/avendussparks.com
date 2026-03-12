-- 1. Update Users Table with KYC basic info
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS id_number TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS loan_enabled BOOLEAN DEFAULT FALSE;

-- 2. Create KYC Submissions Table
CREATE TABLE IF NOT EXISTS kyc_submissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    id_type TEXT CHECK (id_type IN ('Aadhar', 'PAN', 'Passport', 'Driving License')),
    id_front_url TEXT,
    id_back_url TEXT,
    selfie_url TEXT,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    admin_note TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP WITH TIME ZONE
);

-- 3. Default Demo User Update
UPDATE users SET kyc = 'Approved', full_name = 'Sharad Madhukar Mali' WHERE mobile = '918108038029';

-- 2. Create Deposits Table
CREATE TABLE IF NOT EXISTS deposits (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(20, 2) NOT NULL,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    admin_note TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create Withdrawals Table
CREATE TABLE IF NOT EXISTS withdrawals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(20, 2) NOT NULL,
    bank_name TEXT,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    admin_note TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create Messages Table
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    sender TEXT DEFAULT 'User' CHECK (sender IN ('User', 'Admin')),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Insert Default Demo User
INSERT INTO users (mobile, password, username, kyc, credit_score, vip, balance, invested)
VALUES ('918108038029', 'password123', 'Sharad Madhukar Mali', '600pApproved', 100, 0, 0.00, 46410128.48)
ON CONFLICT (mobile) DO NOTHING;

-- 6. Insert Demo Data
INSERT INTO deposits (user_id, amount, status, created_at)
SELECT u.id, 3774250.00, 'Approved', '2026-01-01 10:23:00+00' 
FROM users u WHERE u.mobile = '918108038029';

INSERT INTO withdrawals (user_id, amount, bank_name, status, created_at)
SELECT u.id, 50000.00, 'SBI', 'Approved', '2025-12-19 14:56:00+00'
FROM users u WHERE u.mobile = '918108038029';

-- 7. Create Trades Table
CREATE TABLE IF NOT EXISTS trades (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('stock', 'OTC', 'IPO')),
    quantity DECIMAL(20, 2) NOT NULL,
    price DECIMAL(20, 2) NOT NULL,
    total_amount DECIMAL(20, 2) NOT NULL,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Holding', 'Sold', 'Pending', 'Approved', 'Settled', 'Rejected')),
    admin_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);

-- 8. Disable RLS for Development (Fixes Update Issues)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 9. Create Loans Table
CREATE TABLE IF NOT EXISTS loans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(20, 2) NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    admin_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);
