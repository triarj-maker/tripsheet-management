-- Add module/playbook card metadata for templates and trip sheets.
-- Stores relative static HTML URLs only; HTML bodies remain outside the DB.

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

create table if not exists public.template_cards (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.trip_templates(id) on delete cascade,
  title text not null,
  category text not null,
  card_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint template_cards_category_check
    check (category in ('facilitator', 'expert')),
  constraint template_cards_title_not_blank_check
    check (btrim(title) <> ''),
  constraint template_cards_card_url_not_blank_check
    check (btrim(card_url) <> ''),
  constraint template_cards_card_url_relative_check
    check (card_url like '/module-cards/%')
);

create table if not exists public.trip_sheet_cards (
  id uuid primary key default gen_random_uuid(),
  trip_sheet_id uuid not null references public.trip_sheets(id) on delete cascade,
  source_template_card_id uuid references public.template_cards(id) on delete set null,
  title text not null,
  category text not null,
  card_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_sheet_cards_category_check
    check (category in ('facilitator', 'expert')),
  constraint trip_sheet_cards_title_not_blank_check
    check (btrim(title) <> ''),
  constraint trip_sheet_cards_card_url_not_blank_check
    check (btrim(card_url) <> ''),
  constraint trip_sheet_cards_card_url_relative_check
    check (card_url like '/module-cards/%')
);

drop trigger if exists set_template_cards_updated_at on public.template_cards;
create trigger set_template_cards_updated_at
before update on public.template_cards
for each row
execute function public.set_updated_at();

drop trigger if exists set_trip_sheet_cards_updated_at on public.trip_sheet_cards;
create trigger set_trip_sheet_cards_updated_at
before update on public.trip_sheet_cards
for each row
execute function public.set_updated_at();

create index if not exists idx_template_cards_template_id
  on public.template_cards(template_id);

create index if not exists idx_template_cards_template_id_sort_order
  on public.template_cards(template_id, sort_order);

create index if not exists idx_trip_sheet_cards_trip_sheet_id
  on public.trip_sheet_cards(trip_sheet_id);

create index if not exists idx_trip_sheet_cards_trip_sheet_id_sort_order
  on public.trip_sheet_cards(trip_sheet_id, sort_order);

create index if not exists idx_trip_sheet_cards_source_template_card_id
  on public.trip_sheet_cards(source_template_card_id);

alter table public.template_cards enable row level security;
alter table public.trip_sheet_cards enable row level security;

drop policy if exists "Template cards read for authenticated users" on public.template_cards;
create policy "Template cards read for authenticated users"
on public.template_cards
for select
to authenticated
using (true);

drop policy if exists "Template cards admin insert" on public.template_cards;
create policy "Template cards admin insert"
on public.template_cards
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

drop policy if exists "Template cards admin update" on public.template_cards;
create policy "Template cards admin update"
on public.template_cards
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

drop policy if exists "Template cards admin delete" on public.template_cards;
create policy "Template cards admin delete"
on public.template_cards
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

drop policy if exists "Trip sheet cards read for authenticated users" on public.trip_sheet_cards;
create policy "Trip sheet cards read for authenticated users"
on public.trip_sheet_cards
for select
to authenticated
using (true);

drop policy if exists "Trip sheet cards admin insert" on public.trip_sheet_cards;
create policy "Trip sheet cards admin insert"
on public.trip_sheet_cards
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

drop policy if exists "Trip sheet cards admin update" on public.trip_sheet_cards;
create policy "Trip sheet cards admin update"
on public.trip_sheet_cards
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

drop policy if exists "Trip sheet cards admin delete" on public.trip_sheet_cards;
create policy "Trip sheet cards admin delete"
on public.trip_sheet_cards
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
