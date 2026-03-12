-- FINAL FIX: Ensure balance deduction even if it goes negative (User balance = 0 -> -1500)
-- Uses COALESCE to handle NULL/0 balances correctly.

CREATE OR REPLACE FUNCTION public.approve_subscription_atomic(
    p_trade_id INT,
    p_approved_qty DECIMAL,
    p_auth_id INT,
    p_auth_role TEXT
) RETURNS JSONB AS $$
DECLARE
    v_user_id INT;
    v_orig_total DECIMAL;
    v_approved_val DECIMAL;
    v_paid_amount DECIMAL;
    v_to_deduct DECIMAL;
    v_product_id INT;
    v_lockup_days INT;
    v_type TEXT;
    v_new_balance DECIMAL;
    v_final_status TEXT;
    v_trade_price DECIMAL;
BEGIN
    -- 1. Fetch Trade & Product Info
    -- We need the price from the trade record to calculate the final approved value
    SELECT user_id, total_amount, product_id, type, COALESCE(paid_amount, 0), price
    INTO v_user_id, v_orig_total, v_product_id, v_type, v_paid_amount, v_trade_price
    FROM public.trades WHERE id = p_trade_id;

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trade not found');
    END IF;

    -- Fetch lockup_days if it's an IPO
    IF LOWER(v_type) LIKE '%ipo%' THEN
        SELECT COALESCE(lockup_days, 0) INTO v_lockup_days FROM public.products WHERE id = v_product_id;
    ELSE
        v_lockup_days := 0;
    END IF;

    -- 2. Calculate Final Approved Value
    -- (Quantity Approved * Original Trade Price OR Issue Price)
    v_approved_val := p_approved_qty * v_trade_price;

    -- THE CRITICAL CALCULATION:
    -- How much more do we need to take from the wallet?
    -- If they paid 0 at submission, v_to_deduct = v_approved_val (e.g. 1500).
    v_to_deduct := v_approved_val - v_paid_amount;

    -- 3. Update User Assets (The Core Deduction)
    UPDATE public.users 
    SET 
        -- Deduct any funds that were actually frozen during Stage 1
        frozen = GREATEST(0, COALESCE(frozen, 0) - v_paid_amount),
        -- Record the full approved investment
        invested = COALESCE(invested, 0) + v_approved_val,
        -- DEDUCT from balance (allowing negative)
        balance = COALESCE(balance, 0) - v_to_deduct,
        -- Mark as negative balance if applicable
        negative_balance = (COALESCE(balance, 0) - v_to_deduct) < 0,
        -- Update outstanding amount for audit
        outstanding = COALESCE(outstanding, 0) + CASE WHEN (COALESCE(balance, 0) - v_to_deduct) < 0 THEN ABS(LEAST(0, COALESCE(balance, 0) - v_to_deduct)) ELSE 0 END
    WHERE id = v_user_id
    RETURNING balance INTO v_new_balance;

    -- 4. Determine Trade & Order Status
    -- Use ROUND to prevent floating point edge-cases where -0.001 bypassed trigger checks but rounded to 0.00 on save
    IF ROUND(v_new_balance, 2) < 0 THEN
        v_final_status := 'LOCKED_UNPAID';
    ELSE
        v_final_status := 'Holding';
    END IF;

    -- 5. Finalize Trade Record
    UPDATE public.trades SET
        status = v_final_status,
        approved_quantity = p_approved_qty,
        quantity = p_approved_qty,
        total_amount = v_approved_val,
        -- Update what's been paid vs what's still owed
        paid_amount = v_paid_amount + CASE WHEN ROUND(v_new_balance, 2) >= 0 THEN v_to_deduct ELSE GREATEST(0, v_to_deduct + v_new_balance) END,
        outstanding_amount = CASE WHEN ROUND(v_new_balance, 2) < 0 THEN ABS(v_new_balance) ELSE 0 END,
        order_status = CASE WHEN ROUND(v_new_balance, 2) < 0 THEN 'LOCKED' ELSE 'FILLED' END,
        approved_by = p_auth_id,
        approved_role = p_auth_role,
        approved_at = NOW(),
        processed_at = NOW(),
        lockup_until = CASE WHEN v_lockup_days > 0 THEN NOW() + (v_lockup_days || ' days')::INTERVAL ELSE NULL END,
        allotment_date = NOW()
    WHERE id = p_trade_id;

    RETURN jsonb_build_object(
        'success', true, 
        'new_balance', v_new_balance, 
        'to_deduct', v_to_deduct,
        'status', v_final_status
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'POSTGRES EXCEPTION: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
