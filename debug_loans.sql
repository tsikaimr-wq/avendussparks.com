-- Search for the problematic string in all database constraints (Fixed for Postgre 12+)
SELECT 
    n.nspname AS schema_name,
    c.relname AS table_name,
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class c ON con.conrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE pg_get_constraintdef(con.oid) ILIKE '%eligible%';

-- Search for the problematic string in all Functions and Triggers
SELECT 
    n.nspname AS schema_name,
    p.proname AS function_name,
    prosrc AS source_code
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE prosrc ILIKE '%eligible%';

-- Check Triggers specifically
SELECT 
    event_object_table AS table_name, 
    trigger_name, 
    action_statement 
FROM information_schema.triggers 
WHERE action_statement ILIKE '%eligible%';

-- Check RLS Policies as requested
SELECT * FROM pg_policies WHERE tablename = 'loans';

-- FORCE DISABLE RLS for testing (to confirm if RLS is the cause of 400 error)
ALTER TABLE public.loans DISABLE ROW LEVEL SECURITY;
