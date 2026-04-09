-- Add optional transportation information to trip sheets.

begin;

alter table public.trip_sheets
  add column if not exists transportation_info text;

commit;
