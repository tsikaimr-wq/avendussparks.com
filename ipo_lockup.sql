-- Add lockup_days to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS lockup_days INTEGER DEFAULT 0;

-- Add lockup_until to trades table
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS lockup_until TIMESTAMPTZ;

-- Update approve_subscription_atomic to handle lockup calculation
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
BEGIN
    -- 1. Fetch Trade & Product Info
    SELECT user_id, total_amount, product_id, type 
    INTO v_user_id, v_orig_frozen, v_product_id, v_type
    FROM public.trades WHERE id = p_trade_id;

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trade not found');
    END IF;

    -- Fetch lockup_days if it's an IPO
    IF v_type = 'IPO' OR v_type = 'ipo' THEN
        SELECT COALESCE(lockup_days, 0) INTO v_lockup_days FROM public.products WHERE id = v_product_id;
    ELSE
        v_lockup_days := 0;
    END IF;

    -- 2. Calculate Values
    -- For IPO/OTC, price is stored in the trade. 
    -- value = quantity * price
    SELECT (p_approved_qty * price) INTO v_approved_val 
    FROM public.trades WHERE id = p_trade_id;

    v_excess := v_orig_frozen - v_approved_val;

    -- 3. Transition Wallet
    -- Deduct full original frozen amount, Add approved to invested, Add excess back to balance
    UPDATE public.users 
    SET frozen = GREATEST(0, COALESCE(frozen, 0) - v_orig_frozen),
        invested = COALESCE(invested, 0) + v_approved_val,
        balance = balance + GREATEST(0, v_excess)
    WHERE id = v_user_id;

    -- 4. Finalize Trade Record
    UPDATE public.trades SET
        status = 'Holding', -- Changed to 'Holding' to ensure it appears in portfolio
        approved_quantity = p_approved_qty,
        total_amount = v_approved_val, -- Update to actual approved value
        order_status = 'FILLED',
        approved_by = p_auth_id,
        approved_role = p_auth_role,
        approved_at = NOW(),
        processed_at = NOW(),
        lockup_until = CASE WHEN v_lockup_days > 0 THEN NOW() + (v_lockup_days || ' days')::INTERVAL ELSE NULL END,
        admin_note = CASE WHEN v_excess > 0 THEN 'Partial Approval. ₹' || v_excess || ' returned to balance.' ELSE admin_note END
    WHERE id = p_trade_id;

    RETURN jsonb_build_object('success', true, 'approved_val', v_approved_val, 'returned_val', v_excess);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'POSTGRES EXCEPTION: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backend Protection: Trigger to block selling if locked
CREATE OR REPLACE FUNCTION public.check_ipo_lockup() 
RETURNS TRIGGER AS $$
BEGIN
    -- If status is being changed to 'Sold', check lockup_until
    IF (NEW.status = 'Sold' AND OLD.status != 'Sold') THEN
        IF (OLD.lockup_until IS NOT NULL AND OLD.lockup_until > NOW()) THEN
            RAISE EXCEPTION 'IPO_LOCKED: This position is under lock-up until %', OLD.lockup_until;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_ipo_lockup ON public.trades;
CREATE TRIGGER trg_check_ipo_lockup
BEFORE UPDATE ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.check_ipo_lockup();
