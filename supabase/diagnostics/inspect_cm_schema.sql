-- Read-only schema inventory for the Clube Manager Supabase objects.
-- Run in the Supabase SQL Editor and share the result before preparing data writes.

-- Columns, types, defaults, and nullability for Clube Manager tables.
SELECT
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name LIKE 'cm\_%' ESCAPE '\'
ORDER BY table_name, ordinal_position;

-- Constraints and foreign-key definitions for Clube Manager tables.
SELECT
  c.conrelid::regclass::text AS table_name,
  c.conname AS constraint_name,
  c.contype AS constraint_type,
  pg_get_constraintdef(c.oid, true) AS definition
FROM pg_constraint AS c
JOIN pg_namespace AS n ON n.oid = c.connamespace
WHERE n.nspname = 'public'
  AND c.conrelid::regclass::text LIKE 'cm\_%' ESCAPE '\'
ORDER BY table_name, constraint_name;

-- Indexes for Clube Manager tables.
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename LIKE 'cm\_%' ESCAPE '\'
ORDER BY tablename, indexname;

-- RLS policies for Clube Manager tables.
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename LIKE 'cm\_%' ESCAPE '\'
ORDER BY tablename, policyname;

-- Triggers on Clube Manager tables.
SELECT event_object_table AS table_name, trigger_name, event_manipulation,
       action_timing, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table LIKE 'cm\_%' ESCAPE '\'
ORDER BY event_object_table, trigger_name, event_manipulation;

-- Existing private authorization functions whose names begin with cm_.
SELECT p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'private'
  AND p.proname LIKE 'cm\_%' ESCAPE '\'
ORDER BY p.proname, arguments;