
-- 1. Add missing columns safely
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE NULL;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS approved_by INTEGER NULL;

-- 2. Ensure status default is 'Pending' (or 'PENDING' if we want strict uppercase)
-- We will update constraint first
ALTER TABLE public.loans DROP CONSTRAINT IF EXISTS loans_status_check;
ALTER TABLE public.loans ADD CONSTRAINT loans_status_check CHECK (status IN ('Pending', 'Approved', 'Rejected', 'PENDING', 'APPROVED', 'REJECTED'));

-- 3. Update existing rows if refined logic is needed (optional, effectively no-op if table is fresh)
-- UPDATE public.loans SET updated_at = created_at WHERE updated_at IS NULL;

-- 4. Update status default to uppercase PENDING
ALTER TABLE public.loans ALTER COLUMN status SET DEFAULT 'PENDING';
