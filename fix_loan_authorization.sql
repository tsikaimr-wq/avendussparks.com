-- Fix CSR Loan Operation Scope Authorization
-- Enforce role-based scope restrictions in the backend

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
        amount = p_approved_amount,  -- In this schema, 'amount' is treated as the approved amount during operation
        repayment_terms = to_jsonb(p_repayment_terms),
        processed_at = now()
    WHERE id = p_loan_id;

    -- b) Update User Eligibility
    UPDATE public.users 
    SET loan_enabled = p_eligibility 
    WHERE id = v_user_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
