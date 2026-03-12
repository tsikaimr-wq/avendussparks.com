
-- Drop existing table if it exists to ensure clean slate with correct types
DROP TABLE IF EXISTS public.loans;

-- Create Loans Table with requested structure
CREATE TABLE public.loans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    purpose TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own loans
CREATE POLICY "Users can view own loans" ON public.loans
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own loans
CREATE POLICY "Users can insert own loans" ON public.loans
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can view all loans (assuming admin has bypass or specific role, adjusting for public/anon for now as requested by user context often implies simple setup)
-- If RLS is an issue, we can disable it like in the other schema files:
-- ALTER TABLE public.loans DISABLE ROW LEVEL SECURITY;
