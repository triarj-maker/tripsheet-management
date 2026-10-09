// Disposable PostgreSQL (PGlite); no URL or production connection accepted.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
if (!process.argv[2]) throw new Error('Pass the local PGlite module path.');
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const read = name => readFile(new URL(name, import.meta.url), 'utf8');
const stage1 = await read('../20261009_multi_role_foundation.sql');
const bridge = await read('../20261009_multi_role_compatibility_bridge.sql');
const truncate = await read('../20261009_profiles_revoke_client_truncate.sql');
const preflight = await read('../verification/20261009_stage2a_preflight.sql');
const validation = await read('../verification/20261009_stage2a_validation.sql');
import { uid, fixtureSQL } from './permission-fixture.mjs';
let assertions = 0;
function eq(a,b) { assert.deepEqual(a,b); assertions++; }
const db = new PGlite();
async function rows(sql) { return (await db.query(sql)).rows; }
async function rejected(sql, code) {
  await assert.rejects(db.exec(sql), e => e.code === code); assertions++;
  await db.exec('rollback');
}
async function user(id, sql, error, role='authenticated') {
  await db.exec(`begin; set local role ${role};
    select set_config('request.jwt.claim.sub','${id ? uid(id) : ''}',true);
    select set_config('request.jwt.claim.role','${role}',true);`);
  if (error) return rejected(`${sql}; commit;`, error);
  try { await db.exec(`${sql}; commit;`); } catch(e) { await db.exec('rollback'); throw e; }
}
async function invariant() {
  eq(await rows(`select id from profiles p where is_admin is distinct from (role='admin')
    or (select count(*) from profile_operational_roles m where m.profile_id=p.id) <> case when role='admin' then 0 else 1 end
    or exists (select 1 from profile_operational_roles m where m.profile_id=p.id and m.role_code<>p.role)`), []);
}


try {
  await db.exec(fixtureSQL);
  await db.exec(stage1);
  const baseline = await rows('select to_jsonb(p) as row from profiles p order by id');
  const assignmentBaseline = await rows('select * from trip_sheet_assignments');
  const authBaseline = await rows('select * from auth.users order by id');
  const policyBaseline = await rows('select * from pg_policies order by tablename,policyname');
  const grantsBefore = await rows("select privilege_type from information_schema.role_table_grants where table_name='profiles' and grantee='authenticated' and privilege_type<>'TRUNCATE' order by 1");
  await rejected(bridge,'P0001');
  await db.exec(truncate);
  eq(await rows("select privilege_type from information_schema.role_table_grants where table_name='profiles' and grantee='authenticated' and privilege_type<>'TRUNCATE' order by 1"), grantsBefore);
  // PUBLIC inheritance is not silently revoked by the narrow correction.
  await db.exec('grant truncate on profiles to public');
  await rejected(truncate,'P0001');
  await db.exec('revoke truncate on profiles from public');
  await db.exec(bridge);
  await db.exec(bridge);
  eq(await rows('select to_jsonb(p) as row from profiles p order by id'),baseline);
  eq(await rows('select * from pg_policies order by tablename,policyname'),policyBaseline);
  await db.exec('begin read only');
  const report = await db.exec(preflight);
  eq(report.length,1);
  eq(report[0].rows[0].stage2a_preflight.permission_drift,0);
  eq(report[0].rows[0].stage2a_preflight.membership_drift,0);
  const validated = await db.exec(validation);
  eq(validated.length,1);
  eq(validated[0].rows.filter(r=>r.status==='FAIL'),[]);
  await db.exec('rollback');
  for (const [id,role] of [[5,'admin'],[6,'facilitator'],[7,'expert']]) {
    // EXACT legacy create shape, including omitted is_admin and no membership calls.
    await user(0,`insert into profiles(id,full_name,email,role,is_active) values ('${uid(id)}','Created','${id}@example.test','${role}',true)`,null,'service_role');
    eq(await rows(`select role,is_admin from profiles where id='${uid(id)}'`),[{role,is_admin:role==='admin'}]);
    await invariant();
  }
  for (const role of ['expert','admin','facilitator']) {
    await user(1,`update profiles set role='${role}' where id='${uid(2)}'`);
    eq(await rows(`select role,is_admin from profiles where id='${uid(2)}'`),[{role,is_admin:role==='admin'}]);
    await invariant();
  }
  await user(1,`update profiles set role='expert' where id='${uid(5)}'`);
  await user(1,`update profiles set role='facilitator' where id='${uid(1)}'`,'23514');
  await user(1,`update profiles set is_active=false where id='${uid(1)}'`,'23514');
  await user(0,`update profiles set is_active=false where id='${uid(1)}'`,'23514','service_role');
  await rejected(`begin; delete from auth.users where id='${uid(1)}'; commit;`,'42501');
  // Two-admin self-demotion works, then the remaining admin is protected.
  await user(1,`update profiles set role='admin' where id='${uid(5)}'`);
  await user(1,`update profiles set role='expert' where id='${uid(1)}'`);
  await user(5,`update profiles set is_active=false where id='${uid(5)}'`,'23514');
  await user(5,`update profiles set role='admin' where id='${uid(1)}'`);
  await user(1,`update profiles set is_active=false where role='admin' and is_active`,'23514');
  await user(1,`update profiles set is_active=false where id='${uid(5)}'`);
  await user(1,`update profiles set is_active=false where id='${uid(2)}'`);
  await invariant();
  eq(await rows(`select role_code from profile_operational_roles where profile_id='${uid(2)}'`),[{role_code:'facilitator'}]);
  await user(1,`update profiles set is_active=true where id='${uid(2)}'`);
  // Force permissive RLS to prove trigger protection is independent of live policy guesses.
  await db.exec(`create policy adversarial_updates on profiles for update to authenticated using(true) with check(true);
    create policy adversarial_inserts on profiles for insert to authenticated with check(true);
    create policy adversarial_read on profiles for select to authenticated using(true);`);
  for (const actor of [2,4,5,8]) {
    await user(actor,`update profiles set role='admin' where id='${uid(2)}'`,'42501');
    await user(actor,`update profiles set is_admin=true where id='${uid(2)}'`,'42501');
    await user(actor,`update profiles set is_active=true where id='${uid(5)}'`,'42501');
    await user(actor,`insert into profiles(id,full_name,email,role) values ('${uid(8)}','Bad','bad@example.test','admin')`,'42501');
  }
  await user(2,`insert into profile_operational_roles values ('${uid(2)}','expert')`,'42501');
  await user(2,`delete from profile_operational_roles where profile_id='${uid(2)}'`); // RLS filters all rows.
  await invariant();
  await user(1,`insert into profile_operational_roles values ('${uid(2)}','expert')`,'23514');
  await user(1,`delete from profile_operational_roles where profile_id='${uid(2)}'`,'23514');
  await user(1,`update profile_operational_roles set role_code='expert' where profile_id='${uid(2)}'`,'23514');
  await user(1,`update profiles set is_admin=true where id='${uid(2)}'`,'23514');
  await user(1,`update profiles set id='${uid(8)}' where id='${uid(2)}'`,'42501');
  await user(1,`update profiles set role='resource' where id='${uid(2)}'`,'23514');
  await user(1,`truncate profiles`,'42501');
  await user(0,`insert into profiles(id,full_name,email,role) values ('${uid(8)}','Bad','bad@example.test','admin')`,'42501','anon');
  // Membership failure must roll back the profile role and other ordinary fields.
  await db.exec(`create function fixture_fail_membership() returns trigger language plpgsql as $$ begin raise exception 'fixture membership failure'; end $$;
    create trigger fixture_fail before insert on profile_operational_roles for each row execute function fixture_fail_membership();`);
  const beforeFailure = await rows('select to_jsonb(p) as row from profiles p order by id');
  await user(1,`update profiles set role='expert',phone='new' where id='${uid(2)}'`,'P0001');
  await user(0,`insert into profiles(id,full_name,email,role) values ('${uid(8)}','Recovery','recovery@example.test','expert')`,'P0001','service_role');
  eq(await rows('select to_jsonb(p) as row from profiles p order by id'),beforeFailure);
  eq(await rows(`select id from auth.users where id='${uid(8)}'`),[{id:uid(8)}]);
  await db.exec('drop trigger fixture_fail on profile_operational_roles');
  await invariant();
  eq(await rows('select * from trip_sheet_assignments'),assignmentBaseline);
  eq(await rows('select * from auth.users order by id'),authBaseline);
  // Backfill-free rerun, helpers and timestamp trigger still intact.
  const beforeRerun = await rows('select to_jsonb(p) as row from profiles p order by id');
  await db.exec(bridge);
  eq(await rows('select to_jsonb(p) as row from profiles p order by id'),beforeRerun);
  await user(1,`do $$ begin if not public.is_admin() or not multi_role_private.is_stage1_admin() then raise exception 'compatibility broken'; end if; end $$`);
  await user(2,`do $$ begin if public.is_admin() or multi_role_private.is_stage1_admin() then raise exception 'privilege escalation'; end if; end $$`);
  eq((await rows("select count(*)::int as n from pg_trigger where tgname='set_profiles_updated_at' and tgenabled='O'")),[{n:1}]);

} finally { await db.close(); }

// Existing drift must abort installation without rewriting profiles or memberships.
for (const scenario of ['permission','membership','no_active_admin','unsupported_role']) {
  const isolated=new PGlite();
  try {
    await isolated.exec(fixtureSQL);
    await isolated.exec(stage1);
    await isolated.exec(truncate);
    const drift={
      permission:`update profiles set is_admin=false where id='${uid(1)}'`,
      membership:`insert into profile_operational_roles values ('${uid(1)}','expert')`,
      no_active_admin:`update profiles set is_active=false where role='admin'`,
      unsupported_role:`update profiles set role='resource' where id='${uid(2)}'`
    }[scenario];
    await isolated.exec(drift);
    const before=(await isolated.query('select to_jsonb(p) as row from profiles p order by id')).rows;
    const members=(await isolated.query('select * from profile_operational_roles order by profile_id,role_code')).rows;
    await assert.rejects(isolated.exec(bridge),e=>e.code==='P0001'); assertions++;
    await isolated.exec('rollback');
    eq((await isolated.query('select to_jsonb(p) as row from profiles p order by id')).rows,before);
    eq((await isolated.query('select * from profile_operational_roles order by profile_id,role_code')).rows,members);
    eq((await isolated.query("select to_regclass('multi_role_private.stage2a_write_lock') as object")).rows,[{object:null}]);
  } finally { await isolated.close(); }
}
console.log(`PASS: Stage 2A ${assertions} assertions (single-session PostgreSQL; live concurrency remains a deployment gate).`);
