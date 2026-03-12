-- 1. Update users table with new profile columns
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS dob DATE,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS id_number TEXT,
ADD COLUMN IF NOT EXISTS kyc_status TEXT DEFAULT 'Pending';

-- 2. Update kyc_submissions table with comprehensive columns
ALTER TABLE public.kyc_submissions
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS dob DATE,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS mobile TEXT,
ADD COLUMN IF NOT EXISTS id_number TEXT,
ADD COLUMN IF NOT EXISTS id_front_url TEXT,
ADD COLUMN IF NOT EXISTS id_back_url TEXT,
ADD COLUMN IF NOT EXISTS selfie_url TEXT,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Ensure Status Column exists in kyc_submissions if not already
ALTER TABLE public.kyc_submissions
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pending';

-- 4. Create Storage Bucket for KYC Documents if it doesn't exist (This is usually done in UI but can be SQL-scripted in some environments)
-- Note: You generally need to enable "kyc-documents" bucket in Supabase Dashboard -> Storage.
-- INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents', 'kyc-documents', true);
