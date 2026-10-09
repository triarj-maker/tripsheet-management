-- READ ONLY. AFTER approved application, as postgres. No impersonated writes.
-- Run preflight again and compare its saved baselines, policies, grants and triggers.
-- Initial-backfill Admin updated_at changes are expected (confirmed NOW() trigger)
-- and checked exactly by the migration. All other exported old fields must match;
-- full profile fingerprints need not match initially, but must match on reruns.
begin transaction isolation level repeatable read read only;

-- Immediately after initial backfill every result below must be zero.
-- Later legacy Team edits can create drift; see the runbook before Stage 2.
select 'admin_missing_permission' as check_name, count(*) as failures
from public.profiles where role::text = 'admin' and is_admin is not true
union all
select 'unexpected_admin_permission', count(*) from public.profiles
where role::text <> 'admin' and is_admin
union all
select 'missing_operational_membership', count(*) from public.profiles p
where p.role::text in ('facilitator', 'expert') and not exists (
  select 1 from public.profile_operational_roles m
  where m.profile_id = p.id and m.role_code = p.role::text)
union all
select 'unexpected_backfill_membership', count(*) from public.profile_operational_roles m
join public.profiles p on p.id = m.profile_id where m.role_code is distinct from p.role::text
union all
select 'ambiguous_legacy_role', count(*) from public.profiles
where role is null or role::text not in ('admin', 'facilitator', 'expert')
union all
select 'duplicate_membership_groups', count(*) from (
  select profile_id, role_code from public.profile_operational_roles
  group by profile_id, role_code having count(*) > 1
) duplicates
union all
select 'orphan_memberships', count(*) from public.profile_operational_roles m
left join public.profiles p on p.id = m.profile_id
left join public.operational_roles r on r.code = m.role_code
where p.id is null or r.code is null;

select code, label, is_active from public.operational_roles order by code;
select id, role, is_active, is_admin from public.profiles order by id;
-- Existing application projection; compare against the preflight profile export.
select id, full_name, email, phone, role, is_active from public.profiles order by id;

select c.relname, c.relrowsecurity, c.relforcerowsecurity, c.relacl
from pg_class c where c.oid in ('public.operational_roles'::regclass,
                              'public.profile_operational_roles'::regclass);
select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public'
  and tablename in ('profiles', 'operational_roles', 'profile_operational_roles')
order by tablename, policyname;
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid)
from pg_constraint where conrelid in ('public.operational_roles'::regclass,
                                     'public.profile_operational_roles'::regclass);
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_admin';
select tgname, tgenabled, pg_get_triggerdef(oid) from pg_trigger
where tgrelid = 'public.profiles'::regclass and not tgisinternal;
select n.nspname, p.proname, pg_get_userbyid(p.proowner) as owner,
       p.prosecdef, p.proconfig, p.proacl, pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'multi_role_private';

-- Expect false for catalogue writes, membership TRUNCATE and helper schema CREATE.
-- Membership DML grants are expected true for authenticated: RLS restricts rows.
select r.rolname,
       has_table_privilege(r.oid, 'public.operational_roles', 'INSERT') as catalogue_insert,
       has_table_privilege(r.oid, 'public.profile_operational_roles', 'TRUNCATE') as memberships_truncate,
       has_schema_privilege(r.oid, 'multi_role_private', 'CREATE') as helper_schema_create,
       has_function_privilege(r.oid, 'multi_role_private.protect_profile_admin_permission()', 'EXECUTE') as trigger_direct_execute
from pg_roles r where r.rolname in ('anon', 'authenticated');

-- Baseline equality plus unchanged legacy policies/helpers establishes structural
-- compatibility, NOT runtime authorization proof. Perform the documented staging
-- JWT/API write tests; read-only SQL cannot prove a write is rejected.
commit;
