-- READ ONLY. Paste the ENTIRE file into Supabase SQL Editor and Run as postgres.
-- ONE SELECT / ONE result table. No migration, temp tables, DDL, DML or write probes.
-- query_to_xml below executes only SELECTs against six fixed, catalog-verified
-- base tables. It lets missing objects produce FAIL/WARNING rows, not SQL errors.
-- No application/security helper is executed; function bodies are inspected only.
-- PASS is limited to the named current-state check, not migration completion.
with
targets(key, schema_name, table_name) as (
  values ('profiles', 'public', 'profiles'), ('roles', 'public', 'operational_roles'),
    ('memberships', 'public', 'profile_operational_roles'),
    ('assignments', 'public', 'trip_sheet_assignments'),
    ('sheets', 'public', 'trip_sheets'), ('users', 'auth', 'users')
),
objects as materialized (
  select t.*, c.oid, c.relkind, c.relrowsecurity, c.relforcerowsecurity,
    coalesce(c.relkind in ('r', 'p') and has_table_privilege(c.oid, 'SELECT') and
      (not c.relrowsecurity or me.rolsuper or me.rolbypassrls or
       (c.relowner = me.oid and not c.relforcerowsecurity)), false) as readable
  from targets t
  left join pg_namespace n on n.nspname = t.schema_name
  left join pg_class c on c.relnamespace = n.oid and c.relname = t.table_name
  join pg_roles me on me.rolname = current_user
),
columns as (
  select o.key, a.attname, a.atttypid, a.attnotnull, a.attgenerated, a.attidentity,
    pg_get_expr(d.adbin, d.adrelid) as default_expression
  from objects o join pg_attribute a on a.attrelid = o.oid
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where a.attnum > 0 and not a.attisdropped
),
requirements(key, names) as (
  values ('profiles', array['id','role','is_admin']), ('roles', array['code','label','is_active']),
    ('memberships', array['profile_id','role_code']),
    ('assignments', array['trip_sheet_id','resource_user_id','assigned_by']),
    ('sheets', array['id']), ('users', array['id'])
),
readiness as (
  select o.key, o.readable and not exists (
    select 1 from requirements q cross join lateral unnest(q.names) name
    where q.key = o.key and not exists (
      select 1 from columns c where c.key = o.key and c.attname = name)
  ) as ready from objects o
),
payloads as materialized (
  select o.key, x.payload::jsonb as data
  from objects o join readiness rd on rd.key=o.key join requirements q on q.key=o.key
  cross join lateral xmltable('/row' passing
    query_to_xml(case when rd.ready then format(
      'SELECT coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb)::text AS payload FROM (SELECT %s FROM %I.%I) t',
      (select string_agg(format('%I', name), ', ') from unnest(q.names) name),
      o.schema_name, o.table_name)
      else 'SELECT ''[]''::text AS payload' end, false, true, '')
    columns payload text path 'payload') x
),
p as (select value j from payloads, lateral jsonb_array_elements(data) where key = 'profiles'),
r as (select value j from payloads, lateral jsonb_array_elements(data) where key = 'roles'),
m as (select value j from payloads, lateral jsonb_array_elements(data) where key = 'memberships'),
a as (select value j from payloads, lateral jsonb_array_elements(data) where key = 'assignments'),
s as (select value j from payloads, lateral jsonb_array_elements(data) where key = 'sheets'),
u as (select value j from payloads, lateral jsonb_array_elements(data) where key = 'users'),
data_checks(check_name, dependencies, failures, explanation) as (
  select 'catalogue_exactly_facilitator_expert', array['roles'],
    (select count(*) from r where (j->>'code') is null or j->>'code' not in ('facilitator','expert')) +
    (select count(*) from (values ('facilitator'), ('expert')) expected(code)
      where (select count(*) from r where j->>'code' = expected.code) <> 1),
    'Exactly one facilitator and one expert catalogue entry; no other codes.'
  union all select 'catalogue_labels_and_active_flags', array['roles'],
    (select count(*) from r where j->>'is_active' is distinct from 'true' or
      j->>'label' is distinct from case j->>'code' when 'facilitator' then 'Facilitator' when 'expert' then 'Expert' end),
    'Seed labels and active flags match the Stage 1 catalogue.'
  union all select 'legacy_admins_have_admin_permission', array['profiles'],
    (select count(*) from p where j->>'role' = 'admin' and j->>'is_admin' is distinct from 'true'),
    'Includes inactive legacy Admins; counts current-state mismatches.'
  union all select 'legacy_facilitators_have_membership', array['profiles','memberships'],
    (select count(*) from p where j->>'role' = 'facilitator' and not exists
      (select 1 from m where m.j->>'profile_id' = p.j->>'id' and m.j->>'role_code' = 'facilitator')),
    'Every current legacy Facilitator has facilitator membership.'
  union all select 'legacy_experts_have_membership', array['profiles','memberships'],
    (select count(*) from p where j->>'role' = 'expert' and not exists
      (select 1 from m where m.j->>'profile_id' = p.j->>'id' and m.j->>'role_code' = 'expert')),
    'Every current legacy Expert has expert membership.'
  union all select 'no_unexpected_admin_permissions', array['profiles'],
    (select count(*) from p where j->>'is_admin' = 'true' and j->>'role' is distinct from 'admin'),
    'Stage 1 expects no Admin flag on a non-admin legacy profile; investigate drift, do not auto-repair.'
  union all select 'no_duplicate_memberships', array['memberships'],
    (select count(*) from (select j->>'profile_id', j->>'role_code' from m group by 1,2 having count(*) > 1) d),
    'Number of duplicated profile/role groups.'
  union all select 'no_invalid_or_orphaned_memberships', array['memberships','profiles','roles'],
    (select count(*) from m where j->>'profile_id' is null or j->>'role_code' is null
      or not exists (select 1 from p where p.j->>'id' = m.j->>'profile_id')
      or not exists (select 1 from r where r.j->>'code' = m.j->>'role_code')),
    'Membership keys are non-null and resolve to existing profiles and catalogue roles.'
  union all select 'no_unmapped_legacy_roles', array['profiles'],
    (select count(*) from p where j->>'role' is null or j->>'role' not in ('admin','facilitator','expert')),
    'Legacy resource, null and unknown values require explicit review.'
  union all select 'profile_auth_references_valid', array['profiles','users'],
    (select count(*) from p where j->>'id' is null or not exists (select 1 from u where u.j->>'id' = p.j->>'id')),
    'Current profiles resolve to Auth users; does not prove historical IDs were preserved.'
  union all select 'assignment_references_valid', array['assignments','profiles','sheets','users'],
    (select count(*) from a where j->>'trip_sheet_id' is null or j->>'resource_user_id' is null
      or not exists (select 1 from s where s.j->>'id' = a.j->>'trip_sheet_id')
      or not exists (select 1 from p where p.j->>'id' = a.j->>'resource_user_id')
      or not exists (select 1 from u where u.j->>'id' = a.j->>'resource_user_id')
      or (j->>'assigned_by' is not null and
        (not exists (select 1 from p where p.j->>'id' = a.j->>'assigned_by')
         or not exists (select 1 from u where u.j->>'id' = a.j->>'assigned_by')))),
    'Checks Trip Sheet, assigned profile/Auth identity and non-null assigned_by references. Null assigned_by is not treated as an orphan.'
),
functions as (
  select p.*, n.nspname, l.lanname, pg_get_userbyid(p.proowner) as owner,
    pg_get_functiondef(p.oid) as definition
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  join pg_language l on l.oid = p.prolang
  where p.prokind = 'f' and p.pronargs = 0
    and ((n.nspname = 'multi_role_private' and p.proname in ('is_stage1_admin','protect_profile_admin_permission'))
      or (n.nspname = 'public' and p.proname = 'is_admin'))
),
expected_functions(name, return_type) as (
  values ('is_stage1_admin', 'boolean'::regtype), ('protect_profile_admin_permission', 'trigger'::regtype)
),
policies as (
  select p.*,
    regexp_replace(regexp_replace(lower(coalesce(qual,'')), '\s+as\s+(is_stage1_admin|uid)', '', 'g'), '[[:space:]()]', '', 'g') as normalized_using,
    regexp_replace(regexp_replace(lower(coalesce(with_check,'')), '\s+as\s+(is_stage1_admin|uid)', '', 'g'), '[[:space:]()]', '', 'g') as normalized_check
  from pg_policies p where schemaname = 'public'
    and tablename in ('operational_roles','profile_operational_roles')
),
expected_policies(table_name, name, command, using_expr, check_expr) as (
  values
    ('operational_roles','stage1_roles_read','SELECT','true',''),
    ('profile_operational_roles','stage1_memberships_read','SELECT',
      'profile_id=selectauth.uidorselectmulti_role_private.is_stage1_admin',''),
    ('profile_operational_roles','stage1_memberships_insert','INSERT','','selectmulti_role_private.is_stage1_admin'),
    ('profile_operational_roles','stage1_memberships_update','UPDATE',
      'selectmulti_role_private.is_stage1_admin','selectmulti_role_private.is_stage1_admin'),
    ('profile_operational_roles','stage1_memberships_delete','DELETE','selectmulti_role_private.is_stage1_admin','')
),
clients as (select oid, rolname from pg_roles where rolname in ('anon','authenticated','service_role')),
report(check_name, status, details) as (
  select 'profiles_is_admin_definition',
    case when exists (select 1 from columns where key = 'profiles' and attname = 'is_admin'
      and atttypid = 'boolean'::regtype and attnotnull and attgenerated = '' and attidentity = ''
      and default_expression in ('false','false::boolean')) then 'PASS' else 'FAIL' end,
    'Expected a plain boolean NOT NULL DEFAULT false column. Actual: ' || coalesce(
      (select jsonb_build_object('type',format_type(atttypid,null),'not_null',attnotnull,
        'default',default_expression,'generated',attgenerated)::text from columns where key='profiles' and attname='is_admin'), 'missing')
  union all
  select table_name || '_exists_with_rls',
    case when oid is not null and relkind in ('r','p') and relrowsecurity then 'PASS' else 'FAIL' end,
    format('Present=%s; kind=%s; RLS=%s; FORCE RLS=%s. FORCE is not required for ordinary API roles.',
      oid is not null, relkind, relrowsecurity, relforcerowsecurity)
  from objects where key in ('roles','memberships')
  union all
  select key || '_data_readiness', case when ready then 'PASS' else 'FAIL' end,
    'Required table/columns must exist and the current role must read all rows without invoking RLS. Run as postgres.'
  from readiness
  union all
  select d.check_name,
    case when exists (select 1 from unnest(d.dependencies) dep
      where not coalesce((select ready from readiness where key=dep),false)) then 'WARNING'
      when d.failures = 0 then 'PASS' else 'FAIL' end,
    case when exists (select 1 from unnest(d.dependencies) dep
      where not coalesce((select ready from readiness where key=dep),false))
      then 'Not evaluated reliably: missing/unreadable prerequisite; see data_readiness checks.'
      else format('Violations=%s. %s', d.failures, d.explanation) end
  from data_checks d
  union all
  select 'legacy_profiles_role_available',
    case when exists (select 1 from columns where key='profiles' and attname='role') then 'PASS' else 'FAIL' end,
    'Column availability only. Current role counts: ' || coalesce(
      (select jsonb_agg(x)::text from (select j->>'role' as role, count(*) as profiles from p group by 1) x),'[]')
  union all
  select 'admin_permission_protection_trigger',
    case when exists (select 1 from pg_trigger t join functions f on f.oid=t.tgfoid
      where t.tgrelid=(select oid from objects where key='profiles')
      and t.tgname='stage1_protect_admin_permission' and t.tgenabled in ('O','A')
      and not t.tgisinternal and t.tgtype=21 and t.tgqual is null
      and t.tgattr::text='' and t.tgnargs=0
      and f.nspname='multi_role_private' and f.proname='protect_profile_admin_permission')
      then 'PASS' else 'FAIL' end,
    'Requires enabled unconditional AFTER INSERT OR UPDATE FOR EACH ROW, bound to the intended function. Function semantics are reviewed separately.'
  union all
  select 'security_function_' || e.name,
    case when f.oid is not null and f.prorettype=e.return_type and not f.proretset
      and f.prosecdef and f.owner='postgres' and f.proconfig @> array['search_path=""']
      then 'PASS' else 'FAIL' end,
    format('Present=%s; owner=%s; SECURITY DEFINER=%s; settings=%s. Checks metadata, not body semantics.',
      f.oid is not null, f.owner, f.prosecdef, f.proconfig)
  from expected_functions e left join functions f on f.nspname='multi_role_private' and f.proname=e.name
  union all
  select 'security_function_body_review_' || e.name, 'WARNING',
    'Read-only metadata cannot prove runtime authorization. Compare this body with the reviewed migration; do not execute it as a test: ' || coalesce(f.definition,'MISSING')
  from expected_functions e left join functions f on f.nspname='multi_role_private' and f.proname=e.name
  union all
  select 'policy_' || e.name,
    case when p.policyname is not null and p.cmd=e.command and p.roles=array['authenticated']::name[]
      and p.permissive='PERMISSIVE' and p.normalized_using=e.using_expr and p.normalized_check=e.check_expr
      then 'PASS' else 'FAIL' end,
    format('Expected Stage 1 policy, command and predicates. Actual: command=%s; roles=%s; USING=%s; WITH CHECK=%s. Equivalent alternative definitions require manual review.',
      p.cmd,p.roles,p.qual,p.with_check)
  from expected_policies e left join policies p on p.tablename=e.table_name and p.policyname=e.name
  union all
  select 'no_additional_new_table_policies',
    case when exists (select 1 from policies p where not exists
      (select 1 from expected_policies e where e.table_name=p.tablename and e.name=p.policyname)) then 'FAIL' else 'PASS' end,
    'Extra policies can broaden access or alter expected behavior; only the five reviewed Stage 1 policies are expected.'
  union all
  select 'membership_primary_key', case when exists (
    select 1 from pg_constraint c where c.conrelid=(select oid from objects where key='memberships') and c.contype='p'
      and (select array_agg(a.attname::text order by k.ordinality) from unnest(c.conkey) with ordinality k(num,ordinality)
        join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.num)=array['profile_id','role_code']
  ) then 'PASS' else 'FAIL' end, 'Composite primary key prevents future duplicate memberships; separate data check verifies current rows.'
  union all
  select 'public_is_admin_exists', case when exists (
    select 1 from functions where nspname='public' and proname='is_admin'
      and prorettype='boolean'::regtype and not proretset) then 'PASS' else 'FAIL' end,
    'Existing profile policies need the zero-argument boolean helper. This check does not call it.'
  union all
  select 'public_is_admin_legacy_compatibility', 'WARNING',
    'Review whether this helper still authorizes via the authenticated user and legacy profiles.role = admin. Text matching cannot prove semantics, dependency safety or absence of RLS recursion. App authorization must not switch to the new flag in Stage 1. Definition: ' ||
    coalesce((select definition from functions where nspname='public' and proname='is_admin'),'MISSING')
  union all
  select 'historical_data_preservation', 'WARNING',
    'Current state cannot prove unchanged profile IDs/counts/role values, Auth users, assignments or other operational history. Compare saved pre-migration snapshots. Initial-backfill Admin updated_at is the sole expected old-field change.'
  union all
  select 'original_transaction_integrity_check_completed', 'WARNING',
    'Object presence does not prove the original migration integrity block ran before commit. Temporary snapshots cannot be reconstructed after the fact.'
  union all
  select 'runtime_authorization_and_application_access', 'WARNING',
    'No JWT impersonation, helper execution or write probes performed. Staging tests are needed to prove denied writes, permitted edits and unchanged application access.'
),
table_grant_expectations(role_name, key, privilege, expected) as (
  select role_name, key, privilege,
    case when role_name='anon' then false
      when role_name='authenticated' and key='roles' then privilege='SELECT'
      else privilege in ('SELECT','INSERT','UPDATE','DELETE') end
  from (values ('anon'),('authenticated'),('service_role')) roles(role_name)
  cross join (values ('roles'),('memberships')) tables(key)
  cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) privileges(privilege)
),
grant_results as (
  select e.*, o.oid as table_oid, c.oid as role_oid,
    has_table_privilege(c.oid,o.oid,e.privilege) as actual
  from table_grant_expectations e left join objects o on o.key=e.key
  left join clients c on c.rolname=e.role_name
),
permission_report(check_name,status,details) as (
  select 'table_grants_' || role_name || '_' || key,
    case when bool_and(table_oid is not null and role_oid is not null and actual is not distinct from expected)
      then 'PASS' else 'FAIL' end,
    string_agg(format('%s=%s (expected %s)',privilege,coalesce(actual::text,'missing'),expected),'; ' order by privilege) ||
      '. Effective privileges include inherited/PUBLIC grants; membership DML remains RLS-controlled.'
  from grant_results group by role_name,key
  union all
  select 'private_schema_no_client_create',
    case when to_regnamespace('multi_role_private') is not null
      and (select count(*) from clients where rolname in ('anon','authenticated'))=2
      and not exists (select 1 from clients where rolname in ('anon','authenticated')
        and has_schema_privilege(oid,to_regnamespace('multi_role_private'),'CREATE')) then 'PASS' else 'FAIL' end,
    'anon/authenticated must not create or replace objects in the helper schema.'
  union all
  select 'private_schema_api_usage',
    case when to_regnamespace('multi_role_private') is not null and (select count(*) from clients)=3
      and not exists (select 1 from clients where has_schema_privilege(oid,to_regnamespace('multi_role_private'),'USAGE')
        is distinct from (rolname in ('authenticated','service_role'))) then 'PASS' else 'FAIL' end,
    'authenticated/service_role require helper-schema USAGE; anon must not have it.'
  union all
  select 'security_function_execute_grants',
    case when (select count(*) from functions where nspname='multi_role_private')=2
      and (select count(*) from clients)=3
      and not exists (select 1 from functions f cross join clients c where f.nspname='multi_role_private'
        and has_function_privilege(c.oid,f.oid,'EXECUTE') is distinct from
          (f.proname='is_stage1_admin' and c.rolname in ('authenticated','service_role')))
      then 'PASS' else 'FAIL' end,
    'Only authenticated/service_role can call the read helper; no API role can directly execute the trigger function.'
  union all
  select 'legacy_helper_authenticated_execute',
    case when exists (select 1 from functions f join clients c on c.rolname='authenticated'
      where f.nspname='public' and f.proname='is_admin' and has_function_privilege(c.oid,f.oid,'EXECUTE'))
      then 'PASS' else 'FAIL' end,
    'Existing authenticated profile-policy evaluation requires EXECUTE on public.is_admin().'
  union all
  select 'existing_profiles_client_truncate_privilege',
    case when (select oid from objects where key='profiles') is null
      or (select count(*) from clients where rolname in ('anon','authenticated'))<>2 then 'WARNING'
      when exists (select 1 from clients c where c.rolname in ('anon','authenticated')
        and has_table_privilege(c.oid,(select oid from objects where key='profiles'),'TRUNCATE')) then 'FAIL' else 'PASS' end,
    'Checks a pre-existing grant, not changed by Stage 1. RLS does not protect TRUNCATE; review any anon/authenticated grant separately. Actual API exploitability is not tested.'
)
select check_name, status, details from report
union all
select check_name, status, details from permission_report
order by check_name;
