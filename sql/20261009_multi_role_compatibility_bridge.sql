-- Stage 2A ONLY. Review live preflight and runbook before applying as postgres.
-- Legacy role remains authoritative. Existing policies/helpers are not replaced.
-- Entire file is one transaction; no existing profile or assignment data is rewritten.
begin;
lock table public.profiles in access exclusive mode;
lock table public.profile_operational_roles in access exclusive mode;

-- Fail closed on drift. Never silently erase intentional multi-role data or
-- guess which side of an existing disagreement was intended.
do $$
begin
  if exists (select 1 from public.profiles p where p.role is null
      or p.role not in ('admin','facilitator','expert')
      or p.is_active is null
      or p.is_admin is distinct from (p.role = 'admin'))
    or exists (
      (select id, role from public.profiles where role in ('facilitator','expert')
       except select profile_id, role_code from public.profile_operational_roles)
      union all
      (select profile_id, role_code from public.profile_operational_roles
       except select id, role from public.profiles where role in ('facilitator','expert'))
    ) then
    raise exception 'Stage 2A requires reviewed, consistent single-role data; no data was reconciled';
  end if;
  if not exists (select 1 from public.profiles where role = 'admin' and is_admin and is_active) then
    raise exception 'Stage 2A requires at least one active Admin';
  end if;
  if exists (select 1 from pg_roles r where r.rolname in ('anon','authenticated')
      and has_table_privilege(r.oid, 'public.profiles', 'TRUNCATE')) then
    raise exception 'Resolve client profiles TRUNCATE grants with the separate correction first';
  end if;
end $$;

-- A real row UPDATE serializes writers. Unlike an advisory lock alone, it also
-- produces a serialization failure for stale repeatable-read/serializable writers.
create table if not exists multi_role_private.stage2a_write_lock (
  singleton boolean primary key check (singleton), version boolean not null
);
alter table multi_role_private.stage2a_write_lock owner to postgres;
alter table multi_role_private.stage2a_write_lock enable row level security;
revoke all on multi_role_private.stage2a_write_lock from public, anon, authenticated, service_role;
insert into multi_role_private.stage2a_write_lock values (true, false) on conflict do nothing;

create or replace function multi_role_private.stage2a_lock_profiles()
returns trigger language plpgsql volatile security definer set search_path = '' as $$
begin
  update multi_role_private.stage2a_write_lock set version = not version where singleton;
  if not found then raise exception 'Stage 2A serialization row missing'; end if;
  return null;
end $$;

create or replace function multi_role_private.stage2a_guard_profile()
returns trigger language plpgsql volatile security definer set search_path = '' as $$
declare
  trusted boolean := (select auth.role()) = 'service_role'
    or (session_user = 'postgres' and (select auth.uid()) is null
      and coalesce(current_setting('role', true), 'none') in ('none','postgres'));
  permitted boolean;
begin
  -- No identity deletion/renaming is part of this release, including cascading
  -- Auth deletion. Existing assignment foreign keys are left untouched.
  if tg_op = 'DELETE' then
    raise exception 'Profile deletion is unavailable during Stage 2A' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.id is distinct from old.id then
    raise exception 'Profile identity cannot change' using errcode = '42501';
  end if;
  if new.role is null or new.role not in ('admin','facilitator','expert') or new.is_active is null then
    raise exception 'A supported legacy role and explicit active status are required' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' or new.role is distinct from old.role
      or new.is_admin is distinct from old.is_admin
      or new.is_active is distinct from old.is_active then
    -- OLD is essential for self changes: an AFTER trigger can already see NEW.
    if tg_op = 'UPDATE' and old.id = (select auth.uid()) then
      permitted := old.role = 'admin' and old.is_admin and old.is_active;
    else
      permitted := multi_role_private.is_stage1_admin();
    end if;
    if not coalesce(trusted or permitted, false) then
      raise exception 'Only an active Admin may manage profiles' using errcode = '42501';
    end if;
  end if;
  if tg_when = 'BEFORE' then
    if tg_op = 'UPDATE' and new.role is not distinct from old.role
        and new.is_admin is distinct from (new.role = 'admin') then
      raise exception 'Stage 2A Admin permission must follow the legacy role' using errcode = '23514';
    end if;
    new.is_admin := new.role = 'admin';
  elsif new.is_admin is distinct from (new.role = 'admin') then
    raise exception 'A trigger changed Stage 2A permission consistency' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and old.role = 'admin' and old.is_admin and old.is_active
      and (new.role <> 'admin' or not new.is_admin or not new.is_active)
      and not exists (select 1 from public.profiles p
        where p.id <> old.id and p.role = 'admin' and p.is_admin and p.is_active) then
    raise exception 'Cannot remove or deactivate the final active Administrator' using errcode = '23514';
  end if;
  return new;
end $$;

create or replace function multi_role_private.stage2a_sync_memberships()
returns trigger language plpgsql volatile security definer set search_path = '' as $$
begin
  delete from public.profile_operational_roles
    where profile_id = new.id and (new.role = 'admin' or role_code <> new.role);
  if new.role in ('facilitator','expert') then
    insert into public.profile_operational_roles (profile_id, role_code)
      values (new.id, new.role) on conflict (profile_id, role_code) do nothing;
  end if;
  return new;
end $$;

-- Deferred validation sees the completed profile+membership write, including
-- other triggers. It also rejects direct membership edits even by an Admin
-- when those edits would leave a second independently editable role model.
create or replace function multi_role_private.stage2a_check_memberships()
returns trigger language plpgsql volatile security definer set search_path = '' as $$
declare target uuid; targets uuid[];
begin
  if tg_table_name = 'profiles' then
    targets := array[new.id];
  elsif tg_op = 'INSERT' then targets := array[new.profile_id];
  elsif tg_op = 'DELETE' then targets := array[old.profile_id];
  else targets := array[old.profile_id, new.profile_id];
  end if;
  foreach target in array targets loop
    if exists (select 1 from public.profiles p where p.id = target
      and (p.is_admin is distinct from (p.role = 'admin')
        or (select count(*) from public.profile_operational_roles m where m.profile_id = p.id)
          <> case when p.role = 'admin' then 0 else 1 end
        or exists (select 1 from public.profile_operational_roles m
          where m.profile_id = p.id and m.role_code <> p.role))) then
      raise exception 'Stage 2A memberships must exactly match the legacy role' using errcode = '23514';
    end if;
  end loop;
  return null;
end $$;

alter function multi_role_private.stage2a_lock_profiles() owner to postgres;
alter function multi_role_private.stage2a_guard_profile() owner to postgres;
alter function multi_role_private.stage2a_sync_memberships() owner to postgres;
alter function multi_role_private.stage2a_check_memberships() owner to postgres;
revoke all on function multi_role_private.stage2a_lock_profiles(),
  multi_role_private.stage2a_guard_profile(), multi_role_private.stage2a_sync_memberships(),
  multi_role_private.stage2a_check_memberships() from public, anon, authenticated, service_role;

drop trigger if exists stage2a_lock_profiles on public.profiles;
create trigger stage2a_lock_profiles before insert or update or delete on public.profiles
for each statement execute function multi_role_private.stage2a_lock_profiles();
drop trigger if exists stage2a_guard_profile_before on public.profiles;
create trigger stage2a_guard_profile_before before insert or update or delete on public.profiles
for each row execute function multi_role_private.stage2a_guard_profile();
drop trigger if exists stage2a_guard_profile_after on public.profiles;
create trigger stage2a_guard_profile_after after insert or update on public.profiles
for each row execute function multi_role_private.stage2a_guard_profile();
drop trigger if exists stage2a_sync_memberships on public.profiles;
create trigger stage2a_sync_memberships after insert or update on public.profiles
for each row execute function multi_role_private.stage2a_sync_memberships();
drop trigger if exists stage2a_profile_consistency on public.profiles;
create constraint trigger stage2a_profile_consistency after insert or update on public.profiles
 deferrable initially deferred for each row execute function multi_role_private.stage2a_check_memberships();
drop trigger if exists stage2a_lock_memberships on public.profile_operational_roles;
create trigger stage2a_lock_memberships before insert or update or delete on public.profile_operational_roles
for each statement execute function multi_role_private.stage2a_lock_profiles();
drop trigger if exists stage2a_membership_consistency on public.profile_operational_roles;
create constraint trigger stage2a_membership_consistency after insert or update or delete on public.profile_operational_roles
 deferrable initially deferred for each row execute function multi_role_private.stage2a_check_memberships();
commit;
