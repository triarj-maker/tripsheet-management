-- Stage 1 only. REVIEW DRAFT: not applied to Supabase.
-- Run sql/verification/20261009_multi_role_preflight.sql and read the runbook first.
-- Execute as postgres only, after explicit approval. No application cutover here.
-- Existing profiles.role remains authoritative for EXISTING application authorization.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Prevent profile/assignment edits during baseline capture and backfill.
lock table public.profiles in access exclusive mode;
lock table public.trip_sheet_assignments in share mode;

create temporary table stage1_profiles_before on commit drop as
  select id, to_jsonb(p) - 'is_admin' as original from public.profiles p;
-- Preserve the actual column type/precision for the independently expected NOW().
-- Empty on reruns: no backfill means no timestamp exception.
create temporary table stage1_profile_backfill_updates on commit drop as
  select id, updated_at as expected_updated_at from public.profiles with no data;
create temporary table stage1_assignments_before on commit drop as
  select to_jsonb(a) as original from public.trip_sheet_assignments a;

do $foundation$
declare
  already_installed boolean;
begin
  if current_user <> 'postgres' then
    raise exception 'Stage 1 must be reviewed and executed as postgres';
  end if;
  if exists (select 1 from public.profiles
             where role is null or role::text not in ('admin', 'facilitator', 'expert')) then
    raise exception 'Unmapped profiles.role values exist (including legacy resource). Run preflight and obtain an explicit mapping decision; nothing will be committed.';
  end if;

  select exists (select 1 from pg_catalog.pg_attribute
                 where attrelid = 'public.profiles'::regclass
                   and attname = 'is_admin' and not attisdropped)
    into already_installed;

  if already_installed then
    if pg_catalog.col_description('public.profiles'::regclass,
         (select attnum from pg_catalog.pg_attribute
          where attrelid = 'public.profiles'::regclass and attname = 'is_admin'))
         is distinct from 'multi_role_foundation_20261009: independent permission; Stage 1 application still uses role'
       or to_regclass('public.operational_roles') is null
       or to_regclass('public.profile_operational_roles') is null then
      raise exception 'Existing multi-role objects are not this migration installation. Inspect rather than adopting unknown schema.';
    end if;
    -- A rerun must not overwrite subsequent intentional permission/membership edits.
    -- This is NOT a mechanism for reconciling later legacy Team edits.
    return;
  end if;

  if to_regclass('public.operational_roles') is not null
     or to_regclass('public.profile_operational_roles') is not null
     or to_regnamespace('multi_role_private') is not null then
    raise exception 'Object name collision. Review existing objects before applying Stage 1.';
  end if;

  alter table public.profiles add column is_admin boolean not null default false;
  comment on column public.profiles.is_admin is
    'multi_role_foundation_20261009: independent permission; Stage 1 application still uses role';

  create table public.operational_roles (
    code text primary key,
    label text not null,
    is_active boolean not null default true
  );
  create table public.profile_operational_roles (
    profile_id uuid not null references public.profiles(id) on delete cascade,
    role_code text not null references public.operational_roles(code) on delete restrict,
    primary key (profile_id, role_code)
  );
  create index profile_operational_roles_role_code_idx
    on public.profile_operational_roles(role_code);

  insert into public.operational_roles (code, label) values
    ('facilitator', 'Facilitator'), ('expert', 'Expert');
  -- The confirmed set_profiles_updated_at trigger assigns NEW.updated_at = NOW().
  -- Record only rows actually updated; do not trust a returned timestamp as the
  -- expectation. INSERT casts NOW() to the original updated_at type/precision.
  with updated_profiles as (
    update public.profiles set is_admin = true where role::text = 'admin'
    returning id
  )
  insert into stage1_profile_backfill_updates (id, expected_updated_at)
    select id, now() from updated_profiles;
  insert into public.profile_operational_roles (profile_id, role_code)
    select id, role::text from public.profiles where role::text in ('facilitator', 'expert');
end
$foundation$;

create schema if not exists multi_role_private authorization postgres;
revoke all on schema multi_role_private from public, anon, authenticated, service_role;
grant usage on schema multi_role_private to authenticated, service_role;

-- Read-only, no caller-supplied identity. Owner bypasses profiles RLS to avoid
-- recursion; fixed search_path prevents object substitution. Keep schema unexposed.
create or replace function multi_role_private.is_stage1_admin()
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.is_admin and p.role::text = 'admin' and p.is_active is not false
  );
$$;
alter function multi_role_private.is_stage1_admin() owner to postgres;
revoke all on function multi_role_private.is_stage1_admin() from public, anon, authenticated, service_role;
grant execute on function multi_role_private.is_stage1_admin() to authenticated, service_role;

-- AFTER checks the final row, including modifications by existing BEFORE triggers.
-- Trigger does not grant row access or change existing ordinary-field policies.
-- Do not use current_user to identify a trusted caller inside a definer function.
create or replace function multi_role_private.protect_profile_admin_permission()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' and new.is_admin is not true)
     or (tg_op = 'UPDATE' and new.is_admin is not distinct from old.is_admin) then
    return new;
  end if;

  if (select auth.role()) = 'service_role'
     or (session_user = 'postgres' and (select auth.uid()) is null
         and coalesce(current_setting('role', true), 'none') in ('none', 'postgres'))
     then
    return new;
  end if;
  -- An AFTER trigger can see NEW in the table. Never authorize self-promotion
  -- using that new value. Self changes require the OLD permission and identity.
  if tg_op = 'UPDATE' and old.id = (select auth.uid()) then
    if old.is_admin and old.role::text = 'admin' and old.is_active is not false
       and new.id = old.id then
      return new;
    end if;
  elsif new.id is distinct from (select auth.uid())
        and multi_role_private.is_stage1_admin() then
    return new;
  end if;
  raise exception 'Only an active Admin may change Admin permission'
    using errcode = '42501';
end;
$$;
alter function multi_role_private.protect_profile_admin_permission() owner to postgres;
revoke all on function multi_role_private.protect_profile_admin_permission() from public, anon, authenticated, service_role;
drop trigger if exists stage1_protect_admin_permission on public.profiles;
create trigger stage1_protect_admin_permission
after insert or update on public.profiles
for each row execute function multi_role_private.protect_profile_admin_permission();

alter table public.operational_roles enable row level security;
alter table public.profile_operational_roles enable row level security;

-- Explicit grants override Supabase default table grants on these NEW tables only.
revoke all on public.operational_roles, public.profile_operational_roles
  from public, anon, authenticated, service_role;
grant select on public.operational_roles to authenticated;
grant select, insert, update, delete on public.profile_operational_roles to authenticated;
grant select, insert, update, delete on public.operational_roles, public.profile_operational_roles to service_role;

drop policy if exists stage1_roles_read on public.operational_roles;
create policy stage1_roles_read on public.operational_roles
for select to authenticated using (true);
-- Catalogue is migration/service-managed; no client can invent new roles.

drop policy if exists stage1_memberships_read on public.profile_operational_roles;
create policy stage1_memberships_read on public.profile_operational_roles
for select to authenticated
using (profile_id = (select auth.uid()) or (select multi_role_private.is_stage1_admin()));
drop policy if exists stage1_memberships_insert on public.profile_operational_roles;
create policy stage1_memberships_insert on public.profile_operational_roles
for insert to authenticated with check ((select multi_role_private.is_stage1_admin()));
drop policy if exists stage1_memberships_update on public.profile_operational_roles;
create policy stage1_memberships_update on public.profile_operational_roles
for update to authenticated
using ((select multi_role_private.is_stage1_admin()))
with check ((select multi_role_private.is_stage1_admin()));
drop policy if exists stage1_memberships_delete on public.profile_operational_roles;
create policy stage1_memberships_delete on public.profile_operational_roles
for delete to authenticated using ((select multi_role_private.is_stage1_admin()));

-- Permit exactly the confirmed timestamp effect on backfilled rows. All other
-- fields/rows (and all timestamps on reruns) remain subject to full comparison.
do $integrity$
begin
  if exists (
    with expected_profiles as (
      select b.id,
        case when u.id is not null
          then jsonb_set(b.original, '{updated_at}', to_jsonb(u.expected_updated_at))
          else b.original end as original
      from stage1_profiles_before b
      left join stage1_profile_backfill_updates u on u.id = b.id
    )
    (select id, original from expected_profiles
     except all select id, to_jsonb(p) - 'is_admin' from public.profiles p)
    union all
    (select id, to_jsonb(p) - 'is_admin' from public.profiles p
     except all select id, original from expected_profiles)
  ) then
    raise exception 'Existing profile fields changed, possibly by a trigger. Review live triggers; migration rolled back.';
  end if;
  if exists (
    (select original from stage1_assignments_before
     except all select to_jsonb(a) from public.trip_sheet_assignments a)
    union all
    (select to_jsonb(a) from public.trip_sheet_assignments a
     except all select original from stage1_assignments_before)
  ) then
    raise exception 'Assignments changed; migration rolled back.';
  end if;
end
$integrity$;
commit;
