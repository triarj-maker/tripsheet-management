import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import ts from 'typescript'

const source = await readFile(new URL('../lib/trip-tasks.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const exports = {}
vm.runInNewContext(compiled, { exports, require() { throw new Error('Unexpected import') }, Intl, Date })
function load(code, dependencies = {}) {
  const moduleExports = {}
  vm.runInNewContext(code, {
    exports: moduleExports,
    require(name) {
      if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`)
      return dependencies[name]
    },
    FormData,
    URL,
    URLSearchParams,
  })
  return moduleExports
}

const base = { description: null, trip_id: 'trip', trip_sheet_id: null, assigned_to: 'user', completed_at: null, trip: null, trip_sheet: null, assignee: null }
const now = Date.parse('2026-10-10T06:30:00Z')
const tasks = [
  { ...base, id: 'completed', title: 'Completed', status: 'completed', due_at: '2026-10-09T06:30:00Z' },
  { ...base, id: 'undated', title: 'Undated', status: 'pending', due_at: null },
  { ...base, id: 'upcoming', title: 'Upcoming', status: 'pending', due_at: '2026-10-11T06:30:00Z' },
  { ...base, id: 'overdue', title: 'Overdue', status: 'pending', due_at: '2026-10-09T06:30:00Z' },
]
assert.deepEqual(Array.from(exports.sortTasks(tasks, now), task => task.id), ['overdue', 'upcoming', 'undated', 'completed'])
const grouped = exports.groupPersonalTasks(tasks, now)
assert.deepEqual(Array.from(grouped.overdue, task => task.id), ['overdue'])
assert.deepEqual(Array.from(grouped.upcoming, task => task.id), ['upcoming', 'undated'])
assert.deepEqual(Array.from(grouped.completed, task => task.id), ['completed'])
assert.equal(exports.isTaskOverdue(tasks[0], now), false)

const personalPage = await readFile(new URL('../app/my-tasks/page.tsx', import.meta.url), 'utf8')
assert.match(personalPage, /getTaskPageData\(supabase, \{ assignedTo: user\.id,/)
assert.match(personalPage, /isAdmin=\{isAdminRole\(profile\)\}/)
const actions = await readFile(new URL('../app/tasks/actions.ts', import.meta.url), 'utf8')
assert.match(actions, /requireAdmin\(\)/)
assert.match(actions, /requireAdminOrResource\(\)/)

const actionCode = ts.transpileModule(actions, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const plain = value => JSON.parse(JSON.stringify(value))
const writes = []
const revalidated = []
let updateResult = { data: { id: 'task' }, error: null }
const query = {
  update(payload) { writes.push(payload); return query },
  eq() { return query },
  select() { return query },
  async maybeSingle() { return updateResult },
}
const taskActions = load(actionCode, {
  'next/cache': { revalidatePath: (...args) => revalidated.push(args) },
  'next/navigation': { redirect: path => { throw Object.assign(new Error('redirect'), { path }) } },
  '@/app/dashboard/lib': {
    requireAdmin: async () => ({ supabase: { from: () => query }, user: { id: 'admin' } }),
    requireAdminOrResource: async () => ({ supabase: { from: () => query }, user: { id: 'admin' } }),
  },
  '@/app/lib/action-feedback': { appendToastParam: path => path },
})
const statusForm = status => { const form = new FormData(); form.set('id', 'task'); form.set('status', status); return form }
assert.deepEqual(plain(await taskActions.setTripTaskStatus(statusForm('completed'))), { ok: true, error: null, status: 'completed' })
assert.deepEqual(plain(writes.at(-1)), { status: 'completed' })
assert.deepEqual(plain(await taskActions.setTripTaskStatus(statusForm('pending'))), { ok: true, error: null, status: 'pending' })
assert.deepEqual(plain(writes.at(-1)), { status: 'pending' })
const inlineForm = statusForm('completed'); inlineForm.set('inline', 'true')
assert.deepEqual(plain(await taskActions.setTripTaskStatus(inlineForm)), { ok: true, error: null, status: 'completed' })
assert.equal(revalidated.length, 6)
updateResult = { data: null, error: { message: 'Denied' } }
assert.deepEqual(plain(await taskActions.setTripTaskStatus(statusForm('completed'))), { ok: false, error: 'Denied', status: 'completed' })
assert.equal(revalidated.length, 6)

const rowSource = await readFile(new URL('../app/tasks/TaskTableRow.tsx', import.meta.url), 'utf8')
assert.match(rowSource, /savingRef\.current/)
assert.match(rowSource, /disabled=\{saving\}/)
assert.match(rowSource, /setCompleted\(previousCompleted\)/)
const centralTasks = await readFile(new URL('../app/dashboard/tasks/page.tsx', import.meta.url), 'utf8')
const tripTasks = await readFile(new URL('../app/dashboard/trips/[id]/page.tsx', import.meta.url), 'utf8')
assert.match(centralTasks, /<TaskList /)
assert.match(tripTasks, /<TaskList /)
console.log('PASS: 22 task status, ordering, personal-scope, and inline-control assertions.')
