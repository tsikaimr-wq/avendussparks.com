-- Add trading_frozen column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS trading_frozen BOOLEAN DEFAULT FALSE;
