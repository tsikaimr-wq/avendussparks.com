-- Audit Log table for Lock-up modifications
CREATE TABLE IF NOT EXISTS public.lockup_logs (
    id SERIAL PRIMARY KEY,
    trade_id INT REFERENCES public.trades(id) ON DELETE CASCADE,
    admin_id INT, -- Identifying the admin who performed the change
    admin_role TEXT,
    action TEXT, -- 'OVERRIDE', 'EXTEND', 'MODIFY'
    prev_lockup_until TIMESTAMPTZ,
    new_lockup_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Super Admin management function for IPO lock-ups
CREATE OR REPLACE FUNCTION public.manage_ipo_lockup(
    p_trade_id INT,
    p_admin_id INT,
    p_admin_role TEXT,
    p_action TEXT, -- 'OVERRIDE', 'EXTEND', 'MODIFY'
    p_new_date TIMESTAMPTZ DEFAULT NULL,
    p_extra_days INT DEFAULT 0
) RETURNS JSONB AS $$
DECLARE
    v_prev_date TIMESTAMPTZ;
    v_final_date TIMESTAMPTZ;
BEGIN
    -- 1. Security check: Only super_admin or owner CSR can modify lock-ups
    IF p_admin_role NOT IN ('super_admin', 'csr') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Permission Denied: Invalid Admin Role.');
    END IF;

    -- 2. CSR Scope Verification
    IF p_admin_role = 'csr' THEN
        DECLARE
            v_user_id INT;
            v_inv_code TEXT;
            v_csr_id INT;
            v_admin_inv_code TEXT;
        BEGIN
            -- Get trade's owner info
            SELECT t.user_id, u.invitation_code, u.csr_id 
            INTO v_user_id, v_inv_code, v_csr_id 
            FROM public.trades t
            JOIN public.users u ON t.user_id = u.id
            WHERE t.id = p_trade_id;

            -- Get admin's invitation code
            SELECT invitation_code INTO v_admin_inv_code FROM public.admins WHERE id = p_admin_id;

            -- Verify Ownership: Must match csr_id OR invitation_code
            IF v_csr_id != p_admin_id AND (v_admin_inv_code IS NULL OR v_inv_code != v_admin_inv_code) THEN
                RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: You can only manage lock-ups for your assigned users.');
            END IF;
        END;
    END IF;

    -- 2. Fetch current state
    SELECT lockup_until INTO v_prev_date FROM public.trades WHERE id = p_trade_id;

    -- 3. Calculate new lock-up date
    CASE p_action
        WHEN 'OVERRIDE' THEN
            v_final_date := NOW(); -- Immediate unlock
        WHEN 'EXTEND' THEN
            v_final_date := COALESCE(v_prev_date, NOW()) + (p_extra_days || ' days')::INTERVAL;
        WHEN 'MODIFY' THEN
            v_final_date := p_new_date;
        ELSE
            RETURN jsonb_build_object('success', false, 'error', 'Invalid Management Action: ' || p_action);
    END CASE;

    -- 4. Apply changes
    UPDATE public.trades 
    SET lockup_until = v_final_date 
    WHERE id = p_trade_id;

    -- 5. Record in Audit Log
    INSERT INTO public.lockup_logs (
        trade_id, 
        admin_id, 
        admin_role, 
        action, 
        prev_lockup_until, 
        new_lockup_until
    ) VALUES (
        p_trade_id, 
        p_admin_id, 
        p_admin_role, 
        p_action, 
        v_prev_date, 
        v_final_date
    );

    RETURN jsonb_build_object(
        'success', true, 
        'new_lockup_until', v_final_date,
        'action', p_action
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'POSTGRES EXCEPTION: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
