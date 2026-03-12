-- Final Fix for Stuck LOCKED_UNPAID Trades (v2)
-- This script calculates exactly how much capital a user has paid towards their locked trades,
-- and dynamically applies it to clear them sequentially.

DO $$
DECLARE
    u RECORD;
    t RECORD;
    v_total_trade_debt DECIMAL;
    v_true_negative_balance DECIMAL;
    v_paid_capital DECIMAL;
    v_pay DECIMAL;
BEGIN
    -- Loop over all users who have at least one LOCKED_UNPAID trade
    FOR u IN (SELECT DISTINCT user_id FROM public.trades WHERE status = 'LOCKED_UNPAID') LOOP
        
        -- Get the user's actual balance
        SELECT balance INTO v_true_negative_balance FROM public.users WHERE id = u.user_id;
        
        -- Cap balance at 0 for deficit calc (if balance >= 0, deficit is 0)
        v_true_negative_balance := LEAST(v_true_negative_balance, 0);

        -- Get total outstanding debt from their locked trades
        SELECT COALESCE(SUM(outstanding_amount), 0) INTO v_total_trade_debt 
        FROM public.trades 
        WHERE user_id = u.user_id AND status = 'LOCKED_UNPAID';

        -- Calculate how much capital they have already deposited towards this debt
        v_paid_capital := v_total_trade_debt - ABS(v_true_negative_balance);

        -- Distribute capital sequentially
        FOR t IN (SELECT * FROM public.trades WHERE user_id = u.user_id AND status = 'LOCKED_UNPAID' ORDER BY created_at ASC) LOOP
            IF t.outstanding_amount <= 0 THEN
                -- Already paid, just unlock it
                UPDATE public.trades 
                SET status = 'Holding', order_status = 'FILLED'
                WHERE id = t.id;
                RAISE NOTICE 'Auto-unlocked fully paid trade %', t.id;
            ELSIF v_paid_capital > 0 THEN
                v_pay := LEAST(v_paid_capital, t.outstanding_amount);
                
                -- Settle Trade
                UPDATE public.trades 
                SET outstanding_amount = outstanding_amount - v_pay,
                    paid_amount = COALESCE(paid_amount, 0) + v_pay,
                    status = CASE WHEN (outstanding_amount - v_pay) <= 0 THEN 'Holding' ELSE status END,
                    order_status = CASE WHEN (outstanding_amount - v_pay) <= 0 THEN 'FILLED' ELSE order_status END
                WHERE id = t.id;
                
                v_paid_capital := v_paid_capital - v_pay;
                RAISE NOTICE 'Applied % to trade %', v_pay, t.id;
            END IF;
        END LOOP;
        
        -- Ensure user's outstanding field is corrected natively
        UPDATE public.users 
        SET outstanding = ABS(v_true_negative_balance)
        WHERE id = u.user_id;

    END LOOP;
END;
$$;
