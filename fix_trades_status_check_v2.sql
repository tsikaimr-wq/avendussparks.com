-- Update trades status check to include LOCKED_UNPAID
-- Run this in Supabase SQL Editor

ALTER TABLE public.trades DROP CONSTRAINT IF EXISTS trades_status_check;
ALTER TABLE public.trades ADD CONSTRAINT trades_status_check 
CHECK (status IN ('Pending', 'Holding', 'Sold', 'Rejected', 'Settled', 'Approved', 'Confirmed', 'Awaiting', 'AWAITING', 'LOCKED_UNPAID', 'AWAITING_APPROVAL'));
