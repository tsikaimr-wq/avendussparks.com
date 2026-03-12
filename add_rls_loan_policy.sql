
-- 1. Enable RLS (Ensure it is on)
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

-- 2. Create UPDATE Policy for Admins (Allowing everyone for now per request "USING (true)")
-- Ideally this should be restricted to admin roles but we follow the strict request.
DROP POLICY IF EXISTS "Allow admin update loans" ON public.loans;

CREATE POLICY "Allow admin update loans"
ON public.loans
FOR UPDATE
USING (true)
WITH CHECK (true);

-- 3. Also ensure SELECT policy exists if not already (Optional but good practice)
-- CREATE POLICY "Allow public read loans" ON public.loans FOR SELECT USING (true);
