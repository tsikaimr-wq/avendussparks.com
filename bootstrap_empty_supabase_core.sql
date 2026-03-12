-- Bootstrap core schema for an empty Supabase project
-- Target: make AvendusCapital frontend/admin usable on a fresh database.

BEGIN;

-- =========================
-- Core tables
-- =========================

CREATE TABLE IF NOT EXISTS public.admins (
    id BIGSERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT,
    password_plain TEXT,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'super_admin',
    status TEXT NOT NULL DEFAULT 'active',
    invitation_code TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS public.users (
    id BIGSERIAL PRIMARY KEY,
    auth_id UUID UNIQUE,
    mobile TEXT UNIQUE,
    email TEXT UNIQUE,
    password TEXT,
    username TEXT,
    full_name TEXT,
    id_number TEXT,
    address TEXT,
    dob DATE,
    gender TEXT,
    withdrawal_pin TEXT,
    kyc TEXT DEFAULT 'Pending',
    credit_score INTEGER DEFAULT 100,
    vip INTEGER DEFAULT 0,
    balance NUMERIC(20,2) DEFAULT 0,
    invested NUMERIC(20,2) DEFAULT 0,
    frozen NUMERIC(20,2) DEFAULT 0,
    outstanding NUMERIC(20,2) DEFAULT 0,
    bonus NUMERIC(20,2) DEFAULT 0,
    negative_balance BOOLEAN DEFAULT FALSE,
    loan_enabled BOOLEAN DEFAULT FALSE,
    loan_balance NUMERIC(20,2) DEFAULT 0,
    trading_frozen BOOLEAN DEFAULT FALSE,
    failed_login_attempts INTEGER DEFAULT 0,
    csr_id BIGINT REFERENCES public.admins(id) ON DELETE SET NULL,
    invitation_code TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS public.products (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    symbol TEXT,
    market_symbol TEXT,
    product_type TEXT DEFAULT 'IPO',
    type TEXT DEFAULT 'IPO',
    exchange TEXT DEFAULT 'NSE',
    price NUMERIC(20,2) DEFAULT 0,
    subscription_price NUMERIC(20,2) DEFAULT 0,
    est_profit_percent NUMERIC(10,2) DEFAULT 0,
    profit TEXT,
    start_date TEXT,
    end_date TEXT,
    allotment_date TEXT,
    allocation_date TEXT,
    listing_date TEXT,
    lockup_days INTEGER DEFAULT 0,
    min_invest NUMERIC(20,2) DEFAULT 0,
    max_invest NUMERIC(20,2) DEFAULT 10000000,
    total_shares NUMERIC(20,2) DEFAULT 1000000,
    available_shares NUMERIC(20,2) DEFAULT 1000000,
    subscription_count INTEGER DEFAULT 0,
    description TEXT,
    status TEXT DEFAULT 'Active',
    is_premium BOOLEAN DEFAULT FALSE,
    created_by BIGINT REFERENCES public.admins(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS public.trades (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    product_id BIGINT REFERENCES public.products(id) ON DELETE SET NULL,
    symbol TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'stock',
    quantity NUMERIC(20,2) DEFAULT 0,
    requested_quantity NUMERIC(20,2),
    approved_quantity NUMERIC(20,2),
    price NUMERIC(20,2) DEFAULT 0,
    total_amount NUMERIC(20,2) DEFAULT 0,
    final_total_amount NUMERIC(20,2) DEFAULT 0,
    paid_amount NUMERIC(20,2) DEFAULT 0,
    outstanding_amount NUMERIC(20,2) DEFAULT 0,
    tax_amount NUMERIC(20,2) DEFAULT 0,
    txn_charge NUMERIC(20,2) DEFAULT 0,
    sell_price NUMERIC(20,2),
    total_sale_value NUMERIC(20,2),
    realised_profit NUMERIC(20,2),
    sell_tax NUMERIC(20,2),
    sell_fees NUMERIC(20,2),
    status TEXT DEFAULT 'Pending',
    order_status TEXT DEFAULT 'OPEN',
    admin_note TEXT,
    approved_by BIGINT REFERENCES public.admins(id) ON DELETE SET NULL,
    approved_role TEXT,
    approved_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sell_timestamp TIMESTAMPTZ,
    lockup_until TIMESTAMPTZ,
    allotment_date TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS public.deposits (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount NUMERIC(20,2) NOT NULL DEFAULT 0,
    method TEXT,
    image_url TEXT,
    status TEXT DEFAULT 'Pending',
    admin_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS public.withdrawals (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount NUMERIC(20,2) NOT NULL DEFAULT 0,
    bank_name TEXT,
    status TEXT DEFAULT 'Pending',
    admin_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS public.messages (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    sender TEXT DEFAULT 'User',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS public.loans (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount NUMERIC(20,2) NOT NULL DEFAULT 0,
    approved_amount NUMERIC(20,2),
    purpose TEXT,
    reason TEXT,
    status TEXT DEFAULT 'Pending',
    admin_note TEXT,
    amount_paid NUMERIC(20,2) DEFAULT 0,
    repayment_schedule JSONB DEFAULT '[]'::jsonb,
    due_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS public.kyc_submissions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    id_type TEXT,
    id_front_url TEXT,
    id_back_url TEXT,
    selfie_url TEXT,
    status TEXT DEFAULT 'Pending',
    admin_note TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'system',
    status TEXT DEFAULT 'unread',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.platform_settings (
    key TEXT PRIMARY KEY,
    value JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed admin account for login bootstrap
INSERT INTO public.admins (username, password, password_plain, full_name, role, status)
VALUES ('admin', 'admin123', 'admin123', 'System Admin', 'super_admin', 'active')
ON CONFLICT (username) DO NOTHING;

INSERT INTO public.platform_settings (key, value)
VALUES ('institutional_config', '{"status": "Online", "max_qty": 1000000}'::jsonb)
ON CONFLICT (key) DO NOTHING;

COMMIT;

-- =========================
-- RLS setup (disabled to match current frontend usage with anon key)
-- =========================
ALTER TABLE public.admins DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings DISABLE ROW LEVEL SECURITY;

-- =========================
-- Atomic RPCs used by frontend/admin
-- =========================

CREATE OR REPLACE FUNCTION public.submit_subscription_atomic(
    p_user_id INT,
    p_trade_data JSONB
) RETURNS JSONB AS $$
DECLARE
    v_trade_id BIGINT;
    v_type TEXT;
    v_status TEXT;
    v_order_status TEXT;
    v_amount NUMERIC;
    v_product_id BIGINT;
    v_min_invest NUMERIC;
    v_balance NUMERIC;
BEGIN
    v_type := LOWER(COALESCE(p_trade_data->>'type', 'stock'));
    v_product_id := NULLIF(p_trade_data->>'product_id', '')::BIGINT;

    IF v_type = 'ipo' THEN
        v_status := 'AWAITING_APPROVAL';
        v_order_status := 'PENDING';
        SELECT COALESCE(min_invest, 0) INTO v_min_invest FROM public.products WHERE id = v_product_id;
        v_amount := COALESCE(v_min_invest, NULLIF(p_trade_data->>'total_amount', '')::NUMERIC, 0);
    ELSIF v_type = 'otc' THEN
        v_status := 'AWAITING_APPROVAL';
        v_order_status := 'PENDING';
        v_amount := COALESCE(NULLIF(p_trade_data->>'total_amount', '')::NUMERIC, 0);
    ELSE
        v_status := COALESCE(p_trade_data->>'status', 'Pending');
        v_order_status := COALESCE(p_trade_data->>'order_status', 'OPEN');
        v_amount := COALESCE(NULLIF(p_trade_data->>'total_amount', '')::NUMERIC, 0);
    END IF;

    INSERT INTO public.trades (
        user_id,
        product_id,
        symbol,
        name,
        type,
        quantity,
        requested_quantity,
        price,
        total_amount,
        tax_amount,
        txn_charge,
        status,
        order_status,
        admin_note,
        allotment_date
    ) VALUES (
        p_user_id,
        v_product_id,
        COALESCE(p_trade_data->>'symbol', ''),
        COALESCE(p_trade_data->>'name', ''),
        COALESCE(p_trade_data->>'type', 'stock'),
        COALESCE(NULLIF(p_trade_data->>'quantity', '')::NUMERIC, 0),
        COALESCE(NULLIF(p_trade_data->>'requested_quantity', '')::NUMERIC, NULLIF(p_trade_data->>'quantity', '')::NUMERIC, 0),
        COALESCE(NULLIF(p_trade_data->>'price', '')::NUMERIC, 0),
        v_amount,
        COALESCE(NULLIF(p_trade_data->>'tax_amount', '')::NUMERIC, 0),
        COALESCE(NULLIF(p_trade_data->>'txn_charge', '')::NUMERIC, 0),
        v_status,
        v_order_status,
        p_trade_data->>'admin_note',
        NULLIF(p_trade_data->>'allotment_date', '')::TIMESTAMPTZ
    ) RETURNING id INTO v_trade_id;

    -- IPO: no deduction on submit, deduct on approval
    IF v_type = 'ipo' THEN
        RETURN jsonb_build_object(
            'success', true,
            'trade_id', v_trade_id,
            'frozen_amount', 0,
            'balance_deducted', false,
            'status', v_status
        );
    END IF;

    -- OTC/STOCK: reserve funds at submit when possible
    SELECT COALESCE(balance, 0) INTO v_balance FROM public.users WHERE id = p_user_id FOR UPDATE;
    IF v_balance >= v_amount AND v_amount > 0 THEN
        UPDATE public.users
        SET balance = COALESCE(balance, 0) - v_amount,
            frozen = COALESCE(frozen, 0) + v_amount
        WHERE id = p_user_id;

        RETURN jsonb_build_object(
            'success', true,
            'trade_id', v_trade_id,
            'frozen_amount', v_amount,
            'balance_deducted', true,
            'status', v_status
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'trade_id', v_trade_id,
        'frozen_amount', 0,
        'balance_deducted', false,
        'warning', 'Insufficient balance, trade kept pending.',
        'status', v_status
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'SUBSCRIPTION FAILED: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


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

    -- IPO on AWAITING_APPROVAL normally has no pre-reserved funds.
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


CREATE OR REPLACE FUNCTION public.reject_subscription_atomic(
    p_trade_id INT,
    p_auth_id INT,
    p_auth_role TEXT
) RETURNS JSONB AS $$
DECLARE
    v_user_id INT;
    v_amount NUMERIC;
BEGIN
    SELECT user_id, COALESCE(total_amount, 0)
    INTO v_user_id, v_amount
    FROM public.trades
    WHERE id = p_trade_id
    FOR UPDATE;

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trade not found');
    END IF;

    UPDATE public.users
    SET
        balance = COALESCE(balance, 0) + v_amount,
        frozen = GREATEST(0, COALESCE(frozen, 0) - v_amount)
    WHERE id = v_user_id;

    UPDATE public.trades
    SET
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
    SELECT COALESCE(balance, 0) INTO v_balance FROM public.users WHERE id = p_user_id FOR UPDATE;
    SELECT COALESCE(outstanding_amount, 0) INTO v_outstanding FROM public.trades WHERE id = p_trade_id FOR UPDATE;

    IF v_balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance to settle.');
    END IF;

    IF v_outstanding <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No outstanding balance for this trade.');
    END IF;

    v_paid := LEAST(v_outstanding, p_amount);

    UPDATE public.users
    SET balance = COALESCE(balance, 0) - v_paid,
        outstanding = GREATEST(0, COALESCE(outstanding, 0) - v_paid),
        negative_balance = (COALESCE(balance, 0) - v_paid) < 0
    WHERE id = p_user_id;

    UPDATE public.trades
    SET
        paid_amount = COALESCE(paid_amount, 0) + v_paid,
        outstanding_amount = GREATEST(0, COALESCE(outstanding_amount, 0) - v_paid),
        status = CASE WHEN (COALESCE(outstanding_amount, 0) - v_paid) <= 0 THEN 'Holding' ELSE status END,
        order_status = CASE WHEN (COALESCE(outstanding_amount, 0) - v_paid) <= 0 THEN 'FILLED' ELSE order_status END
    WHERE id = p_trade_id;

    RETURN jsonb_build_object('success', true, 'paid', v_paid, 'new_outstanding', GREATEST(0, v_outstanding - v_paid));
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'SETTLEMENT FAILED: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
