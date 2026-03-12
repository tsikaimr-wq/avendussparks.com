-- =========================================================
-- FINAL STORAGE AND RLS FIX
-- =========================================================

-- 1. FIX STORAGE POLICIES
-- Ensure 'kyc-documents' bucket is public and allows uploads
-- Note: This requires the storage schema to exist (standard in Supabase)
DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('kyc-documents', 'kyc-documents', true)
    ON CONFLICT (id) DO UPDATE SET public = true;
END $$;

-- Drop old storage policies to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public downloads" ON storage.objects;

-- Create policy to allow authenticated users to upload their own KYC documents
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'kyc-documents');

-- Create policy to allow public to read KYC documents (required for admin panel)
CREATE POLICY "Allow public downloads"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'kyc-documents');

-- 2. RE-APPLY USER AND KYC POLICIES (CLEAN SLATE)
-- USERS TABLE
DROP POLICY IF EXISTS "Allow authenticated select own row" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated update own row" ON public.users;

CREATE POLICY "Allow authenticated select own row"
ON public.users FOR SELECT TO authenticated
USING (auth.uid() = auth_id);

CREATE POLICY "Allow authenticated update own row"
ON public.users FOR UPDATE TO authenticated
USING (auth.uid() = auth_id)
WITH CHECK (auth.uid() = auth_id);

-- KYC_SUBMISSIONS TABLE
DROP POLICY IF EXISTS "Allow authenticated insert own KYC" ON public.kyc_submissions;

CREATE POLICY "Allow authenticated insert own KYC"
ON public.kyc_submissions FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = (SELECT auth_id FROM public.users WHERE id = user_id)
);

-- 3. ENABLE RLS EVERYWHERE
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;

-- 4. VERIFY BUCKET IS CONFIGURED
-- SELECT * FROM storage.buckets WHERE id = 'kyc-documents';
