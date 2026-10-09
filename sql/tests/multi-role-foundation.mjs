// Disposable in-memory PostgreSQL only. Never accepts a database URL.
// node sql/tests/multi-role-foundation.mjs /absolute/path/to/pglite/dist/index.js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

if (!process.argv[2]) throw new Error('Pass the local PGlite module path; see runbook.');
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const migration = await readFile(new URL('../20261009_multi_role_foundation.sql', import.meta.url), 'utf8');
const preflight = await readFile(new URL('../verification/20261009_multi_role_preflight.sql', import.meta.url), 'utf8');
const validation = await readFile(new URL('../verification/20261009_multi_role_validation.sql', import.meta.url), 'utf8');
const admin = '00000000-0000-0000-0000-000000000001';
const facilitator = '00000000-0000-0000-0000-000000000002';
const expert = '00000000-0000-0000-0000-000000000003';
const inactiveAdmin = '00000000-0000-0000-0000-000000000004';
const newcomer = '00000000-0000-0000-0000-000000000005';
let assertions = 0;
function equal(actual, expected) { assert.deepEqual(actual, expected); assertions++; }

async function fixture() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.role() returns text language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
    grant usage on schema auth to anon, authenticated, service_role;
    create table auth.users (id uuid primary key);
    create table public.profiles (
      id uuid primary key references auth.users(id), full_name text, email text,
      phone text, role text check (role in ('admin','facilitator','expert','resource')),
      is_active boolean, updated_at timestamptz default now()
    );
    create table public.trip_sheet_assignments (
      id uuid primary key, trip_sheet_id uuid, resource_user_id uuid references public.profiles(id),
      assigned_by uuid references auth.users(id), unique (trip_sheet_id, resource_user_id)
    );
    insert into auth.users values ('${admin}'), ('${facilitator}'), ('${expert}'), ('${inactiveAdmin}'), ('${newcomer}');
    insert into public.profiles (id, full_name, email, role, is_active) values
      ('${admin}', 'Admin', 'admin@example.test', 'admin', true),
      ('${facilitator}', 'Facilitator', 'facilitator@example.test', 'facilitator', true),
      ('${expert}', 'Expert', 'expert@example.test', 'expert', true),
      ('${inactiveAdmin}', 'Inactive', 'inactive@example.test', 'admin', false);
    -- Fixed historical values prevent NOW() accidentally matching fixture setup.
    update public.profiles set updated_at = '2020-01-01 00:00:00+00';
    create function public.set_updated_at() returns trigger language plpgsql as
      $$ begin new.updated_at = now(); return new; end $$;
    create trigger set_profiles_updated_at before update on public.profiles
      for each row execute function public.set_updated_at();
    insert into public.trip_sheet_assignments values
      ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '${facilitator}', '${admin}');
    alter table public.profiles enable row level security;
    create policy fixture_read on public.profiles for select to authenticated using (true);
    -- Deliberately broad row updates exercise the field guard even with table grants.
    create policy fixture_update on public.profiles for update to authenticated using (true) with check (true);
    create policy fixture_insert on public.profiles for insert to authenticated with check (id = auth.uid());
    grant select, insert, update on public.profiles to authenticated;
    grant all on public.profiles to service_role;
  `);
  return db;
}
async function rows(db, sql) { return (await db.query(sql)).rows; }
async function asUser(db, id, sql, expectedError, role = 'authenticated') {
  await db.exec(`begin; set local role ${role};
    select set_config('request.jwt.claim.sub', '${id}', true);
    select set_config('request.jwt.claim.role', '${role}', true);`);
  try {
    if (expectedError) {
      await assert.rejects(db.query(sql), error => error.code === expectedError);
      assertions++;
    } else {
      return await db.query(sql);
    }
  } finally { await db.exec('rollback'); }
}

const db = await fixture();
try {
  const beforeProfiles = await rows(db, 'select to_jsonb(p) as row from public.profiles p order by id');
  const beforeAssignments = await rows(db, 'select * from public.trip_sheet_assignments order by id');
  const beforeAuth = await rows(db, 'select * from auth.users order by id');
  const beforeTimestampTrigger = await rows(db, "select pg_get_triggerdef(oid) as definition from pg_trigger where tgname = 'set_profiles_updated_at'");
  await db.exec(preflight);
  // Reproduce the original strict comparison with the actual production trigger.
  const strictMigration = migration.replace(
    "then jsonb_set(b.original, '{updated_at}', to_jsonb(u.expected_updated_at))",
    'then b.original'
  );
  assert.notEqual(strictMigration, migration);
  await assert.rejects(db.exec(strictMigration), error => error.code === 'P0001' && error.message.startsWith('Existing profile fields changed'));
  assertions++;
  await db.exec('rollback');
  equal(await rows(db, 'select to_jsonb(p) as row from public.profiles p order by id'), beforeProfiles);
  equal(await rows(db, "select to_regclass('public.operational_roles') as object"), [{ object: null }]);
  const application = await db.exec(migration.replace(/\ncommit;\s*$/, '\nselect now()::text as migration_timestamp;\ncommit;'));
  const migrationTimestamp = application.find(r => r.rows[0]?.migration_timestamp).rows[0].migration_timestamp;
  const results = await db.exec(validation);
  equal(results.find(r => r.rows[0]?.check_name)?.rows.every(r => Number(r.failures) === 0), true);
  const afterProfiles = await rows(db, "select to_jsonb(p) - 'is_admin' as row from public.profiles p order by id");
  equal(afterProfiles.length, beforeProfiles.length);
  for (const [index, { row: before }] of beforeProfiles.entries()) {
    const after = afterProfiles[index].row;
    if (before.role === 'admin') {
      equal({ ...after, updated_at: before.updated_at }, before);
      assert.notEqual(after.updated_at, before.updated_at);
      assertions++;
    } else equal(after, before);
  }
  equal((await db.query("select bool_and(updated_at = $1::timestamptz) as exact_timestamp from public.profiles where role = 'admin'", [migrationTimestamp])).rows, [{ exact_timestamp: true }]);
  equal(await rows(db, 'select * from auth.users order by id'), beforeAuth);
  equal(await rows(db, "select pg_get_triggerdef(oid) as definition from pg_trigger where tgname = 'set_profiles_updated_at'"), beforeTimestampTrigger);
  equal(await rows(db, 'select * from public.trip_sheet_assignments order by id'), beforeAssignments);
  equal(await rows(db, 'select id from public.profiles where is_admin order by id'), [{ id: admin }, { id: inactiveAdmin }]);
  equal(await rows(db, 'select profile_id, role_code from public.profile_operational_roles order by profile_id'), [
    { profile_id: facilitator, role_code: 'facilitator' }, { profile_id: expert, role_code: 'expert' },
  ]);
  await asUser(db, facilitator, `update public.profiles set is_admin = true where id = '${facilitator}'`, '42501');
  await asUser(db, facilitator, `update public.profiles set is_admin = false where id = '${admin}'`, '42501');
  await asUser(db, inactiveAdmin, `update public.profiles set is_admin = true where id = '${facilitator}'`, '42501');
  await asUser(db, newcomer, `insert into public.profiles (id, role, is_admin) values ('${newcomer}', 'expert', true)`, '42501');
  await asUser(db, facilitator, `update public.profiles set role = 'admin', is_admin = true where id = '${facilitator}'`, '42501');
  // Even an overly broad LEGACY role policy must not unlock the NEW structures.
  await db.exec(`update public.profiles set role = 'admin' where id = '${facilitator}'`);
  await asUser(db, facilitator, `update public.profiles set is_admin = true where id = '${facilitator}'`, '42501');
  await asUser(db, facilitator, `insert into public.profile_operational_roles values ('${facilitator}', 'expert')`, '42501');
  await db.exec(`update public.profiles set role = 'facilitator' where id = '${facilitator}'`);
  await asUser(db, facilitator, `insert into public.profiles (id, role, is_admin) values ('${facilitator}', 'facilitator', true)
    on conflict (id) do update set is_admin = excluded.is_admin`, '42501');
  equal((await asUser(db, facilitator, `update public.profiles set phone = '123' where id = '${facilitator}' returning phone`)).rows, [{ phone: '123' }]);
  equal((await asUser(db, admin, `update public.profiles set is_admin = true where id = '${expert}' returning is_admin`)).rows, [{ is_admin: true }]);
  equal((await asUser(db, '', `update public.profiles set is_admin = true where id = '${expert}' returning is_admin`, null, 'service_role')).rows, [{ is_admin: true }]);
  for (const target of [facilitator, expert]) {
    await asUser(db, facilitator, `insert into public.profile_operational_roles values ('${target}', 'expert')`, '42501');
    equal((await asUser(db, facilitator, `delete from public.profile_operational_roles where profile_id = '${target}' returning *`)).rows, []);
    equal((await asUser(db, facilitator, `update public.profile_operational_roles set role_code = 'expert' where profile_id = '${target}' returning *`)).rows, []);
  }
  await asUser(db, inactiveAdmin, `insert into public.profile_operational_roles values ('${admin}', 'expert')`, '42501');
  await asUser(db, facilitator, 'truncate public.profile_operational_roles', '42501');
  await asUser(db, admin, "insert into public.operational_roles values ('guide','Guide',true)", '42501');
  await asUser(db, '', 'select * from public.profile_operational_roles', '42501', 'anon');
  equal((await asUser(db, facilitator, 'select profile_id from public.profile_operational_roles')).rows, [{ profile_id: facilitator }]);
  equal((await asUser(db, admin, `insert into public.profile_operational_roles values ('${facilitator}', 'expert') returning role_code`)).rows, [{ role_code: 'expert' }]);
  equal((await asUser(db, admin, `delete from public.profile_operational_roles where profile_id = '${expert}' returning role_code`)).rows, [{ role_code: 'expert' }]);
  await asUser(db, admin, `insert into public.profile_operational_roles values ('${facilitator}', 'facilitator')`, '23505');
  await asUser(db, admin, `insert into public.profile_operational_roles values ('${facilitator}', 'guide')`, '23503');
  await asUser(db, admin, `insert into public.profile_operational_roles values ('99999999-0000-0000-0000-000000000001', 'expert')`, '23503');
  // A second execution preserves intentional additions and permission changes.
  await db.exec(`insert into public.profile_operational_roles values ('${admin}', 'facilitator');
    update public.profiles set is_admin = true where id = '${expert}';`);
  const beforeRerun = await rows(db, 'select * from public.profile_operational_roles order by profile_id, role_code');
  const profilesBeforeRerun = await rows(db, 'select to_jsonb(p) as row from public.profiles p order by id');
  // Simulate an unrelated timestamp-only change during rerun. With an empty
  // backfill set it must still fail, for Admin and non-Admin profiles alike.
  for (const id of [admin, facilitator]) {
    const contaminatedRerun = migration.replace('do $integrity$',
      `update public.profiles set phone = phone where id = '${id}';\ndo $integrity$`);
    await assert.rejects(db.exec(contaminatedRerun), error => error.code === 'P0001' && error.message.startsWith('Existing profile fields changed'));
    assertions++;
    await db.exec('rollback');
    equal(await rows(db, 'select to_jsonb(p) as row from public.profiles p order by id'), profilesBeforeRerun);
  }
  await db.exec(migration);
  equal(await rows(db, 'select to_jsonb(p) as row from public.profiles p order by id'), profilesBeforeRerun);
  equal(await rows(db, 'select * from public.profile_operational_roles order by profile_id, role_code'), beforeRerun);
  equal(await rows(db, `select is_admin from public.profiles where id = '${expert}'`), [{ is_admin: true }]);
  equal(await rows(db, 'select * from public.trip_sheet_assignments order by id'), beforeAssignments);
  console.log('PASS: backfill, preservation, RLS, field guard, allowed edits, constraints, rerun, read-only SQL');
} finally { await db.close(); }

for (const scenario of ['legacy', 'null_role', 'trigger_side_effect', 'wrong_timestamp', 'unrelated_timestamp', 'assignment_side_effect', 'collision']) {
  const isolated = await fixture();
  try {
    if (scenario === 'legacy') await isolated.exec(`update public.profiles set role = 'resource' where id = '${expert}'`);
    if (scenario === 'null_role') await isolated.exec(`update public.profiles set role = null where id = '${expert}'`);
    if (scenario === 'collision') await isolated.exec('alter table public.profiles add column is_admin boolean default false');
    if (scenario === 'trigger_side_effect') await isolated.exec(`
      create function fixture_touch() returns trigger language plpgsql as
      $$ begin new.phone = 'unexpected'; return new; end $$;
      create trigger fixture_touch before update on public.profiles for each row execute function fixture_touch();`);
    if (scenario === 'wrong_timestamp') await isolated.exec(`
      create function fixture_wrong_timestamp() returns trigger language plpgsql as
      $$ begin new.updated_at = now() + interval '1 day'; return new; end $$;
      create trigger zz_fixture_wrong_timestamp before update on public.profiles
      for each row execute function fixture_wrong_timestamp();`);
    if (scenario === 'unrelated_timestamp') await isolated.exec(`
      create function fixture_unrelated_timestamp() returns trigger language plpgsql as
      $$ begin if new.role = 'admin' then
        update public.profiles set phone = phone where id = '${facilitator}';
      end if; return new; end $$;
      create trigger fixture_unrelated_timestamp after update on public.profiles
      for each row execute function fixture_unrelated_timestamp();`);
    if (scenario === 'assignment_side_effect') await isolated.exec(`
      create function fixture_assignment_change() returns trigger language plpgsql as
      $$ begin update public.trip_sheet_assignments set assigned_by = '${expert}'; return new; end $$;
      create trigger fixture_assignment_change after update on public.profiles
      for each row execute function fixture_assignment_change();`);
    const baseline = await rows(isolated, 'select * from public.profiles order by id');
    const assignmentBaseline = await rows(isolated, 'select * from public.trip_sheet_assignments order by id');
    await assert.rejects(isolated.exec(migration), error => error.code === 'P0001');
    assertions++;
    await isolated.exec('rollback');
    equal(await rows(isolated, 'select * from public.profiles order by id'), baseline);
    equal(await rows(isolated, 'select * from public.trip_sheet_assignments order by id'), assignmentBaseline);
    equal(await rows(isolated, "select to_regclass('public.profile_operational_roles') as object"), [{ object: null }]);
    console.log(`PASS: ${scenario} aborts atomically`);
  } finally { await isolated.close(); }
}
// Match the original column's timestamp type, precision and session timezone.
for (const timestampType of ['timestamp(0) with time zone', 'timestamp(3) without time zone']) {
  const typed = await fixture();
  try {
    await typed.exec(`set timezone = 'Asia/Kolkata';
      alter table public.profiles alter column updated_at type ${timestampType};`);
    const before = await rows(typed, "select to_jsonb(p) as row from public.profiles p where role <> 'admin' order by id");
    await typed.exec(migration);
    equal(await rows(typed, "select to_jsonb(p) - 'is_admin' as row from public.profiles p where role <> 'admin' order by id"), before);
    const after = await rows(typed, 'select to_jsonb(p) as row from public.profiles p order by id');
    await typed.exec(migration);
    equal(await rows(typed, 'select to_jsonb(p) as row from public.profiles p order by id'), after);
    console.log(`PASS: timestamp type/precision and rerun: ${timestampType}`);
  } finally { await typed.close(); }
}
console.log(`PASS: ${assertions} assertions; no live database connection used.`);
