-- =========================================================
-- CLEAN SLATE RLS FIX: DROP AND RECREATE
-- =========================================================

-- 1. DROP ALL POTENTIAL CONFLICTING POLICIES FIRST
DROP POLICY IF EXISTS "Allow authenticated select own row" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated update own row" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Public Read Access" ON public.users;
DROP POLICY IF EXISTS "Public Insert Access" ON public.users;
DROP POLICY IF EXISTS "Users Update Own" ON public.users;

-- 2. CREATE FRESH SCOPED POLICIES
-- This allows the 'authenticated' role to SEE their own row
CREATE POLICY "Allow authenticated select own row"
ON public.users
FOR SELECT
TO authenticated
USING (auth.uid() = auth_id);

-- This allows the 'authenticated' role to UPDATE their own row
CREATE POLICY "Allow authenticated update own row"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = auth_id)
WITH CHECK (auth.uid() = auth_id);

-- 3. ENSURE RLS IS ENABLED
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 4. FIX KYC_SUBMISSIONS POLICIES
DROP POLICY IF EXISTS "Allow authenticated insert own KYC" ON public.kyc_submissions;
DROP POLICY IF EXISTS "Users can insert own KYC" ON public.kyc_submissions;
DROP POLICY IF EXISTS "Public KYC access" ON public.kyc_submissions;

CREATE POLICY "Allow authenticated insert own KYC"
ON public.kyc_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = (
    SELECT auth_id FROM public.users
    WHERE id = kyc_submissions.user_id
  )
);

ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;

-- 5. VERIFY (Run this to confirm success)
-- SELECT policyname, roles, cmd FROM pg_policies WHERE tablename = 'users';
