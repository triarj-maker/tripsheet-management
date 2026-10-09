// Local PostgreSQL only; accepts the PGlite module path, never a database URL.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { uid, fixtureSQL } from './permission-fixture.mjs';
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const read = name => readFile(new URL(name,import.meta.url),'utf8');
const stage1=await read('../20261009_multi_role_foundation.sql');
const stage2a=await read('../20261009_multi_role_compatibility_bridge.sql');
const revoke=await read('../20261009_profiles_revoke_client_truncate.sql');
const migration=await read('../20261009_multi_role_authorization.sql');
const validation=await read('../verification/20261009_stage2b_validation.sql');
const db=new PGlite();
let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const rows=async sql=>(await db.query(sql)).rows;
async function user(actor,sql,code) {
  await db.exec(`begin; set local role authenticated;
    select set_config('request.jwt.claim.sub','${uid(actor)}',true);
    select set_config('request.jwt.claim.role','authenticated',true);`);
  try {
    if(code) {await assert.rejects(db.exec(`${sql}; commit;`),e=>e.code===code);checks++;}
    else await db.exec(`${sql}; commit;`);
  } finally {await db.exec('rollback');}
}
const save=(id,admin,roles,active=true,email=null)=>`select public.save_profile_permissions('${uid(id)}','User ${id}',null,${admin},array[${roles.map(r=>`'${r}'`).join(',')}]::text[],${active},${email?`'${email}'`:'null'})`;
try {
  await db.exec(fixtureSQL);
  await db.exec(stage1);await db.exec(revoke);await db.exec(stage2a);
  // Representative inline policy; include unrelated predicates that must survive.
  await db.exec(`create table policy_probe(id int,visible boolean);
    alter table policy_probe enable row level security;
    grant select,insert on policy_probe to authenticated;
    create policy legacy_admin on policy_probe for insert to authenticated with check(
      visible and exists(select 1 from public.profiles where profiles.id=auth.uid() and profiles.role='admin'));
    create policy own_scope on policy_probe for select to authenticated using(visible);`);
  const before=await rows('select to_jsonb(p) as row from profiles p order by id');
  const assignments=await rows('select * from trip_sheet_assignments');
  const rlsBefore=await rows("select oid::regclass::text as name,relrowsecurity from pg_class where oid in ('profiles'::regclass,'trip_sheet_assignments'::regclass,'policy_probe'::regclass) order by oid");
  const identities=await rows('select * from auth.users order by id');
  const helperIdentity=await rows("select oid::text as oid,proowner::text as owner,proacl::text as grants from pg_proc where oid='public.is_active_resource(uuid)'::regprocedure");
  await db.exec(migration);
  await db.exec('begin read only');
  eq((await db.query(validation)).rows.filter(r=>r.status==='FAIL'),[]);
  await db.exec('rollback');
  const activeResourceDefinition=(await rows("select pg_get_functiondef('public.is_active_resource(uuid)'::regprocedure) as definition"))[0].definition;
  assert(activeResourceDefinition.includes('profile_operational_roles') && !activeResourceDefinition.includes("role = 'resource'"));checks++;
  eq(await rows("select oid::text as oid,proowner::text as owner,proacl::text as grants from pg_proc where oid='public.is_active_resource(uuid)'::regprocedure"),helperIdentity);
  eq(await rows("select proargnames from pg_proc where oid='public.is_active_resource(uuid)'::regprocedure"),[{proargnames:['p_profile_id']}]);
  eq(await rows(`select public.is_active_resource('${uid(1)}') as allowed, public.is_active_resource('${uid(2)}') as operational`),
    [{allowed:false,operational:true}]);
  eq(await rows("select oid::regclass::text as name,relrowsecurity from pg_class where oid in ('profiles'::regclass,'trip_sheet_assignments'::regclass,'policy_probe'::regclass) order by oid"),rlsBefore);
  eq(await rows('select to_jsonb(p) as row from profiles p order by id'),before);
  const policy=(await rows("select with_check from pg_policies where policyname='legacy_admin'"))[0].with_check;
  assert(policy.includes('visible') && policy.includes('is_admin') && !policy.includes('.role'));checks++;
  await user(1,"insert into policy_probe values(1,true)");
  await user(2,"insert into policy_probe values(2,true)",'42501');
  await user(1,"insert into policy_probe values(3,false)",'42501');
  const combinations=[[true,[]],[false,['facilitator']],[false,['expert']],
    [false,['facilitator','expert']],[true,['facilitator']],[true,['expert']],[true,['facilitator','expert']]];
  for(const [index,[admin,roles]] of combinations.entries()) {
    const id=index+5;
    await user(1,save(id,admin,roles,true,`${id}@example.test`));
    eq(await rows(`select is_admin,is_active from profiles where id='${uid(id)}'`),[{is_admin:admin,is_active:true}]);
    eq((await rows(`select role_code from profile_operational_roles where profile_id='${uid(id)}' order by role_code`)).map(r=>r.role_code),[...roles].sort());
    await user(id,`do $$ begin if public.is_admin() is distinct from ${admin} or multi_role_private.is_stage1_admin() is distinct from ${admin} then raise exception 'wrong authorization'; end if; end $$`);
    eq(await rows(`select public.is_active_resource('${uid(id)}') as allowed`),[{allowed:roles.length>0}]);
  }
  // Duplicate inputs collapse to one membership per operational role.
  await user(1,save(11,true,['facilitator','facilitator','expert']));
  eq((await rows(`select role_code from profile_operational_roles where profile_id='${uid(11)}' order by role_code`)).map(r=>r.role_code),['expert','facilitator']);
  await user(1,`select set_profile_active('${uid(11)}',false)`);
  await user(11,save(2,true,[]),'42501');
  await user(1,`select set_profile_active('${uid(11)}',true)`);
  await user(1,save(11,false,['expert']));
  // Add a role, then edit ordinary fields without changing the selected roles.
  await user(1,save(11,false,['facilitator','expert']));
  eq((await rows(`select role_code from profile_operational_roles where profile_id='${uid(11)}' order by role_code`)).map(r=>r.role_code),['expert','facilitator']);
  await user(1,`select public.save_profile_permissions('${uid(11)}','Renamed User','555',false,array['facilitator','expert']::text[],true,null)`);
  eq(await rows(`select full_name,phone from profiles where id='${uid(11)}'`),[{full_name:'Renamed User',phone:'555'}]);
  eq((await rows(`select role_code from profile_operational_roles where profile_id='${uid(11)}' order by role_code`)).map(r=>r.role_code),['expert','facilitator']);
  // Remove one role while preserving the identity and any unrelated records.
  await user(1,save(11,false,['expert']));
  eq(await rows(`select is_admin from profiles where id='${uid(11)}'`),[{is_admin:false}]);
  eq(await rows(`select role_code from profile_operational_roles where profile_id='${uid(11)}'`),[{role_code:'expert'}]);
  // Missing/inactive/non-admin users cannot use either RPC or direct writes.
  for(const actor of [2,4,20]) {
    await user(actor,save(2,true,[]),'42501');
    await user(actor,`select set_profile_active('${uid(4)}',true)`,'42501');
    await user(actor,save(2,true,[]),'42501');
  }
  await user(1,`update profiles set role='admin' where id='${uid(2)}'`,'42501');
  await user(1,`update profiles set is_admin=true where id='${uid(2)}'`,'42501');
  await user(1,`delete from profile_operational_roles where profile_id='${uid(2)}'`,'42501');
  await user(2,`insert into profile_operational_roles values('${uid(2)}','expert')`,'42501');
  await user(1,`insert into multi_role_private.permission_write_scope values(txid_current(),'${uid(2)}')`,'42501');
  await user(1,save(2,false,[]),'23514');
  await user(1,save(2,false,['guide']),'23514');
  await user(1,save(2,false,['facilitator'],true,'exists@example.test'),'23505');
  await user(1,save(19,false,['facilitator']),'P0002');
  // Demote all additional admins, leaving only the original active admin.
  for(const id of [5,9,10]) await user(1,save(id,false,['facilitator']));
  await user(1,save(1,false,['expert']),'23514');
  await user(1,`select set_profile_active('${uid(1)}',false)`,'23514');
  // Allow inactive accounts to retain permissions or have no operational role.
  await user(1,save(2,false,[],false));
  await user(1,`select set_profile_active('${uid(2)}',true)`,'23514');
  await user(1,save(2,false,['expert']));
  // Failure midway rolls back profile fields, flags and memberships together.
  await db.exec(`create function fixture_fail() returns trigger language plpgsql as $$ begin raise exception 'membership failure'; end $$;
    create trigger fixture_fail before insert on profile_operational_roles for each row execute function fixture_fail();`);
  const profileBefore=await rows(`select to_jsonb(p) as row from profiles p where id='${uid(2)}'`);
  await user(1,save(2,true,['facilitator']),'P0001');
  eq(await rows(`select to_jsonb(p) as row from profiles p where id='${uid(2)}'`),profileBefore);
  await db.exec('drop trigger fixture_fail on profile_operational_roles');
  eq(await rows('select * from multi_role_private.permission_write_scope'),[]);
  await db.exec('begin read only');
  eq((await db.query(validation)).rows.filter(r=>r.status==='FAIL'),[]);
  await db.exec('rollback');
  const rerun=await rows('select to_jsonb(p) as row from profiles p order by id');
  await db.exec(migration);
  eq(await rows('select to_jsonb(p) as row from profiles p order by id'),rerun);
  eq(await rows(`select public.is_active_resource('${uid(11)}') as allowed`),[{allowed:true}]);
  eq(await rows("select to_regprocedure('public.save_team_profile(uuid,text,text,text,boolean,text)') as function"),[{function:null}]);
  eq(await rows('select * from trip_sheet_assignments'),assignments);
  eq(await rows('select * from auth.users order by id'),identities);
  // Unknown legacy policies must abort and leave the prior implementation intact.
  await db.exec(`create policy unknown_legacy on policy_probe for select using(exists(select 1 from profiles p where p.id=auth.uid() and p.role='admin'));`);
  await assert.rejects(db.exec(migration),e=>e.code==='P0001' && e.message.includes('Unrecognized legacy'));checks++;
  await db.exec('rollback');
  console.log(`PASS: ${checks} Stage 2B database assertions.`);
} catch(error) { console.error(error.code,error.message,error.where ?? ''); process.exitCode=1; } finally {await db.close();}
