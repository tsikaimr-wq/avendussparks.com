-- Fix IPO Submission Logic: Always Await Approval & Skip Balance Check
-- This ensures IPO orders start as 'Awaiting' and no funds are frozen until manual admin approval.

CREATE OR REPLACE FUNCTION public.submit_subscription_atomic(
    p_user_id INT,
    p_trade_data JSONB
) RETURNS JSONB AS $$
DECLARE
    v_trade_id INT;
    v_status TEXT;
    v_type TEXT;
    v_order_status TEXT;
    v_min_invest DECIMAL;
    v_amount DECIMAL;
    v_product_id INT;
    v_user_exists BOOLEAN;
    v_balance DECIMAL;
BEGIN
    -- 1. Get Params
    v_type := LOWER(p_trade_data->>'type');
    v_product_id := (p_trade_data->>'product_id')::INT;

    -- 2. Status & Amount Selection
    IF v_type = 'ipo' THEN
        v_status := 'AWAITING_APPROVAL'; -- User Requirement: Start with AWAITING_APPROVAL
        v_order_status := 'PENDING';
        SELECT min_invest INTO v_min_invest FROM public.products WHERE id = v_product_id;
        v_amount := COALESCE(v_min_invest, (p_trade_data->>'total_amount')::DECIMAL);
    ELSE
        v_status := p_trade_data->>'status';
        v_order_status := p_trade_data->>'order_status';
        v_amount := (p_trade_data->>'total_amount')::DECIMAL;
    END IF;

    -- 3. INSERT TRADE Record
    INSERT INTO public.trades (
        user_id,
        product_id,
        symbol,
        name,
        type,
        quantity,
        price,
        total_amount,
        status,
        order_status,
        created_at
    ) VALUES (
        p_user_id,
        v_product_id,
        p_trade_data->>'symbol',
        p_trade_data->>'name',
        v_type,
        (p_trade_data->>'quantity')::DECIMAL,
        (p_trade_data->>'price')::DECIMAL,
        v_amount,
        v_status,
        v_order_status,
        NOW()
    ) RETURNING id INTO v_trade_id;

    -- 4. User Existence Check
    SELECT EXISTS(SELECT 1 FROM public.users WHERE id = p_user_id) INTO v_user_exists;
    IF NOT v_user_exists THEN
        RAISE EXCEPTION 'User profile not found.';
    END IF;

    -- 5. Wallet Transition Logic
    -- User Requirement: Skip balance check during subscription for IPOs
    IF v_type = 'ipo' THEN
        RETURN jsonb_build_object(
            'success', true, 
            'trade_id', v_trade_id, 
            'frozen_amount', 0,
            'balance_deducted', false,
            'status', v_status
        );
    END IF;

    -- Original logic for non-IPO types (e.g. OTC)
    SELECT balance INTO v_balance FROM public.users WHERE id = p_user_id FOR UPDATE;
    v_balance := COALESCE(v_balance, 0);

    IF v_balance >= v_amount THEN
        UPDATE public.users 
        SET balance = v_balance - v_amount,
            frozen = COALESCE(frozen, 0) + v_amount
        WHERE id = p_user_id;

        RETURN jsonb_build_object(
            'success', true, 
            'trade_id', v_trade_id, 
            'frozen_amount', v_amount,
            'balance_deducted', true,
            'status', v_status
        );
    ELSE
        -- Return success but recorded attempt
        RETURN jsonb_build_object(
            'success', true, 
             'trade_id', v_trade_id, 
            'frozen_amount', 0,
            'balance_deducted', false,
            'warning', 'Insufficient balance.',
            'status', v_status
        );
    END IF;

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'SUBSCRIPTION FAILED: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
