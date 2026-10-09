-- Stage 2B/2C coordinated cutover ONLY. Do not apply while old app writers run.
-- Maintenance/drain -> this entire transaction -> combined app -> validate -> reopen.
begin;
lock table public.profiles in access exclusive mode;
lock table public.profile_operational_roles in access exclusive mode;
-- Stage 2A must exist. Retain its real-row serialization and timestamp trigger.
do $$ begin
  if to_regclass('multi_role_private.stage2a_write_lock') is null then
    raise exception 'Stage 2A bridge required';
  end if;
  if not exists(select 1 from public.profiles where is_admin and is_active) then
    raise exception 'At least one active Admin required';
  end if;
end $$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles where id=auth.uid() and is_admin and is_active is true)
$$;
alter function public.is_admin() owner to postgres;
-- Preserve existing helper grants: changing its body adds no caller access.
create or replace function multi_role_private.is_stage1_admin()
returns boolean language sql stable security definer set search_path='' as $$
  select public.is_admin()
$$;
alter function multi_role_private.is_stage1_admin() owner to postgres;

-- Some live databases retain this pre-Facilitator/Expert compatibility helper.
-- Replace it in place only when present: CREATE OR REPLACE preserves its OID,
-- dependencies, owner and grants. Preserve its existing argument name as well,
-- because PostgREST named calls may depend on it. Admin permission alone does not
-- imply an operational role.
do $legacy_active_resource$
declare argument_declaration text;
begin
  if to_regprocedure('public.is_active_resource(uuid)') is not null then
    select case
      when p.proargnames is null or p.proargnames[1] is null then 'uuid'
      else format('%I uuid',p.proargnames[1])
    end into argument_declaration
    from pg_proc p
    where p.oid=to_regprocedure('public.is_active_resource(uuid)');

    execute format($definition$
      create or replace function public.is_active_resource(%s)
      returns boolean language sql stable security definer set search_path='' as $function$
        select exists(
          select 1 from public.profiles p
          where p.id=$1 and p.is_active is true
            and exists(
              select 1 from public.profile_operational_roles m
              where m.profile_id=p.id and m.role_code in ('facilitator','expert')
            )
        )
      $function$
    $definition$,argument_declaration);
  end if;
end $legacy_active_resource$;

-- Revise only recognized inline Admin predicates, preserving policy roles,
-- permissiveness, command and all surrounding conditions. Unknown expressions
-- abort the transaction instead of silently leaving legacy authorization behind.
do $policies$
declare r record; original text; revised text; clause text;
begin
  for r in select pol.oid, pol.polname, pol.polrelid, pg_get_expr(pol.polqual,pol.polrelid) as qual,
      pg_get_expr(pol.polwithcheck,pol.polrelid) as chk
    from pg_policy pol join pg_class c on c.oid=pol.polrelid
    join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
  loop
    clause := '';
    for original in select x from unnest(array[r.qual,r.chk]) x loop
      if original is null then continue; end if;
      revised := regexp_replace(original,
        $re$\mprofiles\.role\s*=\s*'admin'(?:::text)?$re$,
        '(profiles.is_admin AND profiles.is_active IS TRUE)', 'g');
      if r.polrelid='public.profiles'::regclass then
        revised := regexp_replace(revised, $re$\mrole\s*=\s*'admin'(?:::text)?$re$,
          '(is_admin AND is_active IS TRUE)', 'g');
      end if;
      if regexp_replace(revised, 'auth\.role\(\)', '', 'g') ~ $re$\mrole\M$re$ then
        raise exception 'Unrecognized legacy policy predicate: % on %',r.polname,r.polrelid::regclass;
      end if;
    end loop;
    -- Repeat the narrow substitution independently for USING and WITH CHECK.
    if r.qual is not null then
      revised := regexp_replace(r.qual,$re$\mprofiles\.role\s*=\s*'admin'(?:::text)?$re$,'(profiles.is_admin AND profiles.is_active IS TRUE)','g');
      if r.polrelid='public.profiles'::regclass then
        revised := regexp_replace(revised,$re$\mrole\s*=\s*'admin'(?:::text)?$re$,'(is_admin AND is_active IS TRUE)','g');
      end if;
      clause := clause || format(' USING (%s)',revised);
    end if;
    if r.chk is not null then
      revised := regexp_replace(r.chk,$re$\mprofiles\.role\s*=\s*'admin'(?:::text)?$re$,'(profiles.is_admin AND profiles.is_active IS TRUE)','g');
      if r.polrelid='public.profiles'::regclass then
        revised := regexp_replace(revised,$re$\mrole\s*=\s*'admin'(?:::text)?$re$,'(is_admin AND is_active IS TRUE)','g');
      end if;
      clause := clause || format(' WITH CHECK (%s)',revised);
    end if;
    if clause<>'' then execute format('ALTER POLICY %I ON %s%s',r.polname,r.polrelid::regclass,clause); end if;
  end loop;
end $policies$;

-- A transaction-scoped capability, inaccessible to API roles. Not a caller-set
-- GUC: only these narrowly scoped definer RPCs can authorize protected writes.
create table if not exists multi_role_private.permission_write_scope (
  transaction_id bigint not null, profile_id uuid not null,
  primary key(transaction_id,profile_id)
);
alter table multi_role_private.permission_write_scope owner to postgres;
alter table multi_role_private.permission_write_scope enable row level security;
revoke all on multi_role_private.permission_write_scope from public,anon,authenticated,service_role;

create or replace function multi_role_private.authorize_permission_write()
returns void language plpgsql volatile security definer set search_path='' as $$
begin
  update multi_role_private.stage2a_write_lock set version=not version where singleton;
  if not found then raise exception 'Permission serialization row missing'; end if;
  if not (public.is_admin() or coalesce(auth.role()='service_role',false)
    or (session_user='postgres' and auth.uid() is null and current_setting('role') in ('none','postgres'))) then
    raise exception 'Only an active Admin may manage permissions' using errcode='42501';
  end if;
end $$;

create or replace function multi_role_private.guard_permissions()
returns trigger language plpgsql volatile security definer set search_path='' as $$
declare target uuid;
begin
  if tg_table_name='profiles' then
    if tg_op='DELETE' then raise exception 'Profile deletion is not supported' using errcode='42501'; end if;
    if tg_op='UPDATE' and new.id is distinct from old.id then
      raise exception 'Identity cannot change' using errcode='42501';
    end if;
    if tg_op='UPDATE' and new.is_admin is not distinct from old.is_admin
      and new.is_active is not distinct from old.is_active and new.role is not distinct from old.role then
      return new;
    end if;
    target := new.id;
  else
    if tg_op='UPDATE' and new.profile_id<>old.profile_id then
      raise exception 'Membership identity cannot change' using errcode='42501';
    end if;
    target := case when tg_op='DELETE' then old.profile_id else new.profile_id end;
  end if;
  if not exists(select 1 from multi_role_private.permission_write_scope
    where transaction_id=txid_current() and profile_id=target) then
    raise exception 'Use the atomic Team permission RPC; legacy permission writes are retired' using errcode='42501';
  end if;
  if tg_table_name='profiles' then
  if tg_op='UPDATE' and old.is_admin and old.is_active
    and (not new.is_admin or not new.is_active)
    and not exists(select 1 from public.profiles where id<>old.id and is_admin and is_active) then
    raise exception 'Cannot remove or deactivate the final active Administrator' using errcode='23514';
  end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;

create or replace function multi_role_private.check_permissions()
returns trigger language plpgsql volatile security definer set search_path='' as $$
declare target uuid; p public.profiles; codes text[]; projected text;
begin
  if tg_table_name='profiles' then target := new.id;
  elsif tg_op='DELETE' then target := old.profile_id;
  else target := new.profile_id; end if;
  select * into p from public.profiles where id=target;
  if not found then return null; end if;
  select coalesce(array_agg(role_code order by role_code),'{}') into codes
    from public.profile_operational_roles where profile_id=target;
  if not codes <@ array['facilitator','expert']::text[]
    or (p.is_active and not p.is_admin and cardinality(codes)=0) then
    raise exception 'Active non-admins require an operational membership' using errcode='23514';
  end if;
  projected := case when p.is_admin then 'admin' when 'facilitator'=any(codes) then 'facilitator'
    when 'expert'=any(codes) then 'expert' else 'facilitator' end;
  if p.role is distinct from projected then
    raise exception 'Legacy display projection is inconsistent' using errcode='23514';
  end if;
  return null;
end $$;

-- Core independent model for Stage 2C as well; no second architecture migration.
-- p_email non-null means create-only; null means update-only, never partial upsert.
create or replace function public.save_profile_permissions(
  p_id uuid, p_full_name text, p_phone text, p_admin boolean, p_roles text[], p_active boolean,
  p_email text default null
) returns void language plpgsql volatile security definer set search_path='' as $$
declare codes text[]; projected text;
begin
  perform multi_role_private.authorize_permission_write();
  if p_id is null or nullif(btrim(p_full_name),'') is null or p_admin is null or p_active is null
    or p_roles is null or array_position(p_roles,null) is not null
    or not p_roles <@ array['facilitator','expert']::text[] then
    raise exception 'Invalid profile permissions' using errcode='23514';
  end if;
  select coalesce(array_agg(distinct code order by code),'{}') into codes from unnest(p_roles) code;
  if p_active and not p_admin and cardinality(codes)=0 then
    raise exception 'Active non-admins require an operational membership' using errcode='23514';
  end if;
  projected := case when p_admin then 'admin' when 'facilitator'=any(codes) then 'facilitator'
    when 'expert'=any(codes) then 'expert' else 'facilitator' end;
  insert into multi_role_private.permission_write_scope values(txid_current(),p_id);
  if p_email is not null then
    if nullif(btrim(p_email),'') is null then raise exception 'Email required' using errcode='23514'; end if;
    insert into public.profiles(id,full_name,phone,email,role,is_admin,is_active)
      values(p_id,p_full_name,p_phone,p_email,projected,p_admin,p_active);
  else
    update public.profiles set full_name=p_full_name,phone=p_phone,role=projected,is_admin=p_admin,is_active=p_active where id=p_id;
    if not found then raise exception 'Profile not found' using errcode='P0002'; end if;
  end if;
  delete from public.profile_operational_roles where profile_id=p_id and not role_code=any(codes);
  insert into public.profile_operational_roles(profile_id,role_code)
    select p_id,code from unnest(codes) code on conflict do nothing;
  delete from multi_role_private.permission_write_scope where transaction_id=txid_current() and profile_id=p_id;
end $$;

create or replace function public.set_profile_active(p_id uuid,p_active boolean)
returns void language plpgsql volatile security definer set search_path='' as $$
declare p public.profiles; codes text[];
begin
  perform multi_role_private.authorize_permission_write();
  select * into p from public.profiles where id=p_id;
  if not found then raise exception 'Profile not found' using errcode='P0002'; end if;
  select coalesce(array_agg(role_code),'{}') into codes from public.profile_operational_roles where profile_id=p_id;
  perform public.save_profile_permissions(p.id,p.full_name,p.phone,p.is_admin,codes,p_active,null);
end $$;

alter function multi_role_private.authorize_permission_write() owner to postgres;
alter function multi_role_private.guard_permissions() owner to postgres;
alter function multi_role_private.check_permissions() owner to postgres;
alter function public.save_profile_permissions(uuid,text,text,boolean,text[],boolean,text) owner to postgres;
alter function public.set_profile_active(uuid,boolean) owner to postgres;
revoke all on function multi_role_private.authorize_permission_write(), multi_role_private.guard_permissions(),
  multi_role_private.check_permissions() from public,anon,authenticated,service_role;
revoke all on function public.save_profile_permissions(uuid,text,text,boolean,text[],boolean,text),
  public.set_profile_active(uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function public.save_profile_permissions(uuid,text,text,boolean,text[],boolean,text),
  public.set_profile_active(uuid,boolean) to authenticated,service_role;

-- The combined Stage 2B/2C release has no scalar-role writer. Remove a function
-- left by an earlier local rehearsal if this migration is rerun in that fixture.
drop function if exists public.save_team_profile(uuid,text,text,text,boolean,text);

drop trigger if exists stage1_protect_admin_permission on public.profiles;
drop trigger if exists stage2a_guard_profile_before on public.profiles;
drop trigger if exists stage2a_guard_profile_after on public.profiles;
drop trigger if exists stage2a_sync_memberships on public.profiles;
drop trigger if exists stage2a_profile_consistency on public.profiles;
drop trigger if exists stage2a_membership_consistency on public.profile_operational_roles;
drop trigger if exists stage2b_guard_profile_before on public.profiles;
create trigger stage2b_guard_profile_before before insert or update or delete on public.profiles
 for each row execute function multi_role_private.guard_permissions();
drop trigger if exists stage2b_guard_profile_after on public.profiles;
create trigger stage2b_guard_profile_after after insert or update on public.profiles
 for each row execute function multi_role_private.guard_permissions();
drop trigger if exists stage2b_guard_memberships on public.profile_operational_roles;
create trigger stage2b_guard_memberships before insert or update or delete on public.profile_operational_roles
 for each row execute function multi_role_private.guard_permissions();
drop trigger if exists stage2b_profile_consistency on public.profiles;
create constraint trigger stage2b_profile_consistency after insert or update on public.profiles
 deferrable initially deferred for each row execute function multi_role_private.check_permissions();
drop trigger if exists stage2b_membership_consistency on public.profile_operational_roles;
create constraint trigger stage2b_membership_consistency after insert or update or delete on public.profile_operational_roles
 deferrable initially deferred for each row execute function multi_role_private.check_permissions();

-- Never silently retain other public function bodies that authorize by scalar role.
do $$ declare signatures text;
begin
  select string_agg(p.oid::regprocedure::text,', ') into signatures
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prokind='f'
    and p.proname <> 'save_profile_permissions'
    and pg_get_functiondef(p.oid) ~ $re$\mprofiles\M$re$
    and regexp_replace(pg_get_functiondef(p.oid), 'auth\.role\(\)', '', 'g') ~ $re$\mrole\M$re$;
  if signatures is not null then raise exception 'Unconverted legacy authorization functions: %',signatures; end if;
end $$;
commit;
