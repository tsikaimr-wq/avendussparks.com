-- ==========================================
-- FINAL IPO & OTC HOLDINGS RECOVERY & LOCK-UP REPAIR
-- ==========================================

-- 1. Ensure Columns Exist & Initialized (Wallet Initialization for New Users)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS lockup_days INTEGER DEFAULT 0;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS product_id INTEGER REFERENCES public.products(id) ON DELETE SET NULL;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS lockup_until TIMESTAMPTZ;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS order_status TEXT DEFAULT 'OPEN';

-- Fix potential NULLs for Wallet fields to prevent arithmetic failures
ALTER TABLE public.users ALTER COLUMN balance SET DEFAULT 0;
ALTER TABLE public.users ALTER COLUMN frozen SET DEFAULT 0;
ALTER TABLE public.users ALTER COLUMN invested SET DEFAULT 0;
ALTER TABLE public.users ALTER COLUMN outstanding SET DEFAULT 0;

UPDATE public.users SET balance = 0 WHERE balance IS NULL;
UPDATE public.users SET frozen = 0 WHERE frozen IS NULL;
UPDATE public.users SET invested = 0 WHERE invested IS NULL;
UPDATE public.users SET outstanding = 0 WHERE outstanding IS NULL;

-- 2. Update Status Constraint (Fixing 'violates check constraint trades_status_check')
ALTER TABLE public.trades DROP CONSTRAINT IF EXISTS trades_status_check;
ALTER TABLE public.trades ADD CONSTRAINT trades_status_check 
CHECK (status IN ('Holding', 'Sold', 'Pending', 'Approved', 'Settled', 'Rejected', 'Awaiting', 'Confirmed'));

-- 3. Audit Log Table
CREATE TABLE IF NOT EXISTS public.lockup_logs (
    id SERIAL PRIMARY KEY,
    trade_id INT REFERENCES public.trades(id) ON DELETE CASCADE,
    admin_id INT, 
    admin_role TEXT,
    action TEXT, -- 'OVERRIDE', 'EXTEND', 'MODIFY'
    prev_lockup_until TIMESTAMPTZ,
    new_lockup_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Standardize Existing Data (Recover missing Holdings)
-- If a trade was 'Settled' but didn't show in Portfolio, move it to 'Holding' and 'FILLED'
UPDATE public.trades 
SET status = 'Holding', order_status = 'FILLED' 
WHERE status IN ('Settled', 'Approved', 'Confirmed') AND status != 'Holding';

-- Ensure all 'Sold' trades are CLOSED
UPDATE public.trades SET order_status = 'CLOSED' WHERE status = 'Sold' AND order_status != 'CLOSED';

-- Ensure all current 'Holding' are 'FILLED'
UPDATE public.trades SET order_status = 'FILLED' WHERE status = 'Holding' AND (order_status IS NULL OR order_status = 'OPEN');

-- 4. ATOMIC SUBSCRIPTION SUBMIT (RESILIENT TO NULL WALLETS)
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
    -- We still prefer a product_id, but we won't block the trade if it's missing,
    -- allowing mock data to be tested.
    
    -- 3. Status & Amount Selection
    IF v_type = 'ipo' THEN
        v_status := 'Pending';
        v_order_status := 'PENDING';
        SELECT min_invest INTO v_min_invest FROM public.products WHERE id = v_product_id;
        v_amount := COALESCE(v_min_invest, (p_trade_data->>'total_amount')::DECIMAL);
    ELSE
        v_status := 'Pending';
        v_order_status := 'OPEN';
        v_amount := (p_trade_data->>'total_amount')::DECIMAL;
    END IF;

    IF v_amount IS NULL OR v_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid subscription amount.');
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

    v_balance := COALESCE(v_balance, 0);

    -- Only deduct if balance is sufficient
    IF v_balance >= v_amount THEN
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
        -- DO NOT ROLLBACK. Keep the trade record as 'Pending'.
        -- This allows the admin to see the 'Outstanding' attempt.
        -- We return success: true because the trade WAS inserted.
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
    -- Only rollback on CRITICAL system errors (not business logic like low balance)
    RETURN jsonb_build_object('success', false, 'error', 'SUBSCRIPTION FAILED: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. ATOMIC ADMIN APPROVE (Supports Partial Lots)
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

-- 6. Unified Reject Function
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
        RETURN jsonb_build_object('success', false, 'error', 'Trade record not found.');
    END IF;

    -- Reversal: Frozen -> Balance
    UPDATE public.users 
    SET balance = balance + v_amount,
        frozen = GREATEST(0, COALESCE(frozen, 0) - v_amount)
    WHERE id = v_user_id;

    -- Update Trade
    UPDATE public.trades SET
        status = 'Rejected',
        order_status = 'CANCELLED',
        processed_at = NOW(),
        approved_by = p_auth_id,
        approved_role = p_auth_role
    WHERE id = p_trade_id;

    RETURN jsonb_build_object('success', true, 'returned_amount', v_amount);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'POSTGRES EXCEPTION: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Lock-up Management
CREATE OR REPLACE FUNCTION public.manage_ipo_lockup(
    p_trade_id INT,
    p_admin_id INT,
    p_admin_role TEXT,
    p_action TEXT,
    p_new_date TIMESTAMPTZ,
    p_extra_days INT
) RETURNS JSONB AS $$
DECLARE
    v_prev_date TIMESTAMPTZ;
    v_final_date TIMESTAMPTZ;
BEGIN
    IF p_admin_role != 'super_admin' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Permission Denied.');
    END IF;

    SELECT lockup_until INTO v_prev_date FROM public.trades WHERE id = p_trade_id;

    CASE p_action
        WHEN 'OVERRIDE' THEN v_final_date := NOW();
        WHEN 'EXTEND' THEN v_final_date := COALESCE(v_prev_date, NOW()) + (p_extra_days || ' days')::INTERVAL;
        WHEN 'MODIFY' THEN v_final_date := p_new_date;
        ELSE RETURN jsonb_build_object('success', false, 'error', 'Invalid Action');
    END CASE;

    UPDATE public.trades SET lockup_until = v_final_date WHERE id = p_trade_id;

    INSERT INTO public.lockup_logs (trade_id, admin_id, admin_role, action, prev_lockup_until, new_lockup_until)
    VALUES (p_trade_id, p_admin_id, p_admin_role, p_action, v_prev_date, v_final_date);

    RETURN jsonb_build_object('success', true, 'new_lockup_until', v_final_date);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reload schema
NOTIFY pgrst, 'reload schema';
