-- 1. Identify and Drop existing constraint (name is usually trades_status_check)
-- We use a DO block to make it safer in case the name varies slightly or it doesn't exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trades_status_check') THEN
        ALTER TABLE public.trades DROP CONSTRAINT trades_status_check;
    END IF;
END $$;

-- 2. Re-add constraint with new allowed value 'AWAITING_APPROVAL'
ALTER TABLE public.trades 
ADD CONSTRAINT trades_status_check 
CHECK (status IN ('Pending', 'Holding', 'Sold', 'Rejected', 'Settled', 'Approved', 'Confirmed', 'Awaiting', 'AWAITING', 'LOCKED_UNPAID', 'AWAITING_APPROVAL'));

-- 3. Verify specifically for AWAITING_APPROVAL
-- This ensures the system accepts the new workflow status.
