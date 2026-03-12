-- IPO Locked-Position System Update
-- Adds paid/outstanding amount tracking and updates the atomic subscription logic.

-- 1. Update Schema
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(20, 2) DEFAULT 0;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS outstanding_amount DECIMAL(20, 2) DEFAULT 0;

-- 2. Update Atomic Subscription Function
CREATE OR REPLACE FUNCTION public.submit_subscription_atomic(
    p_user_id INT,
    p_trade_data JSONB
) RETURNS JSONB AS $$
DECLARE
    v_balance DECIMAL;
    v_amount DECIMAL;
    v_trade_id INT;
    v_paid DECIMAL;
    v_outstanding DECIMAL;
    v_status TEXT;
    v_order_status TEXT;
BEGIN
    -- 1. Parse amount from JSONB
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

    -- 3. Determine Paid vs Outstanding
    IF v_balance < v_amount THEN
        v_paid := GREATEST(0, v_balance);
        v_outstanding := v_amount - v_paid;
        v_status := 'LOCKED_UNPAID';
        v_order_status := 'LOCKED';
    ELSE
        v_paid := v_amount;
        v_outstanding := 0;
        v_status := 'Awaiting';
        v_order_status := 'PENDING';
    END IF;

    -- 4. Atomic Transition: Deduct Balance & Increase Frozen
    -- Only deduct what's available
    UPDATE public.users 
    SET balance = balance - v_paid,
        frozen = COALESCE(frozen, 0) + v_paid
    WHERE id = p_user_id;

    -- 5. Create the Trade Record
    INSERT INTO public.trades (
        user_id, symbol, name, type, quantity, requested_quantity, requested_amount, price, total_amount, 
        status, order_status, created_at, product_id, paid_amount, outstanding_amount
    ) VALUES (
        p_user_id, 
        p_trade_data->>'symbol', 
        p_trade_data->>'name', 
        p_trade_data->>'type', 
        (p_trade_data->>'quantity')::DECIMAL,
        COALESCE((p_trade_data->>'requested_quantity')::DECIMAL, (p_trade_data->>'quantity')::DECIMAL),
        COALESCE((p_trade_data->>'requested_amount')::DECIMAL, v_amount),
        (p_trade_data->>'price')::DECIMAL, 
        v_amount,
        v_status, 
        v_order_status, 
        NOW(), 
        (p_trade_data->>'product_id')::INT,
        v_paid,
        v_outstanding
    ) RETURNING id INTO v_trade_id;

    RETURN jsonb_build_object(
        'success', true, 
        'trade_id', v_trade_id, 
        'status', v_status,
        'paid', v_paid,
        'outstanding', v_outstanding
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'SUBSCRIPTION FAILED: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
