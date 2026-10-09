-- READ ONLY: run after the coordinated Stage 2B/2C migration, not against Stage 2A.
-- One result table. Does not prove historical preservation without snapshots.
with checks(check_name,ok,details) as (
  select 'active_admin_exists', exists(select 1 from public.profiles where is_admin and is_active),
    'Admin authority is is_admin AND is_active; legacy role is display compatibility only.'
  union all
  select 'active_profiles_have_permissions', not exists(select 1 from public.profiles p
    where p.is_active and not p.is_admin and not exists(select 1 from public.profile_operational_roles m where m.profile_id=p.id)),
    'Active non-admins require at least one operational membership.'
  union all
  select 'valid_memberships', not exists(select 1 from public.profile_operational_roles m
    left join public.profiles p on p.id=m.profile_id where p.id is null or m.role_code not in ('facilitator','expert')),
    'Only Facilitator and Expert memberships; every membership references an existing identity.'
  union all
  select 'legacy_projection', not exists(select 1 from public.profiles p where p.role is distinct from
    case when p.is_admin then 'admin'
      when exists(select 1 from public.profile_operational_roles m where m.profile_id=p.id and m.role_code='facilitator') then 'facilitator'
      when exists(select 1 from public.profile_operational_roles m where m.profile_id=p.id and m.role_code='expert') then 'expert'
      else 'facilitator' end), 'Projection preference: Admin, Facilitator, Expert; inactive/no permissions falls back to Facilitator.'
  union all
  select 'stage2a_sync_retired', not exists(select 1 from pg_trigger where tgrelid='public.profiles'::regclass
    and tgname in ('stage2a_guard_profile_before','stage2a_guard_profile_after','stage2a_sync_memberships','stage2a_profile_consistency','stage1_protect_admin_permission')),
    'Legacy synchronization/permission guard is replaced; timestamp and serialization triggers are retained.'
  union all
  select 'new_guards_and_serialization_enabled', count(*)=7 and bool_and(tgenabled='O'),
    'Five Stage 2B guards/constraints plus both Stage 2A statement serialization triggers.'
  from pg_trigger where tgrelid in ('public.profiles'::regclass,'public.profile_operational_roles'::regclass)
    and tgname in ('stage2b_guard_profile_before','stage2b_guard_profile_after','stage2b_guard_memberships',
      'stage2b_profile_consistency','stage2b_membership_consistency','stage2a_lock_profiles','stage2a_lock_memberships')
  union all
  select 'rpc_execute_grants', count(*)=2 and bool_and(
    has_function_privilege('authenticated',oid,'EXECUTE') and not has_function_privilege('anon',oid,'EXECUTE')
    and prosecdef and pg_get_userbyid(proowner)='postgres' and proconfig @> array['search_path=""']),
    'Two fixed-search-path Admin-authorized RPCs, no anonymous execution.'
  from pg_proc where oid in (to_regprocedure('public.save_profile_permissions(uuid,text,text,boolean,text[],boolean,text)'),
    to_regprocedure('public.set_profile_active(uuid,boolean)'))
  union all
  select 'legacy_team_role_rpc_absent',
    to_regprocedure('public.save_team_profile(uuid,text,text,text,boolean,text)') is null,
    'No scalar-role RPC remains capable of overwriting independent permissions.'
  union all
  select 'legacy_active_resource_helper_compatible',
    to_regprocedure('public.is_active_resource(uuid)') is null or exists(
      select 1 from pg_proc p
      where p.oid=to_regprocedure('public.is_active_resource(uuid)')
        and p.prorettype='boolean'::regtype and p.prosecdef
        and p.proconfig @> array['search_path=""']
        and pg_get_functiondef(p.oid) like '%profile_operational_roles%'
        and pg_get_functiondef(p.oid) !~ $re$\mrole\s*=\s*'resource'$re$
    ),
    'If the legacy uuid-to-boolean helper exists, it uses active operational memberships and retains no scalar-role authorization.'
  union all
  select 'write_scope_empty', not exists(select 1 from multi_role_private.permission_write_scope),
    'Atomic RPC capabilities are removed before commit and are never caller-set session flags.'
  union all
  select 'client_truncate_denied', not exists(select 1 from pg_roles where rolname in ('anon','authenticated')
    and (has_table_privilege(oid,'public.profiles','TRUNCATE') or has_table_privilege(oid,'public.profile_operational_roles','TRUNCATE'))),
    'Clients cannot bypass row triggers through TRUNCATE.'
)
select check_name,case when ok then 'PASS' else 'FAIL' end as status,details from checks
union all select 'historical_preservation','WARNING','Compare complete assignment/profile snapshots and Auth IDs from before/after deployment; current state cannot prove history.'
union all select 'runtime_access','WARNING','Smoke-test all seven combinations, login, Team RPCs, own personal routes, calendar and notification/PDF authorization after combined deployment.'
order by check_name;
