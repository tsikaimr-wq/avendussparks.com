-- 1. Ensure loans table has a primary key on 'id' if missing (Fixes Error 42830)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE table_name = 'loans' 
        AND constraint_type = 'PRIMARY KEY'
    ) THEN
        ALTER TABLE public.loans ADD PRIMARY KEY (id);
    END IF;
END $$;

-- 2. Create loan_transactions table
CREATE TABLE IF NOT EXISTS public.loan_transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES public.users(id),
    loan_id BIGINT REFERENCES public.loans(id),
    amount NUMERIC NOT NULL,
    type TEXT CHECK (type IN ('Disbursement', 'Repayment')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.loan_transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own transactions
DROP POLICY IF EXISTS "Users can view own loan transactions" ON public.loan_transactions;
CREATE POLICY "Users can view own loan transactions" 
    ON public.loan_transactions FOR SELECT 
    USING (auth.uid()::text = user_id::text);
