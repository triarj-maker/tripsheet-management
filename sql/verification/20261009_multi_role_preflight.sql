-- READ ONLY. Run as postgres in Supabase BEFORE approving/applying Stage 1.
-- Save every result securely; identity rows contain personal information.
begin transaction isolation level repeatable read read only;

select current_user, session_user, version();
select n.nspname, c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity,
       pg_get_userbyid(c.relowner) as owner, c.relacl
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where (n.nspname = 'public' and c.relname in
       ('profiles', 'trip_sheet_assignments', 'operational_roles', 'profile_operational_roles'))
   or n.nspname = 'multi_role_private';

select column_name, data_type, udt_schema, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
order by ordinal_position;

-- Constraints in BOTH directions, including Auth/profile references and uniqueness.
select conrelid::regclass as source_table, conname, contype,
       nullif(confrelid, 0)::regclass as referenced_table,
       pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in ('public.profiles'::regclass, 'public.trip_sheet_assignments'::regclass)
   or confrelid in ('auth.users'::regclass, 'public.profiles'::regclass,
                   'public.trip_sheet_assignments'::regclass)
order by conrelid::regclass::text, conname;

select n.nspname, t.typname, e.enumlabel, e.enumsortorder
from pg_type t join pg_namespace n on n.oid = t.typnamespace
join pg_enum e on e.enumtypid = t.oid
where t.oid in (select atttypid from pg_attribute
               where attrelid = 'public.profiles'::regclass and attname = 'role')
order by e.enumsortorder;
select schemaname, tablename, indexname, indexdef from pg_indexes
where schemaname = 'public' and tablename in ('profiles', 'trip_sheet_assignments');

-- Review all policies because authorization can be factored through other tables.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public' order by tablename, policyname;
select grantee, table_name, privilege_type from information_schema.table_privileges
where table_schema = 'public' and table_name in ('profiles', 'trip_sheet_assignments')
order by table_name, grantee, privilege_type;
select grantee, table_name, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles'
order by grantee, column_name, privilege_type;
-- Effective privileges include table-level grants (column REVOKE alone is insufficient).
select r.rolname, a.attname,
       has_column_privilege(r.oid, a.attrelid, a.attnum, 'INSERT') as can_insert,
       has_column_privilege(r.oid, a.attrelid, a.attnum, 'UPDATE') as can_update
from pg_roles r cross join pg_attribute a
where r.rolname in ('anon', 'authenticated', 'service_role')
  and a.attrelid = 'public.profiles'::regclass and a.attnum > 0 and not a.attisdropped;

select t.tgrelid::regclass as table_name, t.tgname, t.tgenabled,
       pg_get_triggerdef(t.oid) as definition, pg_get_functiondef(t.tgfoid) as function_definition
from pg_trigger t where not t.tgisinternal
  and t.tgrelid in ('auth.users'::regclass, 'public.profiles'::regclass,
                    'public.trip_sheet_assignments'::regclass);

-- Inspect authorization functions and ALL public/private definer entry points.
-- Also audit functions in any other schema exposed through the project's Data API.
select n.nspname, p.proname, pg_get_userbyid(p.proowner) as owner,
       p.prosecdef, p.proconfig, p.proacl, pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where p.prokind = 'f' and n.nspname in ('public', 'multi_role_private')
  and (p.prosecdef or p.prosrc ~* '(profiles|auth\.uid|is_admin|role)');
select rolname, rolsuper, rolbypassrls from pg_roles
where rolname in ('postgres', 'anon', 'authenticated', 'service_role');

select role::text as legacy_role, is_active, count(*) from public.profiles
group by role::text, is_active order by legacy_role, is_active;
-- MUST be reviewed. Any result blocks this draft, including inactive legacy users.
select id, full_name, email, role::text, is_active from public.profiles
where role is null or role::text not in ('admin', 'facilitator', 'expert') order by id;
select p.id as profile_without_auth_user from public.profiles p
left join auth.users u on u.id = p.id where u.id is null;
select trip_sheet_id, resource_user_id, count(*) from public.trip_sheet_assignments
group by trip_sheet_id, resource_user_id having count(*) > 1;

-- Save these baselines and repeat after application during a quiet write window.
-- Counts alone cannot demonstrate unchanged rows. These hashes cover all fields.
-- On initial backfill the full profile hash WILL change because the confirmed
-- timestamp trigger updates Admin updated_at. Compare the exported rows: only
-- backfilled Admin timestamps may differ, as validated exactly inside migration.
-- Assignment/Auth fingerprints must match; reruns permit no timestamp difference.
select 'profiles_without_new_column' as dataset, count(*) as row_count,
       md5(coalesce(string_agg(md5((to_jsonb(p) - 'is_admin')::text), '' order by id), '')) as fingerprint
from public.profiles p
union all
select 'trip_sheet_assignments', count(*),
       md5(coalesce(string_agg(md5(to_jsonb(a)::text), '' order by id), ''))
from public.trip_sheet_assignments a
union all
select 'auth_user_ids', count(*), md5(coalesce(string_agg(id::text, '' order by id), '')) from auth.users;
-- Export the actual rows too for review/recovery; hashes are comparison evidence only.
select to_jsonb(p) - 'is_admin' as original_profile from public.profiles p order by id;
select to_jsonb(a) as original_assignment from public.trip_sheet_assignments a order by id;
commit;
