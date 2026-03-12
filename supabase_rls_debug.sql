-- DEBUG: Disable restrictive RLS and allow all selects on trades table
-- Run this in the Supabase SQL Editor

-- 1. Remove existing restrictive policies
DROP POLICY IF EXISTS "Allow all select trades (debug)" ON public.trades;
DROP POLICY IF EXISTS "Allow user select own trades" ON public.trades;

-- 2. Create an open policy for debugging
CREATE POLICY "Allow all select trades (debug)"
ON public.trades
FOR SELECT
USING (true);

-- 3. Ensure RLS is still enabled (but now with the open policy above)
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

-- 4. (Optional) For full debug, you could temporarily disable RLS entirely:
-- ALTER TABLE public.trades DISABLE ROW LEVEL SECURITY;
