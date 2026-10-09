-- READ ONLY, ONE result table. Requires Stage 1 and the Stage 2A bridge.
with expected_triggers(table_name,trigger_name,function_name,deferred) as (
  values
  ('profiles','stage2a_lock_profiles','stage2a_lock_profiles',false),
  ('profiles','stage2a_guard_profile_before','stage2a_guard_profile',false),
  ('profiles','stage2a_guard_profile_after','stage2a_guard_profile',false),
  ('profiles','stage2a_sync_memberships','stage2a_sync_memberships',false),
  ('profiles','stage2a_profile_consistency','stage2a_check_memberships',true),
  ('profile_operational_roles','stage2a_lock_memberships','stage2a_lock_profiles',false),
  ('profile_operational_roles','stage2a_membership_consistency','stage2a_check_memberships',true)
), checks(check_name,ok,details) as (
  select 'single_role_permission_consistency', not exists (
    select 1 from public.profiles where role is null or role not in ('admin','facilitator','expert')
      or is_active is null or is_admin is distinct from (role='admin')),
    'Legacy role is authoritative; is_admin must exactly equal role = admin, including inactive profiles.'
  union all
  select 'single_role_membership_consistency', not exists (
    (select id,role from public.profiles where role in ('facilitator','expert') except select profile_id,role_code from public.profile_operational_roles)
    union all
    (select profile_id,role_code from public.profile_operational_roles except select id,role from public.profiles where role in ('facilitator','expert'))
  ), 'Admin has no operational membership; Facilitator/Expert has exactly its corresponding membership.'
  union all
  select 'active_admin_exists', exists(select 1 from public.profiles where role='admin' and is_admin and is_active),
    'Current-state check only; final-Admin runtime and concurrency tests must also pass.'
  union all
  select 'bridge_triggers_enabled', not exists (
    select 1 from expected_triggers e where not exists (
      select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid
      join pg_namespace n on n.oid=p.pronamespace
      where t.tgrelid=to_regclass('public.'||e.table_name) and t.tgname=e.trigger_name
        and t.tgenabled='O' and p.proname=e.function_name and n.nspname='multi_role_private'
        and t.tgdeferrable=e.deferred and t.tginitdeferred=e.deferred
    )
  ), 'Seven enabled triggers must reference the expected private functions. Review full definitions with preflight.'
  union all
  select 'bridge_functions_hardened', count(*)=4 and bool_and(p.prosecdef
    and pg_get_userbyid(p.proowner)='postgres' and p.proconfig @> array['search_path=""']
    and not exists (select 1 from pg_roles r where r.rolname in ('anon','authenticated','service_role')
      and has_function_privilege(r.oid,p.oid,'EXECUTE'))),
    'Four postgres-owned SECURITY DEFINER functions, empty search_path, no client/service direct EXECUTE.'
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='multi_role_private' and p.proname in ('stage2a_lock_profiles','stage2a_guard_profile','stage2a_sync_memberships','stage2a_check_memberships')
  union all
  select 'client_profiles_truncate_denied', not exists (
    select 1 from pg_roles r where r.rolname in ('anon','authenticated')
      and has_table_privilege(r.oid,'public.profiles','TRUNCATE')),
    'Effective privilege check includes inherited grants and PUBLIC.'
  union all
  select 'serialization_row_exists', count(*)=1 and bool_and(singleton),
    'A real row UPDATE serializes profile and membership writers.'
  from multi_role_private.stage2a_write_lock
)
select check_name, case when ok then 'PASS' else 'FAIL' end as status, details from checks
union all
select 'live_dependency_review','WARNING','Current metadata alone does not prove every existing trigger, policy, SECURITY DEFINER entry point or Auth hook is compatible. Review preflight and restored-database tests.'
union all
select 'historical_preservation','WARNING','Historical preservation requires a before/after snapshot; current state alone cannot prove it.'
union all
select 'concurrent_last_admin_protection','WARNING','Run the two-session test in the Stage 2A runbook on a disposable PostgreSQL server before deployment.'
order by check_name;
