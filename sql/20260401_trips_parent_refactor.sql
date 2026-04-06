-- Parent trips refactor
-- This migration intentionally introduces a new non-backward-compatible model:
--   trips        = top-level entity
--   trip_sheets  = child execution units linked by trip_id
--
-- Old live data is intentionally ignored for this refactor.

begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  trip_type text not null check (trip_type in ('educational', 'private')),
  destination_id uuid not null references public.destinations(id),
  created_by uuid references auth.users(id),
  last_updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_trips_updated_at on public.trips;
create trigger set_trips_updated_at
before update on public.trips
for each row
execute function public.set_updated_at();

alter table public.trip_sheets
  add column if not exists trip_id uuid references public.trips(id) on delete cascade;

create index if not exists idx_trip_sheets_trip_id on public.trip_sheets(trip_id);
create index if not exists idx_trips_trip_type on public.trips(trip_type);
create index if not exists idx_trips_destination_id on public.trips(destination_id);

-- Clean parent-owned fields off the child table.
alter table public.trip_sheets drop column if exists title;
alter table public.trip_sheets drop column if exists trip_type;
alter table public.trip_sheets drop column if exists destination_id;

alter table public.trips enable row level security;

drop policy if exists "Trips read for authenticated users" on public.trips;
create policy "Trips read for authenticated users"
on public.trips
for select
to authenticated
using (true);

drop policy if exists "Trips admin insert" on public.trips;
create policy "Trips admin insert"
on public.trips
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Trips admin update" on public.trips;
create policy "Trips admin update"
on public.trips
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Trips admin delete" on public.trips;
create policy "Trips admin delete"
on public.trips
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

commit;
