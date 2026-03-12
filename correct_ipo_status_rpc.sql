-- SQL REPAIR PATCH: Correcting IPO/OTC Order Status Flow
-- Description: Updates the approve_subscription_atomic RPC to ensure approved trades 
-- are transitioned to "Holding" and "FILLED" instead of "Sold" or "Settled".
-- Execute this script in the Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.approve_subscription_atomic(
    p_trade_id INT,
    p_approved_qty DECIMAL,
    p_auth_id INT,
    p_auth_role TEXT
) RETURNS JSONB AS $$
DECLARE
    v_user_id INT;
    v_orig_frozen DECIMAL;
    v_approved_val DECIMAL;
    v_excess DECIMAL;
    v_product_id INT;
    v_lockup_days INT;
    v_type TEXT;
    v_price DECIMAL;
    v_listing_date TEXT;
BEGIN
    -- 1. Fetch current record within transaction lock
    SELECT user_id, total_amount, product_id, type, price 
    INTO v_user_id, v_orig_frozen, v_product_id, v_type, v_price
    FROM public.trades WHERE id = p_trade_id FOR UPDATE;

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trade record not found.');
    END IF;

    -- 2. Fetch Product Stats (Listing Date is critical for Lock-up start)
    IF v_product_id IS NOT NULL THEN
        SELECT COALESCE(lockup_days, 0), listing_date INTO v_lockup_days, v_listing_date FROM public.products WHERE id = v_product_id;
    ELSE
        v_lockup_days := 0;
        v_listing_date := NULL;
    END IF;

    -- 3. Calculate Values
    v_approved_val := p_approved_qty * v_price;
    v_excess := v_orig_frozen - v_approved_val;

    -- 4. ATOMIC TRANSITION: Update Wallet
    UPDATE public.users 
    SET frozen = GREATEST(0, COALESCE(frozen, 0) - v_orig_frozen),
        invested = COALESCE(invested, 0) + v_approved_val,
        balance = balance + GREATEST(0, v_excess)
    WHERE id = v_user_id;

    -- 5. ATOMIC TRANSITION: Update Trade Record
    UPDATE public.trades SET
        status = 'Holding',         -- STANDARD: Must be 'Holding' for Portfolio visibility
        order_status = 'FILLED',    -- STANDARD: Must be 'FILLED' for filled orders
        approved_quantity = p_approved_qty,
        quantity = p_approved_qty,   -- Update active quantity
        total_amount = v_approved_val,
        approved_by = p_auth_id,
        approved_role = p_auth_role,
        approved_at = NOW(),
        processed_at = NOW(),
        allotment_date = NOW(),
        lockup_until = CASE 
            WHEN v_lockup_days > 0 AND v_listing_date IS NOT NULL AND v_listing_date <> '' THEN 
                (v_listing_date::TIMESTAMPTZ) + (v_lockup_days || ' days')::INTERVAL 
            ELSE NULL 
        END,
        admin_note = CASE WHEN v_excess > 0 THEN 'Partial Approval. ₹' || v_excess || ' returned to balance.' ELSE admin_note END
    WHERE id = p_trade_id;

    RETURN jsonb_build_object('success', true, 'approved_val', v_approved_val, 'returned_val', v_excess);

EXCEPTION WHEN OTHERS THEN
    -- PL/pgSQL rolls back the subtransaction automatically, but we ensure error reporting
    RETURN jsonb_build_object('success', false, 'error', 'POSTGRES EXCEPTION: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reload schema
NOTIFY pgrst, 'reload schema';
