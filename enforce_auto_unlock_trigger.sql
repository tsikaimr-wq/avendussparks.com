-- 1. Create a function that automatically unlocks a trade if its outstanding balance hits 0
CREATE OR REPLACE FUNCTION public.auto_unlock_paid_trades()
RETURNS TRIGGER AS $$
BEGIN
    -- Only act if the trade is locked but has no outstanding debt
    IF NEW.status = 'LOCKED_UNPAID' AND COALESCE(NEW.outstanding_amount, 0) <= 0 THEN
        NEW.status := 'Holding';
        NEW.order_status := 'FILLED';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Bind the trigger to the trades table BEFORE UPDATE
DROP TRIGGER IF EXISTS trg_auto_unlock_paid_trades ON public.trades;
CREATE TRIGGER trg_auto_unlock_paid_trades
BEFORE UPDATE ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.auto_unlock_paid_trades();

-- 3. Execute the retroactive sweep exactly as requested by the user
UPDATE public.trades
SET status='Holding', order_status='FILLED'
WHERE status='LOCKED_UNPAID' AND COALESCE(outstanding_amount,0)<=0;
