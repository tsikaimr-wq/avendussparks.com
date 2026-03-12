-- Settlement Atomic RPC
-- Safely deducts balance and updates trade outstanding amount.

CREATE OR REPLACE FUNCTION public.settle_trade_balance_atomic(
    p_user_id INT,
    p_trade_id INT,
    p_amount DECIMAL
) RETURNS JSONB AS $$
DECLARE
    v_balance DECIMAL;
    v_outstanding DECIMAL;
    v_paid DECIMAL;
BEGIN
    -- 1. Lock User & Trade
    SELECT balance INTO v_balance FROM public.users WHERE id = p_user_id FOR UPDATE;
    SELECT outstanding_amount INTO v_outstanding FROM public.trades WHERE id = p_trade_id FOR UPDATE;

    IF v_balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance to settle.');
    END IF;

    IF v_outstanding <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No outstanding balance for this trade.');
    END IF;

    -- 2. Determine payment
    v_paid := LEAST(v_outstanding, p_amount);

    -- 3. Deduct from balance
    UPDATE public.users SET balance = balance - v_paid WHERE id = p_user_id;

    -- 4. Update Trade
    UPDATE public.trades 
    SET paid_amount = paid_amount + v_paid,
        outstanding_amount = outstanding_amount - v_paid,
        status = CASE WHEN (outstanding_amount - v_paid) <= 0 THEN 'Approved' ELSE status END,
        order_status = CASE WHEN (outstanding_amount - v_paid) <= 0 THEN 'PENDING' ELSE order_status END
    WHERE id = p_trade_id;

    RETURN jsonb_build_object('success', true, 'paid', v_paid, 'new_outstanding', v_outstanding - v_paid);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'SETTLEMENT FAILED: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
