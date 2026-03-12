-- IPO Approval Deduction Fix
-- Goal: when admin approves IPO, deduct by approved quantity * subscription price at approval time.
-- This function supports both old "frozen-at-submit" and new "awaiting-approval-without-freeze" flows.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS balance NUMERIC DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS frozen NUMERIC DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS invested NUMERIC DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS outstanding NUMERIC DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS negative_balance BOOLEAN DEFAULT FALSE;

UPDATE public.users
SET
    balance = COALESCE(balance, 0),
    frozen = COALESCE(frozen, 0),
    invested = COALESCE(invested, 0),
    outstanding = COALESCE(outstanding, 0)
WHERE balance IS NULL OR frozen IS NULL OR invested IS NULL OR outstanding IS NULL;

ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS outstanding_amount NUMERIC DEFAULT 0;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS final_total_amount NUMERIC DEFAULT 0;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS approved_quantity NUMERIC;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS order_status TEXT DEFAULT 'OPEN';
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS lockup_until TIMESTAMPTZ;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS allotment_date TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.approve_subscription_atomic(
    p_trade_id INT,
    p_approved_qty DECIMAL,
    p_auth_id INT,
    p_auth_role TEXT
) RETURNS JSONB AS $$
DECLARE
    v_user_id INT;
    v_type TEXT;
    v_trade_price DECIMAL;
    v_total_amount DECIMAL;
    v_paid_amount DECIMAL;
    v_product_id INT;
    v_pre_status TEXT;
    v_pre_order_status TEXT;

    v_curr_balance DECIMAL;
    v_curr_frozen DECIMAL;
    v_curr_invested DECIMAL;
    v_curr_outstanding DECIMAL;

    v_lockup_days INT;
    v_listing_date TEXT;

    v_approved_val DECIMAL;
    v_reserved_amount DECIMAL;
    v_refund_amount DECIMAL;
    v_missing_deduct DECIMAL;
    v_new_balance DECIMAL;

    v_prev_negative DECIMAL;
    v_new_negative DECIMAL;
    v_debt_delta DECIMAL;
    v_paid_increment DECIMAL;

    v_final_status TEXT;
    v_final_order_status TEXT;
BEGIN
    SELECT
        user_id,
        LOWER(COALESCE(type, '')),
        COALESCE(price, 0),
        COALESCE(total_amount, 0),
        COALESCE(paid_amount, 0),
        product_id,
        UPPER(COALESCE(status, '')),
        UPPER(COALESCE(order_status, ''))
    INTO
        v_user_id,
        v_type,
        v_trade_price,
        v_total_amount,
        v_paid_amount,
        v_product_id,
        v_pre_status,
        v_pre_order_status
    FROM public.trades
    WHERE id = p_trade_id
    FOR UPDATE;

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trade not found');
    END IF;

    SELECT
        COALESCE(balance, 0),
        COALESCE(frozen, 0),
        COALESCE(invested, 0),
        COALESCE(outstanding, 0)
    INTO
        v_curr_balance,
        v_curr_frozen,
        v_curr_invested,
        v_curr_outstanding
    FROM public.users
    WHERE id = v_user_id
    FOR UPDATE;

    IF v_product_id IS NOT NULL THEN
        SELECT COALESCE(lockup_days, 0), listing_date
        INTO v_lockup_days, v_listing_date
        FROM public.products
        WHERE id = v_product_id;
    ELSE
        v_lockup_days := 0;
        v_listing_date := NULL;
    END IF;

    v_approved_val := GREATEST(0, COALESCE(p_approved_qty, 0) * COALESCE(v_trade_price, 0));

    -- New IPO flow: AWAITING_APPROVAL means no reservation at submit time.
    -- Old flow: Pending means funds might already be reserved in frozen.
    IF v_type LIKE '%ipo%' AND v_pre_status IN ('AWAITING_APPROVAL', 'AWAITING') THEN
        v_reserved_amount := 0;
    ELSE
        v_reserved_amount := LEAST(COALESCE(v_total_amount, 0), COALESCE(v_curr_frozen, 0));
    END IF;

    v_refund_amount := GREATEST(0, v_reserved_amount - v_approved_val);
    v_missing_deduct := GREATEST(0, v_approved_val - v_reserved_amount - COALESCE(v_paid_amount, 0));

    v_new_balance := v_curr_balance - v_missing_deduct + v_refund_amount;

    v_prev_negative := GREATEST(0, -v_curr_balance);
    v_new_negative := GREATEST(0, -v_new_balance);
    v_debt_delta := GREATEST(0, v_new_negative - v_prev_negative);
    v_paid_increment := GREATEST(0, v_missing_deduct - v_debt_delta);

    IF ROUND(v_new_balance, 2) < 0 THEN
        v_final_status := 'LOCKED_UNPAID';
        v_final_order_status := 'LOCKED';
    ELSE
        v_final_status := 'Holding';
        v_final_order_status := 'FILLED';
    END IF;

    UPDATE public.users
    SET
        balance = v_new_balance,
        frozen = GREATEST(0, v_curr_frozen - v_reserved_amount),
        invested = v_curr_invested + v_approved_val,
        outstanding = GREATEST(0, v_curr_outstanding + v_debt_delta),
        negative_balance = (ROUND(v_new_balance, 2) < 0)
    WHERE id = v_user_id;

    UPDATE public.trades
    SET
        status = v_final_status,
        order_status = v_final_order_status,
        approved_quantity = p_approved_qty,
        quantity = p_approved_qty,
        final_total_amount = v_approved_val,
        total_amount = v_approved_val,
        paid_amount = COALESCE(paid_amount, 0) + v_paid_increment,
        outstanding_amount = GREATEST(0, COALESCE(outstanding_amount, 0) + v_debt_delta),
        approved_by = p_auth_id,
        approved_role = p_auth_role,
        approved_at = NOW(),
        processed_at = NOW(),
        allotment_date = COALESCE(allotment_date, NOW()),
        lockup_until = CASE
            WHEN v_lockup_days > 0 AND v_listing_date IS NOT NULL AND v_listing_date <> '' THEN
                (v_listing_date::TIMESTAMPTZ) + (v_lockup_days || ' days')::INTERVAL
            ELSE lockup_until
        END
    WHERE id = p_trade_id;

    RETURN jsonb_build_object(
        'success', true,
        'approved_val', v_approved_val,
        'reserved_amount', v_reserved_amount,
        'to_deduct', v_missing_deduct,
        'returned_amount', v_refund_amount,
        'new_balance', v_new_balance,
        'status', v_final_status
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'POSTGRES EXCEPTION: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
