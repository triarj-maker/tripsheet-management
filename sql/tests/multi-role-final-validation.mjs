// In-memory PostgreSQL only. No database URL, credentials or production access.
// node sql/tests/multi-role-final-validation.mjs /absolute/path/to/pglite/dist/index.js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
if (!process.argv[2]) throw new Error('Pass a local PGlite module path.');
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const sql = await readFile(new URL('../verification/20261009_multi_role_final_validation.sql', import.meta.url), 'utf8');
const migration = await readFile(new URL('../20261009_multi_role_foundation.sql', import.meta.url), 'utf8');
const db = new PGlite();
let checks = 0;
function expect(report, name, status) {
  assert.equal(report.find(r => r.check_name === name)?.status, status, `${name}: ${JSON.stringify(report.find(r=>r.check_name===name))}`);
  checks++;
}
async function readOnlyReport() {
  await db.exec('begin read only');
  try {
    const results = await db.exec(sql);
    assert.equal(results.length, 1);
    assert.deepEqual(results[0].fields.map(f=>f.name), ['check_name','status','details']);
    assert.equal(new Set(results[0].rows.map(r=>r.check_name)).size,results[0].rows.length);
    assert(results[0].rows.every(r=>['PASS','FAIL','WARNING'].includes(r.status)));
    checks += 4;
    return results[0].rows;
  } finally { await db.exec('rollback'); }
}
async function scenario(setup, expectations) {
  await db.exec('begin');
  try {
    await db.exec(setup);
    const report = (await db.query(sql)).rows;
    for (const [name,status] of expectations) expect(report,name,status);
  } finally { await db.exec('rollback'); }
}
try {
  const absent = await readOnlyReport();
  expect(absent,'profiles_is_admin_definition','FAIL');
  expect(absent,'operational_roles_exists_with_rls','FAIL');
  expect(absent,'profile_operational_roles_exists_with_rls','FAIL');
  expect(absent,'legacy_admins_have_admin_permission','WARNING');
  expect(absent,'public_is_admin_exists','FAIL');
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create function auth.role() returns text language sql stable as $$ select null::text $$;
    create table auth.users (id uuid primary key);
    create table public.profiles (id uuid primary key, role text, is_active boolean, updated_at timestamptz default now());
    create table public.trip_sheets (id uuid primary key);
    create table public.trip_sheet_assignments (id uuid primary key, trip_sheet_id uuid, resource_user_id uuid, assigned_by uuid);
    create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
    create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
    insert into auth.users select ('00000000-0000-0000-0000-' || lpad(i::text,12,'0'))::uuid from generate_series(1,3) i;
    insert into public.profiles select id, case right(id::text,1) when '1' then 'admin' when '2' then 'facilitator' else 'expert' end, true, '2020-01-01' from auth.users;
    insert into public.trip_sheets values ('10000000-0000-0000-0000-000000000001');
    insert into public.trip_sheet_assignments values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001');
    create function public.is_admin() returns boolean language sql stable security definer set search_path='' as
      $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin') $$;
  `);
  await db.exec(migration);
  const good = await readOnlyReport();
  assert.deepEqual(good.filter(r=>r.status==='FAIL'),[]); checks++;
  expect(good,'catalogue_exactly_facilitator_expert','PASS');
  expect(good,'assignment_references_valid','PASS');
  expect(good,'admin_permission_protection_trigger','PASS');
  expect(good,'public_is_admin_exists','PASS');
  expect(good,'public_is_admin_legacy_compatibility','WARNING');
  expect(good,'historical_data_preservation','WARNING');
  expect(good,'original_transaction_integrity_check_completed','WARNING');
  await scenario("alter table public.operational_roles disable row level security", [['operational_roles_exists_with_rls','FAIL']]);
  await scenario("drop table public.profile_operational_roles", [['profile_operational_roles_exists_with_rls','FAIL'],['legacy_experts_have_membership','WARNING']]);
  await scenario("alter table public.profiles drop column is_admin", [['profiles_is_admin_definition','FAIL'],['legacy_admins_have_admin_permission','WARNING']]);
  await scenario("alter table public.profiles alter column is_admin set default true", [['profiles_is_admin_definition','FAIL']]);
  await scenario("insert into public.operational_roles values ('guide','Guide',true)", [['catalogue_exactly_facilitator_expert','FAIL']]);
  await scenario("update public.profiles set is_admin=false where role='admin'", [['legacy_admins_have_admin_permission','FAIL']]);
  await scenario("update public.profiles set is_admin=true where role='expert'", [['no_unexpected_admin_permissions','FAIL']]);
  await scenario("delete from public.profile_operational_roles", [['legacy_facilitators_have_membership','FAIL'],['legacy_experts_have_membership','FAIL']]);
  await scenario("alter table public.profile_operational_roles drop constraint profile_operational_roles_pkey; insert into public.profile_operational_roles select * from public.profile_operational_roles", [['no_duplicate_memberships','FAIL'],['membership_primary_key','FAIL']]);
  await scenario("alter table public.profile_operational_roles drop constraint profile_operational_roles_profile_id_fkey; insert into public.profile_operational_roles values ('99999999-0000-0000-0000-000000000001','expert')", [['no_invalid_or_orphaned_memberships','FAIL']]);
  await scenario("update public.profiles set role='resource' where role='expert'", [['no_unmapped_legacy_roles','FAIL']]);
  await scenario("update public.trip_sheet_assignments set resource_user_id=null", [['assignment_references_valid','FAIL']]);
  await scenario("alter table public.profiles disable trigger stage1_protect_admin_permission", [['admin_permission_protection_trigger','FAIL']]);
  await scenario("alter policy stage1_memberships_insert on public.profile_operational_roles with check (true)", [['policy_stage1_memberships_insert','FAIL']]);
  await scenario("create policy extra on public.profile_operational_roles for all to authenticated using(true)", [['no_additional_new_table_policies','FAIL']]);
  await scenario("grant truncate on public.profile_operational_roles to public", [['table_grants_authenticated_memberships','FAIL'],['table_grants_anon_memberships','FAIL']]);
  await scenario("grant execute on function multi_role_private.protect_profile_admin_permission() to public", [['security_function_execute_grants','FAIL']]);
  await scenario("grant create on schema multi_role_private to authenticated", [['private_schema_no_client_create','FAIL']]);
  await scenario("grant truncate on public.profiles to anon", [['existing_profiles_client_truncate_privilege','FAIL']]);
  await scenario("drop function public.is_admin()", [['public_is_admin_exists','FAIL'],['public_is_admin_legacy_compatibility','WARNING']]);
  // A helper with side effects must be INSPECTED, never executed by the validator.
  await scenario("create or replace function public.is_admin() returns boolean language plpgsql as $$ begin raise exception 'must not execute'; end $$", [['public_is_admin_exists','PASS'],['public_is_admin_legacy_compatibility','WARNING']]);
  console.log(`PASS: ${checks} consolidated-validator assertions; one result table, read-only execution, missing objects and negative fixtures.`);
} finally { await db.close(); }
