// Disposable in-memory PostgreSQL only. Never accepts a database URL.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { fixtureSQL, uid } from './permission-fixture.mjs'

if (!process.argv[2]) throw new Error('Pass the local PGlite module path.')
const { PGlite } = await import(pathToFileURL(process.argv[2]).href)
const read = name => readFile(new URL(name, import.meta.url), 'utf8')
const stage1 = await read('../20261009_multi_role_foundation.sql')
const revoke = await read('../20261009_profiles_revoke_client_truncate.sql')
const stage2a = await read('../20261009_multi_role_compatibility_bridge.sql')
const stage2b = await read('../20261009_multi_role_authorization.sql')
const migration = await read('../20261010_trip_task_management.sql')
const rollback = await read('../20261010_trip_task_management_rollback.sql')
const validation = await read('../verification/20261010_trip_task_validation.sql')
const db = new PGlite()
let checks = 0
const rows = async sql => (await db.query(sql)).rows
const equal = (actual, expected) => { assert.deepEqual(actual, expected); checks++ }
async function user(actor, sql, errorCode = null) {
  await db.exec(`begin; set local role authenticated;
    select set_config('request.jwt.claim.sub','${uid(actor)}',true);
    select set_config('request.jwt.claim.role','authenticated',true);`)
  try {
    if (errorCode) { await assert.rejects(db.exec(sql), error => error.code === errorCode); checks++ }
    else await db.exec(`${sql}; commit;`)
  } finally { await db.exec('rollback') }
}
async function readAs(actor, sql) {
  await db.exec(`begin; set local role authenticated;
    select set_config('request.jwt.claim.sub','${uid(actor)}',true);
    select set_config('request.jwt.claim.role','authenticated',true);`)
  try { return (await db.query(sql)).rows } finally { await db.exec('rollback') }
}

const trip1 = uid(15), trip2 = uid(16), sheet1 = uid(17), sheet2 = uid(18), task1 = uid(19)
try {
  await db.exec(fixtureSQL)
  await db.exec(`create table trips(id uuid primary key,title text);
    create table trip_sheets(id uuid primary key,trip_id uuid references trips(id),title text);
    insert into trips values('${trip1}','First Trip'),('${trip2}','Second Trip');
    insert into trip_sheets values('${sheet1}','${trip1}','First Sheet'),('${sheet2}','${trip2}','Second Sheet');`)
  await db.exec(stage1); await db.exec(revoke); await db.exec(stage2a); await db.exec(stage2b)
  const assignments = await rows('select * from trip_sheet_assignments')
  await db.exec(migration)
  equal((await db.query(validation)).rows.filter(row => row.status === 'FAIL'), [])

  await user(1, `insert into trip_tasks(id,trip_id,trip_sheet_id,title,assigned_to,due_at,created_by)
    values('${task1}','${trip1}','${sheet1}','Pack equipment','${uid(2)}','2026-10-11 09:00+05:30','${uid(1)}')`)
  equal(await readAs(1, 'select id from trip_tasks'), [{ id:task1 }])
  equal(await readAs(2, 'select id from trip_tasks'), [{ id:task1 }])
  equal(await readAs(3, 'select id from trip_tasks'), [])
  equal(await rows(`select status,completed_by,completed_at is null as no_completed_at from trip_tasks where id='${task1}'`), [{ status:'pending', completed_by:null, no_completed_at:true }])
  await user(2, `update trip_tasks set status='completed' where id='${task1}'`)
  equal(await rows(`select status,completed_by,completed_at is not null as has_completed_at from trip_tasks where id='${task1}'`), [{ status:'completed', completed_by:uid(2), has_completed_at:true }])
  await user(2, `update trip_tasks set status='pending' where id='${task1}'`)
  equal(await rows(`select status,completed_by,completed_at from trip_tasks where id='${task1}'`), [{ status:'pending', completed_by:null, completed_at:null }])
  await user(2, `update trip_tasks set title='Escalated' where id='${task1}'`, '42501')
  await user(2, `update trip_tasks set assigned_to='${uid(3)}' where id='${task1}'`, '42501')
  await user(3, `update trip_tasks set status='completed' where id='${task1}'`)
  equal(await rows(`select status from trip_tasks where id='${task1}'`), [{ status:'pending' }])
  await user(2, `insert into trip_tasks(trip_id,title,created_by) values('${trip1}','Forbidden','${uid(2)}')`, '42501')
  await user(2, `delete from trip_tasks where id='${task1}'`)
  equal(await rows(`select count(*)::int as count from trip_tasks where id='${task1}'`), [{ count:1 }])
  await user(1, `insert into trip_tasks(trip_id,title,assigned_to,created_by) values('${trip1}','Inactive assignee','${uid(4)}','${uid(1)}')`, '23514')
  await user(1, `insert into trip_tasks(trip_id,trip_sheet_id,title,created_by) values('${trip1}','${sheet2}','Wrong parent','${uid(1)}')`, '23503')

  await user(2, `insert into trip_task_comments(task_id,author_id,body) values('${task1}','${uid(2)}','Ready to go')`)
  equal(await readAs(2, 'select body from trip_task_comments'), [{ body:'Ready to go' }])
  equal(await readAs(3, 'select body from trip_task_comments'), [])
  await user(3, `insert into trip_task_comments(task_id,author_id,body) values('${task1}','${uid(3)}','Not assigned')`, '42501')
  await user(2, `insert into trip_task_comments(task_id,author_id,body) values('${task1}','${uid(3)}','Forged author')`, '42501')
  await user(1, `update trip_task_comments set body='Edited' where task_id='${task1}'`, '42501')
  await user(1, `delete from trip_task_comments where task_id='${task1}'`, '42501')

  await user(1, `select set_profile_active('${uid(2)}',false)`)
  await user(2, `update trip_tasks set status='completed' where id='${task1}'`)
  equal(await rows(`select status from trip_tasks where id='${task1}'`), [{ status:'pending' }])
  await user(1, `select set_profile_active('${uid(2)}',true)`)
  await user(1, `update trip_tasks set title='Pack all equipment', assigned_to='${uid(3)}' where id='${task1}'`)
  equal(await rows(`select title,assigned_to from trip_tasks where id='${task1}'`), [{ title:'Pack all equipment', assigned_to:uid(3) }])

  const beforeRerun = await rows('select to_jsonb(t) as row from trip_tasks t')
  await db.exec(migration)
  equal(await rows('select to_jsonb(t) as row from trip_tasks t'), beforeRerun)
  equal(await rows('select * from trip_sheet_assignments'), assignments)
  await user(1, `delete from trip_tasks where id='${task1}'`)
  equal(await rows(`select count(*)::int as count from trip_task_comments where task_id='${task1}'`), [{ count:0 }])
  await db.exec(rollback)
  equal(await rows("select to_regclass('public.trip_tasks') as tasks, to_regclass('public.trip_task_comments') as comments"), [{ tasks:null, comments:null }])
  console.log(`PASS: ${checks} Trip Task database assertions; no live database connection used.`)
} catch (error) {
  console.error(error.stack ?? error, error.where ?? '')
  process.exitCode = 1
} finally { await db.close() }
