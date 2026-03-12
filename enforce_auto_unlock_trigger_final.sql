-- 1. Create a function that triggers automatically whenever a user's balance is updated
CREATE OR REPLACE FUNCTION public.release_trades_on_deposit()
RETURNS TRIGGER AS $$
BEGIN
    -- Flow: User Deposit -> Balance Updated -> Trigger runs -> Check trades
    -- Find trades where outstanding_amount <= 0 and force them to unlock
    UPDATE public.trades
    SET status = 'Holding', order_status = 'FILLED'
    WHERE user_id = NEW.id
      AND status = 'LOCKED_UNPAID'
      AND ROUND(COALESCE(outstanding_amount, 0), 2) <= 0;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Bind the trigger to the users table AFTER UPDATE
DROP TRIGGER IF EXISTS trg_release_trades_on_deposit ON public.users;
CREATE TRIGGER trg_release_trades_on_deposit
AFTER UPDATE OF balance, outstanding ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.release_trades_on_deposit();

-- 3. In the event that a trade is manually updated or updated elsewhere, enforce this rule on the trades table directly too
CREATE OR REPLACE FUNCTION public.auto_unlock_trade_self()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'LOCKED_UNPAID' AND ROUND(COALESCE(NEW.outstanding_amount, 0), 2) <= 0 THEN
        NEW.status := 'Holding';
        NEW.order_status := 'FILLED';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_unlock_trade_self ON public.trades;
CREATE TRIGGER trg_auto_unlock_trade_self
BEFORE UPDATE ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.auto_unlock_trade_self();

-- 4. Manual sweep requirement explicitly requested by user
UPDATE public.trades
SET status='Holding', order_status='FILLED'
WHERE status='LOCKED_UNPAID' AND ROUND(COALESCE(outstanding_amount,0), 2) <= 0;
