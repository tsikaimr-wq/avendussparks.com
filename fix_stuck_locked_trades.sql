-- Fix Stuck LOCKED_UNPAID Trades
-- This script safely resolves any LOCKED_UNPAID trades where the user has already completely paid off their account debt (outstanding = 0).

DO $$
DECLARE
    t RECORD;
    u RECORD;
BEGIN
    FOR t IN SELECT * FROM public.trades WHERE status = 'LOCKED_UNPAID' LOOP
        -- Fetch the user who owns this stuck trade
        SELECT * INTO u FROM public.users WHERE id = t.user_id;

        -- If the user has a positive or 0 balance AND their overall outstanding debt is 0,
        -- it means they successfully deposited the funds but the system failed to settle the trade previously.
        IF u.balance >= 0 AND u.outstanding <= 0 THEN
            -- Settle the trade
            UPDATE public.trades 
            SET status = 'Holding', 
                order_status = 'FILLED', 
                paid_amount = paid_amount + outstanding_amount,
                outstanding_amount = 0
            WHERE id = t.id;
            
            RAISE NOTICE 'Auto-settled stuck trade ID % for User %', t.id, t.user_id;
        END IF;

    END LOOP;
END;
$$;
