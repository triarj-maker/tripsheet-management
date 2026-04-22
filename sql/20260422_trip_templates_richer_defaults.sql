-- Add nullable default fields for richer trip sheet templates.
--
-- These fields are intentionally data-model only in this stage. UI and trip
-- sheet creation behavior will be wired in a later stage.

ALTER TABLE public.trip_templates
  ADD COLUMN IF NOT EXISTS heading text,
  ADD COLUMN IF NOT EXISTS default_start_time time without time zone,
  ADD COLUMN IF NOT EXISTS default_end_time time without time zone;
