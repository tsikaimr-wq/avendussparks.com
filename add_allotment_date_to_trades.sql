-- Add allotment_date to trades table
ALTER TABLE public.trades 
ADD COLUMN IF NOT EXISTS allotment_date TIMESTAMPTZ;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
