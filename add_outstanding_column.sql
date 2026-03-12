-- Add 'outstanding' column to 'users' table if it doesn't exist
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS outstanding NUMERIC DEFAULT 0;

-- Notify Supabase to refresh schema cache
NOTIFY pgrst, 'reload schema';
