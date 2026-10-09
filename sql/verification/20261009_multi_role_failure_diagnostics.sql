-- READ ONLY: run this entire file in a fresh Supabase SQL Editor query as postgres.
-- Does not execute the migration, trigger functions, or any application writes.
-- Returns one JSON result so all sections can be copied together.
-- Missing Stage 1 objects are expected after a failed first transaction.
begin transaction isolation level repeatable read read only;

with recursive profile_relations(oid) as (
  select to_regclass('public.profiles')::oid
  union
  select i.inhrelid from pg_inherits i join profile_relations r on i.inhparent = r.oid
),
targets(name) as (
  values ('public.profiles'), ('public.operational_roles'),
         ('public.profile_operational_roles'),
         ('public.profile_operational_roles_role_code_idx')
),
objects as (
  select t.name, c.oid is not null as present, c.relkind,
         pg_get_userbyid(c.relowner) as owner,
         c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced,
         c.relacl::text as grants
  from targets t left join pg_class c on c.oid = to_regclass(t.name)
),
columns as (
  select a.attnum as position, a.attname as column_name,
         format_type(a.atttypid, a.atttypmod) as type,
         a.attnotnull as not_null, a.attidentity as identity_kind,
         a.attgenerated as generated_kind,
         pg_get_expr(d.adbin, d.adrelid) as default_or_generated_expression,
         col_description(a.attrelid, a.attnum) as comment
  from pg_attribute a left join pg_attrdef d
    on d.adrelid = a.attrelid and d.adnum = a.attnum
  where a.attrelid = to_regclass('public.profiles')
    and a.attnum > 0 and not a.attisdropped
),
profile_triggers as (
  -- Include ALL events: INSERT/DDL-trigger interactions can also affect profiles.
  -- fires_on_update identifies the specific UPDATE triggers requested.
  select t.tgrelid::regclass::text as table_name, t.tgname as trigger_name,
         t.tgenabled as enabled_mode, t.tgisinternal as internal,
         (t.tgtype::int & 16) <> 0 as fires_on_update,
         t.tgdeferrable as deferrable, t.tginitdeferred as initially_deferred,
         pg_get_triggerdef(t.oid, true) as trigger_definition,
         p.oid::regprocedure::text as function_signature,
         pg_get_userbyid(p.proowner) as function_owner,
         p.prosecdef as security_definer, p.proconfig as function_settings,
         case when not t.tgisinternal then pg_get_functiondef(p.oid) end as function_definition
  from pg_trigger t join pg_proc p on p.oid = t.tgfoid
  where t.tgrelid in (select oid from profile_relations)
),
stage1_functions as (
  select p.oid::regprocedure::text as signature,
         pg_get_userbyid(p.proowner) as owner, p.prosecdef as security_definer,
         p.proconfig as settings, p.proacl::text as grants,
         pg_get_functiondef(p.oid) as definition
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'multi_role_private' and p.prokind = 'f'
),
rules as (
  select r.rulename, r.ev_enabled, pg_get_ruledef(r.oid, true) as definition
  from pg_rewrite r where r.ev_class in (select oid from profile_relations)
),
event_triggers as (
  select e.evtname, e.evtevent, e.evtenabled, e.evttags,
         e.evtfoid::regprocedure::text as function_signature,
         pg_get_functiondef(e.evtfoid) as function_definition
  from pg_event_trigger e
)
select jsonb_build_object(
  'session', jsonb_build_object('database', current_database(), 'user', current_user,
    'version', version(), 'timezone', current_setting('TimeZone'),
    'replication_role', current_setting('session_replication_role')),
  'stage1_objects', (select coalesce(jsonb_agg(to_jsonb(o) order by o.name), '[]') from objects o),
  'is_admin_present', exists (select 1 from columns where column_name = 'is_admin'),
  'private_schema_present', to_regnamespace('multi_role_private') is not null,
  'profile_columns', (select coalesce(jsonb_agg(to_jsonb(c) order by c.position), '[]') from columns c),
  'profile_triggers', (select coalesce(jsonb_agg(to_jsonb(t) order by t.table_name, t.trigger_name), '[]') from profile_triggers t),
  'stage1_functions', (select coalesce(jsonb_agg(to_jsonb(f) order by f.signature), '[]') from stage1_functions f),
  'profile_rules', (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from rules r),
  'event_triggers', (select coalesce(jsonb_agg(to_jsonb(e) order by e.evtname), '[]') from event_triggers e),
  'relevant_policies', (select coalesce(jsonb_agg(to_jsonb(p) order by p.tablename, p.policyname), '[]')
    from pg_policies p where p.schemaname = 'public'
      and p.tablename in ('profiles', 'operational_roles', 'profile_operational_roles'))
) as stage1_failure_diagnostics;

commit;
-- Review any helper functions called by the returned trigger definitions too.
-- These metadata results cannot recover rolled-back OLD/NEW row values. If the
-- definitions do not conclusively explain the change, reproduce in a disposable
-- restored database with a field-by-field diff, never with a production write probe.
