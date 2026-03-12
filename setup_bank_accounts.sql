-- RUN THIS IN SUPABASE SQL EDITOR

-- 1. Reset the table to ensure clean state
DROP TABLE IF EXISTS public.bank_accounts;

-- 2. Create the table with TEXT type for user_id to accept any ID
CREATE TABLE public.bank_accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL, 
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    mobile TEXT NOT NULL,
    ifsc TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Disable Security Policies (RLS) to ensure data enters freely
ALTER TABLE public.bank_accounts DISABLE ROW LEVEL SECURITY;

-- 4. Explicitly Grant Permissions to the API (Anon Key)
GRANT ALL ON public.bank_accounts TO anon;
GRANT ALL ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;

-- 5. Insert a Test Record to verify
INSERT INTO public.bank_accounts (user_id, bank_name, account_number, first_name, last_name, mobile, ifsc)
VALUES ('TEST_USER_123', 'Test Bank', '1234567890', 'Test', 'User', '09123456789', 'TEST0001');
