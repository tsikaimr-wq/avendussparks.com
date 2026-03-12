
-- 1. Add missing repayment columns to loans table
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS remaining_balance NUMERIC DEFAULT 0;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS loan_disbursed BOOLEAN DEFAULT FALSE;

-- 2. Add missing columns to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS loan_balance NUMERIC DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS outstanding NUMERIC DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS borrowed_funds NUMERIC DEFAULT 0;

-- 2. Update status constraint to include 'Repaid'
ALTER TABLE public.loans DROP CONSTRAINT IF EXISTS loans_status_check;
ALTER TABLE public.loans ADD CONSTRAINT loans_status_check CHECK (status IN ('Pending', 'Approved', 'Rejected', 'PENDING', 'APPROVED', 'REJECTED', 'pending', 'approved', 'rejected', 'Repaid', 'REPAID'));

-- 3. Initialize remaining_balance for existing APPROVED loans if it is 0
UPDATE public.loans 
SET remaining_balance = amount 
WHERE status IN ('Approved', 'APPROVED') AND (remaining_balance IS NULL OR remaining_balance = 0);

-- 4. Update operate_loan_secure to initialize remaining_balance when approved
CREATE OR REPLACE FUNCTION public.operate_loan_secure(
    p_loan_id BIGINT,
    p_status TEXT,
    p_admin_note TEXT,
    p_approved_amount NUMERIC,
    p_repayment_terms TEXT,
    p_eligibility BOOLEAN,
    p_admin_id INTEGER,
    p_admin_role TEXT
) RETURNS JSONB AS $$
DECLARE
    v_user_id INTEGER;
    v_has_access BOOLEAN := FALSE;
    v_user_csr_id INTEGER;
    v_user_inv_code TEXT;
    v_admin_inv_code TEXT;
    v_loan_disbursed BOOLEAN;
BEGIN
    -- 1. Fetch Loan & User Info
    SELECT l.user_id, u.csr_id, u.invitation_code 
    INTO v_user_id, v_user_csr_id, v_user_inv_code
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
        -- Get Admin's Invitation Code
        SELECT invitation_code INTO v_admin_inv_code FROM public.admins WHERE id = p_admin_id;
        
        -- Check ID match or Invitation Code match
        IF v_user_csr_id = p_admin_id THEN
            v_has_access := TRUE;
        ELSIF v_admin_inv_code IS NOT NULL AND v_user_inv_code = v_admin_inv_code THEN
            v_has_access := TRUE;
        END IF;
    END IF;

    IF NOT v_has_access THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized Scope Violation');
    END IF;

    -- 3. Perform Updates
    -- a) Update Loan
    UPDATE public.loans 
    SET status = p_status,
        admin_note = p_admin_note,
        amount = p_approved_amount,
        remaining_balance = CASE WHEN p_status IN ('Approved', 'APPROVED') THEN p_approved_amount ELSE remaining_balance END,
        repayment_terms = to_jsonb(p_repayment_terms),
        processed_at = now(),
        updated_at = now()
    WHERE id = p_loan_id;

    -- b) Update User Eligibility
    UPDATE public.users 
    SET loan_enabled = p_eligibility 
    WHERE id = v_user_id;

    -- c) Automated Disbursement Logic
    IF p_status IN ('Approved', 'APPROVED') THEN
        -- Re-fetch to check disbursement status (ensure we have latest)
        SELECT loan_disbursed INTO v_loan_disbursed FROM public.loans WHERE id = p_loan_id;
        
        IF NOT COALESCE(v_loan_disbursed, FALSE) THEN
            -- 1. Update User Balances atomically
            UPDATE public.users 
            SET balance = COALESCE(balance, 0) + p_approved_amount,
                outstanding = COALESCE(outstanding, 0) + p_approved_amount,
                loan_balance = COALESCE(loan_balance, 0) + p_approved_amount,
                borrowed_funds = COALESCE(borrowed_funds, 0) + p_approved_amount
            WHERE id = v_user_id;
            
            -- 2. Create Transaction Record
            INSERT INTO public.loan_transactions (user_id, loan_id, amount, type)
            VALUES (v_user_id, p_loan_id, p_approved_amount, 'Disbursement');
            
            -- 3. Mark loan as disbursed
            UPDATE public.loans SET loan_disbursed = TRUE WHERE id = p_loan_id;
        END IF;
    END IF;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create the repayment RPC function
CREATE OR REPLACE FUNCTION public.repay_loan_secure(
    p_loan_id BIGINT,
    p_admin_id INTEGER,
    p_admin_role TEXT
) RETURNS JSONB AS $$
DECLARE
    v_user_id INTEGER;
    v_has_access BOOLEAN := FALSE;
    v_user_csr_id INTEGER;
    v_user_inv_code TEXT;
    v_admin_inv_code TEXT;
    v_prev_remaining_balance NUMERIC;
BEGIN
    -- 1. Fetch Loan & User Info
    SELECT l.user_id, u.csr_id, u.invitation_code, l.remaining_balance
    INTO v_user_id, v_user_csr_id, v_user_inv_code, v_prev_remaining_balance
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
        -- Get Admin's Invitation Code
        SELECT invitation_code INTO v_admin_inv_code FROM public.admins WHERE id = p_admin_id;
        
        -- Check ID match or Invitation Code match
        IF v_user_csr_id = p_admin_id THEN
            v_has_access := TRUE;
        ELSIF v_admin_inv_code IS NOT NULL AND v_user_inv_code = v_admin_inv_code THEN
            v_has_access := TRUE;
        END IF;
    END IF;

    IF NOT v_has_access THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized Scope Violation');
    END IF;

    -- 3. Perform Updates
    -- a) Update Loan: remaining_balance=0, status='Repaid', closed_at=now()
    UPDATE public.loans 
    SET status = 'Repaid',
        remaining_balance = 0,
        closed_at = now(),
        updated_at = now()
    WHERE id = p_loan_id;

    -- b) Update User: outstanding = outstanding - previous_remaining_balance
    UPDATE public.users 
    SET outstanding = GREATEST(0, (COALESCE(outstanding, 0) - COALESCE(v_prev_remaining_balance, 0)))
    WHERE id = v_user_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
