-- Simple lookup tables for companies and schools.
-- Stage 1 only: add lookup tables and nullable trip references.

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

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_companies_updated_at on public.companies;
create trigger set_companies_updated_at
before update on public.companies
for each row
execute function public.set_updated_at();

drop trigger if exists set_schools_updated_at on public.schools;
create trigger set_schools_updated_at
before update on public.schools
for each row
execute function public.set_updated_at();

alter table public.trips
  add column if not exists company_id uuid references public.companies(id),
  add column if not exists school_id uuid references public.schools(id);

create index if not exists idx_companies_name on public.companies(name);
create index if not exists idx_schools_name on public.schools(name);
create index if not exists idx_trips_company_id on public.trips(company_id);
create index if not exists idx_trips_school_id on public.trips(school_id);

alter table public.companies enable row level security;
alter table public.schools enable row level security;

drop policy if exists "Companies read for authenticated users" on public.companies;
create policy "Companies read for authenticated users"
on public.companies
for select
to authenticated
using (true);

drop policy if exists "Companies admin insert" on public.companies;
create policy "Companies admin insert"
on public.companies
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

drop policy if exists "Companies admin update" on public.companies;
create policy "Companies admin update"
on public.companies
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

drop policy if exists "Companies admin delete" on public.companies;
create policy "Companies admin delete"
on public.companies
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

drop policy if exists "Schools read for authenticated users" on public.schools;
create policy "Schools read for authenticated users"
on public.schools
for select
to authenticated
using (true);

drop policy if exists "Schools admin insert" on public.schools;
create policy "Schools admin insert"
on public.schools
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

drop policy if exists "Schools admin update" on public.schools;
create policy "Schools admin update"
on public.schools
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

drop policy if exists "Schools admin delete" on public.schools;
create policy "Schools admin delete"
on public.schools
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
