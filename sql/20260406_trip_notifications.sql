-- Manual trip-level notifications schema.
-- This migration introduces:
--   trip_notifications            = one row per manual trip notification send
--   trip_notification_recipients = one row per recipient per notification send

begin;

create extension if not exists pgcrypto;

create table if not exists public.trip_notifications (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  sent_by_user_id uuid not null references auth.users(id),
  sent_at timestamptz not null default now(),
  recipient_count integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  status text not null check (status in ('success', 'partial_failure', 'failed')),
  subject text,
  created_at timestamptz not null default now()
);

create table if not exists public.trip_notification_recipients (
  id uuid primary key default gen_random_uuid(),
  trip_notification_id uuid not null references public.trip_notifications(id) on delete cascade,
  resource_user_id uuid not null references auth.users(id),
  email text not null,
  delivery_status text not null check (delivery_status in ('sent', 'failed', 'skipped')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_trip_notifications_trip_id
  on public.trip_notifications(trip_id);
create index if not exists idx_trip_notifications_sent_at
  on public.trip_notifications(sent_at);
create index if not exists idx_trip_notification_recipients_trip_notification_id
  on public.trip_notification_recipients(trip_notification_id);
create index if not exists idx_trip_notification_recipients_resource_user_id
  on public.trip_notification_recipients(resource_user_id);

alter table public.trip_notifications enable row level security;
alter table public.trip_notification_recipients enable row level security;

drop policy if exists "Trip notifications admin read" on public.trip_notifications;
create policy "Trip notifications admin read"
on public.trip_notifications
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Trip notifications admin insert" on public.trip_notifications;
create policy "Trip notifications admin insert"
on public.trip_notifications
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

drop policy if exists "Trip notifications admin update" on public.trip_notifications;
create policy "Trip notifications admin update"
on public.trip_notifications
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

drop policy if exists "Trip notifications admin delete" on public.trip_notifications;
create policy "Trip notifications admin delete"
on public.trip_notifications
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

drop policy if exists "Trip notification recipients admin read" on public.trip_notification_recipients;
create policy "Trip notification recipients admin read"
on public.trip_notification_recipients
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Trip notification recipients admin insert" on public.trip_notification_recipients;
create policy "Trip notification recipients admin insert"
on public.trip_notification_recipients
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

drop policy if exists "Trip notification recipients admin update" on public.trip_notification_recipients;
create policy "Trip notification recipients admin update"
on public.trip_notification_recipients
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

drop policy if exists "Trip notification recipients admin delete" on public.trip_notification_recipients;
create policy "Trip notification recipients admin delete"
on public.trip_notification_recipients
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
