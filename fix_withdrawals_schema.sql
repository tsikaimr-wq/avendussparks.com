-- Add missing bank details columns to 'withdrawals' table
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS account_number TEXT;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS ifsc TEXT;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Notify Supabase to refresh schema cache
NOTIFY pgrst, 'reload schema';
