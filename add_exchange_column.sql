-- 1. Add the 'exchange' column to the 'products' table
-- Setting the default to 'BSE' ensures existing products will not break.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS exchange text DEFAULT 'BSE';

-- 2. Ensure all existing products have their 'exchange' field set to the default value.
UPDATE public.products SET exchange = 'BSE' WHERE exchange IS NULL;

-- 3. Notify PostgREST to reload the schema cache so the backend API recognizes the new column and prevents caching errors.
NOTIFY pgrst, 'reload schema';
