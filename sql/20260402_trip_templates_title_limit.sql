-- Increase public.trip_templates.title length limit to 50 characters.
--
-- This migration is safe for either of these existing schemas:
-- 1. title is character varying(n)
-- 2. title is text with a CHECK constraint using char_length(title) <= n
--
-- The repo currently enforces 30 characters in the app layer. This migration
-- aligns the database to a new clean limit of 50 characters.

DO $$
DECLARE
  target_limit integer := 50;
  current_character_limit integer;
  title_length_constraint record;
BEGIN
  SELECT character_maximum_length
  INTO current_character_limit
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'trip_templates'
    AND column_name = 'title';

  RAISE NOTICE 'public.trip_templates.title current character limit: %', current_character_limit;

  -- If the column is VARCHAR(n), expand it to VARCHAR(50) when needed.
  IF current_character_limit IS NOT NULL AND current_character_limit < target_limit THEN
    EXECUTE format(
      'ALTER TABLE public.trip_templates ALTER COLUMN title TYPE varchar(%s)',
      target_limit
    );
  END IF;

  -- Remove any older CHECK constraints that enforce title length via char_length(title).
  FOR title_length_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.trip_templates'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%char_length(title)%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.trip_templates DROP CONSTRAINT %I',
      title_length_constraint.conname
    );
  END LOOP;

  -- If title is not VARCHAR, enforce the new limit with a CHECK constraint.
  IF current_character_limit IS NULL THEN
    EXECUTE format(
      'ALTER TABLE public.trip_templates ADD CONSTRAINT trip_templates_title_length_check CHECK (char_length(title) <= %s)',
      target_limit
    );
  END IF;
END $$;

-- Optional inspection queries for Supabase SQL Editor:
-- SELECT data_type, character_maximum_length
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'trip_templates'
--   AND column_name = 'title';
--
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.trip_templates'::regclass
--   AND contype = 'c';
