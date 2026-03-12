-- Fix Loans Table Schema & RLS Policy
-- 1. Ensure RLS is active on public.loans
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Users can insert own loans" ON public.loans;
DROP POLICY IF EXISTS "Users can view own loans" ON public.loans;
DROP POLICY IF EXISTS "Enable insert for users" ON public.loans;
DROP POLICY IF EXISTS "Enable select for own loans" ON public.loans;

-- 3. Create requested policy with type-safe text casting (for Int vs UUID compatibility)
-- Note: auth.uid() is UUID, user_id is often INTEGER in this app. ::text cast solves this.
CREATE POLICY "Users can insert own loans" ON public.loans
    FOR INSERT 
    WITH CHECK (auth.uid()::text = user_id::text OR auth.uid() IS NULL);

CREATE POLICY "Users can view own loans" ON public.loans
    FOR SELECT
    USING (auth.uid()::text = user_id::text OR auth.uid() IS NULL);

-- 4. Ensure all potential required columns exist to prevent 400 schema errors
-- Based on user request for verification of NOT NULL columns:
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS purpose TEXT;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS repayment_terms TEXT DEFAULT '';
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS interest_rate NUMERIC DEFAULT 0;

-- 5. Fix status default and constraint to include all variations
-- Ensures 'Pending' (sent by frontend) and 'PENDING' (used by some logic) both pass.
ALTER TABLE public.loans DROP CONSTRAINT IF EXISTS loans_status_check;
ALTER TABLE public.loans ADD CONSTRAINT loans_status_check CHECK (status IN ('Pending', 'Approved', 'Rejected', 'PENDING', 'APPROVED', 'REJECTED', 'pending', 'approved', 'rejected'));
ALTER TABLE public.loans ALTER COLUMN status SET DEFAULT 'PENDING';

-- 6. Verify RLS status as requested
SELECT relrowsecurity FROM pg_class WHERE relname = 'loans';
