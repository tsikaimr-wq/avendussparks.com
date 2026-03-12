-- REPAIR: Fix trade schema mismatch for requested_amount / requested_quantity
-- Description: Adds missing columns to 'trades' table and redeploys the atomic subscription RPC 
-- with robust JSONB parsing (handles both 'requested_amount' and 'requested_quantity' inputs).

-- 1. Ensure all potential column names exist in 'trades' table to prevent "column does not exist" errors.
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS requested_quantity DECIMAL(20, 2);
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS requested_amount DECIMAL(20, 2); -- Safe fallback
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS approved_quantity DECIMAL(20, 2);

-- 2. Redeploy the Atomic Subscription Submission Function
CREATE OR REPLACE FUNCTION public.submit_subscription_atomic(
    p_user_id INT,
    p_trade_data JSONB
) RETURNS JSONB AS $$
DECLARE
    v_balance DECIMAL;
    v_amount DECIMAL;
    v_trade_id INT;
BEGIN
    -- 1. Parse amount from JSONB (handles 'total_amount' or 'amount')
    v_amount := COALESCE(
        (p_trade_data->>'total_amount')::DECIMAL, 
        (p_trade_data->>'amount')::DECIMAL
    );

    IF v_amount IS NULL OR v_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid subscription amount.');
    END IF;

    -- 2. Fetch current balance with row-level lock
    SELECT balance INTO v_balance FROM public.users WHERE id = p_user_id FOR UPDATE;

    IF v_balance IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found.');
    END IF;

    -- 3. Check sufficiency
    IF v_balance < v_amount THEN
        -- Create a 'Pending' record with admin_note but do not deduct balance
        -- This allows admin to see the request even if balance is low (per user preference)
        INSERT INTO public.trades (
            user_id, symbol, name, type, quantity, requested_quantity, price, total_amount, 
            status, order_status, created_at, product_id, admin_note
        ) VALUES (
            p_user_id, 
            p_trade_data->>'symbol', 
            p_trade_data->>'name', 
            p_trade_data->>'type', 
            (p_trade_data->>'quantity')::DECIMAL,
            COALESCE((p_trade_data->>'requested_quantity')::DECIMAL, (p_trade_data->>'quantity')::DECIMAL),
            (p_trade_data->>'price')::DECIMAL, 
            v_amount,
            'Pending', 
            'PENDING', 
            NOW(), 
            (p_trade_data->>'product_id')::INT,
            'INSUFFICIENT BALANCE AT SUBMISSION'
        ) RETURNING id INTO v_trade_id;

        RETURN jsonb_build_object('success', true, 'trade_id', v_trade_id, 'warning', 'Insufficient balance. Order marked as Pending.');
    END IF;

    -- 4. Atomic Transition: Deduct Balance & Increase Frozen
    UPDATE public.users 
    SET balance = balance - v_amount,
        frozen = COALESCE(frozen, 0) + v_amount
    WHERE id = p_user_id;

    -- 5. Create the Trade Record (Awaiting Approval)
    INSERT INTO public.trades (
        user_id, symbol, name, type, quantity, requested_quantity, requested_amount, price, total_amount, 
        status, order_status, created_at, product_id
    ) VALUES (
        p_user_id, 
        p_trade_data->>'symbol', 
        p_trade_data->>'name', 
        p_trade_data->>'type', 
        (p_trade_data->>'quantity')::DECIMAL,
        COALESCE((p_trade_data->>'requested_quantity')::DECIMAL, (p_trade_data->>'quantity')::DECIMAL),
        COALESCE((p_trade_data->>'requested_amount')::DECIMAL, v_amount), -- Map to requested_amount too
        (p_trade_data->>'price')::DECIMAL, 
        v_amount,
        'Awaiting', 
        'PENDING', 
        NOW(), 
        (p_trade_data->>'product_id')::INT
    ) RETURNING id INTO v_trade_id;

    RETURN jsonb_build_object('success', true, 'trade_id', v_trade_id);

EXCEPTION WHEN OTHERS THEN
    -- Fallback for any critical system errors
    RETURN jsonb_build_object('success', false, 'error', 'SUBSCRIPTION FAILED: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
