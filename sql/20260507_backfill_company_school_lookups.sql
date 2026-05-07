-- Backfill simple company and school lookup rows from legacy trip text fields.
-- This migration preserves trips.guest_name and trips.company.

begin;

create extension if not exists pgcrypto;

with legacy_company_names as (
  select
    min(trim(company)) as name,
    lower(trim(company)) as normalized_name
  from public.trips
  where nullif(trim(company), '') is not null
  group by lower(trim(company))
),
missing_company_names as (
  select legacy_company_names.name
  from legacy_company_names
  where not exists (
    select 1
    from public.companies
    where lower(trim(companies.name)) = legacy_company_names.normalized_name
  )
)
insert into public.companies (name)
select name
from missing_company_names;

with company_matches as (
  select distinct on (trips.id)
    trips.id as trip_id,
    companies.id as company_id
  from public.trips
  join public.companies
    on lower(trim(companies.name)) = lower(trim(trips.company))
  where trips.company_id is null
    and nullif(trim(trips.company), '') is not null
  order by trips.id, companies.name, companies.id
)
update public.trips
set company_id = company_matches.company_id
from company_matches
where trips.id = company_matches.trip_id
  and trips.company_id is null;

with legacy_school_names as (
  select
    min(trim(guest_name)) as name,
    lower(trim(guest_name)) as normalized_name
  from public.trips
  where trip_type = 'educational'
    and nullif(trim(guest_name), '') is not null
  group by lower(trim(guest_name))
),
missing_school_names as (
  select legacy_school_names.name
  from legacy_school_names
  where not exists (
    select 1
    from public.schools
    where lower(trim(schools.name)) = legacy_school_names.normalized_name
  )
)
insert into public.schools (name)
select name
from missing_school_names;

with school_matches as (
  select distinct on (trips.id)
    trips.id as trip_id,
    schools.id as school_id
  from public.trips
  join public.schools
    on lower(trim(schools.name)) = lower(trim(trips.guest_name))
  where trips.school_id is null
    and trips.trip_type = 'educational'
    and nullif(trim(trips.guest_name), '') is not null
  order by trips.id, schools.name, schools.id
)
update public.trips
set school_id = school_matches.school_id
from school_matches
where trips.id = school_matches.trip_id
  and trips.school_id is null;

commit;
