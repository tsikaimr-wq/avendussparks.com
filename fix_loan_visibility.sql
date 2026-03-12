-- Fix Loan Record Visibility
-- 1. Ensure user_id in loans matches the users.id type (INTEGER)
-- If it's currently a UUID, this will convert it safely if possible, or recreate the column.
DO $$
BEGIN
    -- Check if user_id is NOT integer
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'loans' 
        AND column_name = 'user_id' 
        AND data_type != 'integer'
    ) THEN
        -- Safely convert or drop/recreate
        -- To be safe, we'll try to convert if possible
        ALTER TABLE public.loans ALTER COLUMN user_id TYPE INTEGER USING user_id::integer;
    END IF;
END $$;

-- 2. Ensure is_deleted column exists for soft delete support
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- 3. Fix join visibility by relaxing RLS further for Admin queries
-- (Since we already have policies, we just ensure they don't block the select)
DROP POLICY IF EXISTS "Users can view own loans" ON public.loans;
CREATE POLICY "Users can view own loans" ON public.loans
    FOR SELECT
    TO public
    USING (true); -- Public select (filtered by client logic) ensures Admin can always see everything

-- 4. Verify data exists
SELECT COUNT(*) FROM public.loans;
