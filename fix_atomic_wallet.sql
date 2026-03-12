-- CRITICAL REPAIR: IPO Lot-Based Subscriptions & Partial Approval Logic
-- This script implements strict separation between IPO (Fixed Lot) and OTC (Flexible Qty).

-- 1. Ensure 'Awaiting' is a valid status (Drop/Add constraint if needed)
-- We'll just ensure the column can take any text first, then we can re-add constraints later if desired.
-- For now, we focus on the logic.

-- 2. STAGE 1: ATOMIC SUBSCRIPTION SUBMIT
-- IPO: Uses predefined min_invest from products table.
-- OTC: Uses user-provided total_amount.
-- ATOMIC SUBSCRIPTION SUBMIT (STRICTLY RESILIENT TO NULL WALLETS)
CREATE OR REPLACE FUNCTION public.submit_subscription_atomic(
    p_user_id INT,
    p_trade_data JSONB
) RETURNS JSONB AS $$
DECLARE
    v_balance DECIMAL;
    v_amount DECIMAL;
    v_trade_id INT;
    v_type TEXT;
    v_product_id INT;
    v_min_invest DECIMAL;
    v_status TEXT;
    v_order_status TEXT;
    v_user_exists BOOLEAN;
BEGIN
    -- 1. Extraction & Normalization
    v_type := LOWER(p_trade_data->>'type');
    v_product_id := (p_trade_data->>'product_id')::INT;

    -- 2. Basic Validation (RELAXED FOR MOCK IPOs)
    -- We still prefer a product_id, but won't block the trade if it's missing.
    
    -- 3. Status & Amount Selection
    IF v_type = 'ipo' THEN
        v_status := 'Pending';
        v_order_status := 'PENDING';
        SELECT min_invest INTO v_min_invest FROM public.products WHERE id = v_product_id;
        v_amount := COALESCE(v_min_invest, (p_trade_data->>'total_amount')::DECIMAL);
    ELSE
        -- OTC/STOCK
        v_status := 'Pending';
        v_order_status := 'OPEN';
        v_amount := (p_trade_data->>'total_amount')::DECIMAL;
    END IF;
    
    IF v_amount IS NULL OR v_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid subscription amount: ₹' || COALESCE(v_amount::TEXT, '0'));
    END IF;

    -- 4. Create Trade Record FIRST (Rolls back if function fails later)
    INSERT INTO public.trades (
        user_id, symbol, name, type, quantity, requested_quantity, price, total_amount, 
        tax_amount, txn_charge, admin_note, status, order_status, created_at, product_id
    ) VALUES (
        p_user_id,
        p_trade_data->>'symbol',
        p_trade_data->>'name',
        v_type,
        COALESCE((p_trade_data->>'quantity')::DECIMAL, 0),
        COALESCE((p_trade_data->>'requested_quantity')::DECIMAL, (p_trade_data->>'quantity')::DECIMAL),
        COALESCE((p_trade_data->>'price')::DECIMAL, 0),
        v_amount,
        COALESCE((p_trade_data->>'tax_amount')::DECIMAL, 0),
        COALESCE((p_trade_data->>'txn_charge')::DECIMAL, 0),
        p_trade_data->>'admin_note',
        v_status,
        v_order_status,
        NOW(),
        v_product_id
    ) RETURNING id INTO v_trade_id;

    -- 5. Wallet Transition Logic (RESILIENT & NON-ROLLBACK)
    SELECT balance INTO v_balance FROM public.users WHERE id = p_user_id FOR UPDATE;
    
    SELECT EXISTS(SELECT 1 FROM public.users WHERE id = p_user_id) INTO v_user_exists;
    IF NOT v_user_exists THEN
        RAISE EXCEPTION 'User profile not found.'; -- User MUST exist to continue
    END IF;

    -- Handle NULL balance (critical for new users)
    v_balance := COALESCE(v_balance, 0);

    -- Only deduct if balance is sufficient
    IF v_balance >= v_amount THEN
        -- ATOMIC UPDATE
        UPDATE public.users 
        SET balance = v_balance - v_amount,
            frozen = COALESCE(frozen, 0) + v_amount,
            invested = COALESCE(invested, 0),
            outstanding = COALESCE(outstanding, 0)
        WHERE id = p_user_id;

        RETURN jsonb_build_object(
            'success', true, 
            'trade_id', v_trade_id, 
            'frozen_amount', v_amount,
            'balance_deducted', true,
            'status', v_status
        );
    ELSE
        -- DO NOT ROLLBACK. Persist the trade record as 'Pending'.
        -- This ensures visibility in the Admin Panel even if funds are 0.
        RETURN jsonb_build_object(
            'success', true, 
            'trade_id', v_trade_id, 
            'frozen_amount', 0,
            'balance_deducted', false,
            'warning', 'Insufficient balance. Trade created as Pending/Outstanding.',
            'status', v_status
        );
    END IF;

EXCEPTION WHEN OTHERS THEN
    -- Rollback on critical system errors (like constraint violations or missing profiles)
    RETURN jsonb_build_object('success', false, 'error', 'SUBSCRIPTION FAILED: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. STAGE 2: ATOMIC ADMIN APPROVE (Supports Partial Lots)
-- If p_approved_qty < requested_quantity, excess Frozen funds are returned to Available.
CREATE OR REPLACE FUNCTION public.approve_subscription_atomic(
    p_trade_id INT,
    p_approved_qty DECIMAL,
    p_auth_id INT,
    p_auth_role TEXT
) RETURNS JSONB AS $$
DECLARE
    v_user_id INT;
    v_price DECIMAL;
    v_orig_frozen DECIMAL;
    v_approved_val DECIMAL;
    v_excess DECIMAL;
    v_type TEXT;
BEGIN
    -- 1. Lock Trade and User
    SELECT user_id, price, total_amount, type INTO v_user_id, v_price, v_orig_frozen, v_type FROM public.trades WHERE id = p_trade_id FOR UPDATE;
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trade record #' || p_trade_id || ' not found.');
    END IF;

    -- 2. Calculate Values
    v_approved_val := p_approved_qty * v_price;
    v_excess := v_orig_frozen - v_approved_val;

    -- 3. Transition Wallet
    -- Deduct full original frozen amount, Add approved to invested, Add excess back to balance
    UPDATE public.users 
    SET frozen = GREATEST(0, COALESCE(frozen, 0) - v_orig_frozen),
        invested = COALESCE(invested, 0) + v_approved_val,
        balance = balance + GREATEST(0, v_excess)
    WHERE id = v_user_id;

    -- 4. Mark Trade as Settled
    UPDATE public.trades SET
        status = 'Settled',
        approved_quantity = p_approved_qty,
        quantity = p_approved_qty,
        final_total_amount = v_approved_val,
        total_amount = v_approved_val, -- Update total to reflect what was actually bought
        approved_by = p_auth_id,
        approved_role = p_auth_role,
        approved_at = NOW(),
        processed_at = NOW(),
        admin_note = CASE WHEN v_excess > 0 THEN 'Partial Approval. ₹' || v_excess || ' returned to balance.' ELSE admin_note END
    WHERE id = p_trade_id;

    RETURN jsonb_build_object('success', true, 'approved_val', v_approved_val, 'returned_val', v_excess);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'POSTGRES EXCEPTION: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. STAGE 3: ATOMIC ADMIN REJECT (Returns full frozen to balance)
CREATE OR REPLACE FUNCTION public.reject_subscription_atomic(
    p_trade_id INT,
    p_auth_id INT,
    p_auth_role TEXT
) RETURNS JSONB AS $$
DECLARE
    v_user_id INT;
    v_amount DECIMAL;
BEGIN
    SELECT user_id, total_amount INTO v_user_id, v_amount FROM public.trades WHERE id = p_trade_id FOR UPDATE;
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trade record #' || p_trade_id || ' not found.');
    END IF;

    -- FULL REVERSAL: Frozen -> Available Balance
    UPDATE public.users 
    SET balance = balance + v_amount,
        frozen = GREATEST(0, COALESCE(frozen, 0) - v_amount)
    WHERE id = v_user_id;

    -- Mark Trade as Rejected
    UPDATE public.trades SET
        status = 'Rejected',
        processed_at = NOW(),
        approved_by = p_auth_id,
        approved_role = p_auth_role
    WHERE id = p_trade_id;

    RETURN jsonb_build_object('success', true, 'returned_amount', v_amount);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'POSTGRES EXCEPTION: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reload schema
NOTIFY pgrst, 'reload schema';
