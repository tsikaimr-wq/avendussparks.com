-- Bulletproof Sync: Users Table to Trades Table
-- When Admin edits 'balance' or 'outstanding' manually, automatically propagate changes to 'trades' table.

CREATE OR REPLACE FUNCTION public.sync_user_financials_to_trades()
RETURNS TRIGGER AS $$
DECLARE
    t RECORD;
    v_total_trade_debt DECIMAL;
    v_true_negative_balance DECIMAL;
    v_paid_capital DECIMAL;
    v_pay DECIMAL;
BEGIN
    -- Only run this deep sync if the user currently has LOCKED_UNPAID trades
    IF EXISTS (SELECT 1 FROM public.trades WHERE user_id = NEW.id AND status = 'LOCKED_UNPAID') THEN
        
        -- Cap balance at 0 for deficit calc (if balance >= 0, deficit is 0)
        v_true_negative_balance := LEAST(COALESCE(NEW.balance, 0), 0);

        -- Get total outstanding debt from top-down aggregated trades
        SELECT COALESCE(SUM(outstanding_amount), 0) INTO v_total_trade_debt 
        FROM public.trades 
        WHERE user_id = NEW.id AND status = 'LOCKED_UNPAID';

        -- If the admin forcefully set 'outstanding' to 0 manually in the UI, wipe all trade debts
        IF NEW.outstanding = 0 AND v_total_trade_debt > 0 THEN
            UPDATE public.trades 
            SET outstanding_amount = 0,
                paid_amount = paid_amount + outstanding_amount,
                status = 'Holding',
                order_status = 'FILLED'
            WHERE user_id = NEW.id AND status = 'LOCKED_UNPAID';
            
            RETURN NEW;
        END IF;

        -- Otherwise, do the proportional capital distribution based on their actual balance deficit
        v_paid_capital := v_total_trade_debt - ABS(v_true_negative_balance);

        -- Distribute any paid capital sequentially
        IF v_paid_capital > 0 THEN
            FOR t IN (SELECT * FROM public.trades WHERE user_id = NEW.id AND status = 'LOCKED_UNPAID' ORDER BY created_at ASC) LOOP
                IF v_paid_capital > 0 AND t.outstanding_amount > 0 THEN
                    v_pay := LEAST(v_paid_capital, t.outstanding_amount);
                    
                    UPDATE public.trades 
                    SET outstanding_amount = outstanding_amount - v_pay,
                        paid_amount = COALESCE(paid_amount, 0) + v_pay,
                        status = CASE WHEN ROUND((outstanding_amount - v_pay), 2) <= 0 THEN 'Holding' ELSE status END,
                        order_status = CASE WHEN ROUND((outstanding_amount - v_pay), 2) <= 0 THEN 'FILLED' ELSE order_status END
                    WHERE id = t.id;
                    
                    v_paid_capital := v_paid_capital - v_pay;
                END IF;
            END LOOP;
        END IF;

    END IF;
    
    -- Final pass: Free up trades that definitely hit 0 outstanding due to earlier triggers/updates
    UPDATE public.trades
    SET status = 'Holding', order_status = 'FILLED'
    WHERE user_id = NEW.id
      AND status = 'LOCKED_UNPAID'
      AND ROUND(COALESCE(outstanding_amount, 0), 2) <= 0;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind the robust sync trigger AFTER UPDATE so it can safely modify trades
DROP TRIGGER IF EXISTS trg_sync_financials_to_trades ON public.users;
CREATE TRIGGER trg_sync_financials_to_trades
AFTER UPDATE OF balance, outstanding ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_financials_to_trades();

-- Immediate global sweep to catch currently stuck discrepancies
DO $$
DECLARE
    u RECORD;
BEGIN
    FOR u IN (SELECT id FROM public.users) LOOP
        UPDATE public.users SET outstanding = outstanding WHERE id = u.id;
    END LOOP;
END;
$$;
