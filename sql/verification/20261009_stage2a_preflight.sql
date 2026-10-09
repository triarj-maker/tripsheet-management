-- READ ONLY. Run the whole query as postgres after Stage 1; returns ONE result.
-- Definitions may contain sensitive implementation details: share privately.
with functions as (
  select p.oid::regprocedure::text as signature, n.nspname as schema,
    pg_get_userbyid(p.proowner) as owner, p.prosecdef as security_definer,
    p.proconfig as settings, p.proacl::text as grants, pg_get_functiondef(p.oid) as definition
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where p.prokind in ('f','p') and (n.nspname in ('public','multi_role_private')
    or p.oid in (select tgfoid from pg_trigger where not tgisinternal))
), policies as (
  select *, coalesce(qual,'') || ' ' || coalesce(with_check,'') ~* '\mrole\M' as mentions_role
  from pg_policies where schemaname not in ('pg_catalog','information_schema')
), relations as (
  select c.oid::regclass::text as name, pg_get_userbyid(c.relowner) as owner,
    c.relrowsecurity as rls, c.relforcerowsecurity as force_rls, c.relacl::text as grants
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname in ('public','multi_role_private') and c.relkind in ('r','p','v')
), triggers as (
  select t.tgrelid::regclass::text as relation, t.tgname, t.tgenabled,
    pg_get_triggerdef(t.oid) as definition, t.tgfoid::regprocedure::text as function
  from pg_trigger t where not t.tgisinternal
), columns as (
  select a.attrelid::regclass::text as relation, a.attname, a.attnotnull,
    format_type(a.atttypid,a.atttypmod) as type, pg_get_expr(d.adbin,d.adrelid) as default_value
  from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
  where a.attrelid in ('public.profiles'::regclass,'public.profile_operational_roles'::regclass)
    and a.attnum>0 and not a.attisdropped
), constraints as (
  select conrelid::regclass::text as relation, conname, pg_get_constraintdef(oid) as definition
  from pg_constraint where conrelid in ('public.profiles'::regclass,'public.profile_operational_roles'::regclass)
    or confrelid='public.profiles'::regclass
), privileges as (
  select r.rolname, c.oid::regclass::text as relation, v.privilege,
    has_table_privilege(r.oid,c.oid,v.privilege) as allowed
  from pg_roles r cross join pg_class c
    cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) v(privilege)
  where r.rolname in ('anon','authenticated','service_role')
    and c.oid in ('public.profiles'::regclass,'public.profile_operational_roles'::regclass,'public.operational_roles'::regclass)
)
select jsonb_build_object(
  'session', jsonb_build_object('user',current_user,'version',version()),
  'policies', (select jsonb_agg(to_jsonb(x) order by schemaname,tablename,policyname) from policies x),
  'functions', (select jsonb_agg(to_jsonb(x) order by signature) from functions x),
  'relations', (select jsonb_agg(to_jsonb(x) order by name) from relations x),
  'triggers', (select jsonb_agg(to_jsonb(x) order by relation,tgname) from triggers x),
  'columns', (select jsonb_agg(to_jsonb(x)) from columns x),
  'constraints', (select jsonb_agg(to_jsonb(x)) from constraints x),
  'effective_grants', (select jsonb_agg(to_jsonb(x) order by rolname,relation,privilege) from privileges x),
  'role_inheritance', (select jsonb_agg(jsonb_build_object('member',pg_get_userbyid(member),'role',pg_get_userbyid(roleid))) from pg_auth_members),
  'profile_rules', (select jsonb_agg(pg_get_ruledef(oid)) from pg_rewrite where ev_class='public.profiles'::regclass),
  'event_triggers', (select jsonb_agg(jsonb_build_object('name',evtname,'enabled',evtenabled,'definition',pg_get_functiondef(evtfoid))) from pg_event_trigger),
  'active_admins', (select count(*) from public.profiles where role='admin' and is_admin and is_active),
  'permission_drift', (select count(*) from public.profiles where role is null or role not in ('admin','facilitator','expert') or is_active is null or is_admin is distinct from (role='admin')),
  'membership_drift', (select count(*) from (
    (select id,role from public.profiles where role in ('facilitator','expert') except select profile_id,role_code from public.profile_operational_roles)
    union all
    (select profile_id,role_code from public.profile_operational_roles except select id,role from public.profiles where role in ('facilitator','expert'))
  ) differences)
) as stage2a_preflight;
