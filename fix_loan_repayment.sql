-- 1. Update status constraint to include 'FULLY_REPAID'
ALTER TABLE public.loans DROP CONSTRAINT IF EXISTS loans_status_check;
ALTER TABLE public.loans ADD CONSTRAINT loans_status_check CHECK (
    status IN (
        'Pending', 'Approved', 'Rejected', 
        'PENDING', 'APPROVED', 'REJECTED', 
        'pending', 'approved', 'rejected', 
        'Repaid', 'REPAID', 'FULLY_REPAID'
    )
);

-- 2. Create fund_records table as requested
CREATE TABLE IF NOT EXISTS public.fund_records (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES public.users(id),
    type TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    status TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Update the repayment RPC function with the required logic
CREATE OR REPLACE FUNCTION public.repay_loan_secure(
    p_loan_id BIGINT,
    p_admin_id INTEGER,
    p_admin_role TEXT
) RETURNS JSONB AS $$
DECLARE
    v_user_id INTEGER;
    v_loan_amount NUMERIC;
    v_has_access BOOLEAN := FALSE;
    v_user_csr_id INTEGER;
    v_user_inv_code TEXT;
    v_admin_inv_code TEXT;
BEGIN
    -- 1. Fetch Loan & User Info
    SELECT l.user_id, l.amount, u.csr_id, u.invitation_code
    INTO v_user_id, v_loan_amount, v_user_csr_id, v_user_inv_code
    FROM public.loans l
    JOIN public.users u ON l.user_id = u.id
    WHERE l.id = p_loan_id;

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Loan or User not found');
    END IF;

    -- 2. Scope Validation
    IF p_admin_role = 'super_admin' THEN
        v_has_access := TRUE;
    ELSIF p_admin_role = 'csr' THEN
        SELECT invitation_code INTO v_admin_inv_code FROM public.admins WHERE id = p_admin_id;
        IF v_user_csr_id = p_admin_id OR (v_admin_inv_code IS NOT NULL AND v_user_inv_code = v_admin_inv_code) THEN
            v_has_access := TRUE;
        END IF;
    END IF;

    IF NOT v_has_access THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized Scope Violation');
    END IF;

    -- 3. Perform Updates
    -- a) Update loan status (STEP 1)
    UPDATE public.loans 
    SET status = 'FULLY_REPAID',
        remaining_balance = 0,
        closed_at = now(),
        updated_at = now()
    WHERE id = p_loan_id;

    -- b) Update user's borrowed funds (STEP 2 & 3)
    UPDATE public.users 
    SET borrowed_funds = GREATEST(0, COALESCE(borrowed_funds, 0) - v_loan_amount)
    WHERE id = v_user_id;

    -- c) Insert repayment record in fund history (STEP 4)
    INSERT INTO public.fund_records (user_id, type, amount, status, description, created_at)
    VALUES (
        v_user_id, 
        'Loan Repayment', 
        v_loan_amount, 
        'Completed', 
        'Loan marked as fully repaid by admin', 
        NOW()
    );

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
