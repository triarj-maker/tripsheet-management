-- Record schema changes already applied manually to Supabase (owner-reported).
-- Do not execute this file against that existing database as part of this task.
-- IF NOT EXISTS supports matching installations; it does not certify live schema
-- equivalence or reconcile differently named indexes/constraints. Review metadata.
begin;

alter table public.trip_templates
  add column if not exists destination_id uuid
    references public.destinations(id) on delete restrict,
  add column if not exists archived_at timestamptz;

create index if not exists idx_trip_templates_destination_id
  on public.trip_templates(destination_id);
create index if not exists idx_trip_templates_archived_at
  on public.trip_templates(archived_at);

commit;
