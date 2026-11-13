import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import * as jsx from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'

async function load(path, dependencies = {}, globals = {}) {
  const exports = {}
  const code = ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  vm.runInNewContext(code, { exports, URLSearchParams, FormData, ...globals, require(name) {
    if (!(name in dependencies)) throw Error(`Unexpected import: ${name}`)
    return dependencies[name]
  } })
  return exports
}
const time = await load('../lib/time.ts')
const helpers = await load('../app/dashboard/trips/[id]/trip-detail-presentation.ts', { '@/lib/time': time })
const Link = ({ children, ...props }) => React.createElement('a', props, children)
const Null = () => null
const sheets = [
  { id: 'multi', trip_id: 'trip', title: 'Multi-day', start_date: '2026-11-13', start_time: '09:00', end_date: '2026-11-15', end_time: '17:00', updated_at: null },
  { id: 'late', trip_id: 'trip', title: 'Lunch', start_date: '2026-11-12', start_time: '13:00', end_date: '2026-11-12', end_time: '14:00', updated_at: null },
  { id: 'early', trip_id: 'trip', title: 'Pickup', start_date: '2026-11-12', start_time: '08:00', end_date: '2026-11-12', end_time: '09:00', updated_at: null },
  { id: 'undated', trip_id: 'trip', title: 'Date TBD', start_date: null, start_time: null, end_date: null, end_time: null, updated_at: null },
]
const grouped = helpers.groupTripSheetsByStartDate(sheets)
assert.deepEqual(Array.from(grouped, group => group.date), ['2026-11-12', '2026-11-13', null])
assert.deepEqual(Array.from(grouped[0].rows, sheet => sheet.id), ['early', 'late'])
assert.equal(grouped.flatMap(group => group.rows).filter(sheet => sheet.id === 'multi').length, 1)
assert.equal(helpers.formatTripSheetDay('2026-11-12'), 'Thursday, 12 November 2026')
assert.equal(helpers.getTripDetailTab({}), 'trip-sheets')
for (const query of [{ tab: 'tasks' }, { task: 'task' }, { newTask: '1' }, { tab: 'trip-sheets', task: 'task' }]) assert.equal(helpers.getTripDetailTab(query), 'tasks')
assert.equal(helpers.getTripDetailTab({ tab: 'invalid' }), 'trip-sheets')
const taskLink = helpers.tripDetailTabHref('trip', { task: 'task', newTask: '1', success: 'ok' }, 'tasks')
assert(taskLink.includes('task=task') && taskLink.includes('newTask=1') && taskLink.includes('success=ok'))
const sheetsLink = helpers.tripDetailTabHref('trip', { task: 'task', newTask: '1' }, 'trip-sheets')
assert(!sheetsLink.includes('task=') && !sheetsLink.includes('newTask='))
assert.equal(helpers.getTripDetailTab(Object.fromEntries(new URL(taskLink, 'https://test').searchParams)), 'tasks')
const Grouped = (await load('../app/dashboard/trips/[id]/GroupedTripSheets.tsx', {
  'react/jsx-runtime': jsx, 'next/link': { default: Link }, '@/lib/time': time,
  './trip-detail-presentation': helpers,
  './TripSheetActionsMenu': { default: Null },
})).default
const html = renderToStaticMarkup(React.createElement(Grouped, { trip: { id: 'trip' }, tripSheets: sheets.map(sheet => ({ ...sheet, assignedUsers: [] })), selectedIds: new Set(), onSelect() {}, collapsedDays: new Set(), onDayToggle() {}, pending: false }))
assert.equal((html.match(/<details open=""/g) || []).length, 3)
assert.equal((html.match(/data-bulk-row/g) || []).length, 4)
assert(html.includes('15 Nov 2026') && html.includes('/trip-sheets/multi'))
assert(html.includes('Unassigned') && html.includes('bg-amber-50'))
assert(!html.includes('<table') && !html.includes('Updated') && !html.includes('<thead'))
assert(html.includes('13 Nov 2026, 9:00 AM → 15 Nov 2026, 5:00 PM'))
assert(html.includes('Thursday, 12 November 2026') && html.includes('2 Trip Sheets'))

// Controlled selection/search are covered by trip-sheet-operations.mjs.
const Bulk = () => null

// The opt-in task refresh updates the page badge only after a successful save.
let refreshed = 0, result = { ok: true }, completion = false, stateCalls = 0, stateValues = []
const Row = (await load('../app/tasks/TaskTableRow.tsx', {
  'react/jsx-runtime': jsx, 'next/link': { default: Link }, 'next/navigation': { useRouter: () => ({ refresh() { refreshed++ } }) },
  react: {
    useRef: () => ({ current: false }),
    useState: initial => { const index = stateCalls++; return [index === 0 ? completion : initial, value => { stateValues.push(value); if (index === 0) completion = value }] },
  },
  '@/lib/trip-tasks': await load('../lib/trip-tasks.ts'), './actions': { setTripTaskStatus: async () => result }, './TaskStatusBadge': { default: Null },
})).default
function nodes(node) { return !node || typeof node !== 'object' ? [] : [node, ...React.Children.toArray(node.props?.children).flatMap(nodes)] }
for (const refresh of [false, true]) {
  stateCalls = 0
  const checkbox = nodes(Row({ task: { id: 'task', title: 'Task', trip_id: 'trip', status: 'pending' }, detailHref: '/task', refreshOnStatusChange: refresh })).find(node => node.type === 'input')
  await checkbox.props.onChange({ currentTarget: { checked: true } })
  assert.equal(refreshed, refresh ? 1 : 0)
}
stateCalls = 0; result = { ok: false, error: 'Denied' }; completion = false
const failed = nodes(Row({ task: { id: 'task', title: 'Task', status: 'pending' }, detailHref: '/task', refreshOnStatusChange: true })).find(node => node.type === 'input')
await failed.props.onChange({ currentTarget: { checked: true } })
assert.equal(refreshed, 1)
assert.equal(completion, false)
assert(stateValues.includes('Denied'))

const TripHeader = (await load('../app/dashboard/trips/[id]/TripHeader.tsx', { 'react/jsx-runtime': jsx })).default
const taskHelpers = await load('../lib/trip-tasks.ts')
const roles = await load('../lib/roles.ts')
const tripHelpers = await load('../lib/trip-sheets.ts')
let authorized = true, queryLog = []
const task = { id: 'task', title: 'Task', status: 'pending', due_at: '2000-01-01T00:00:00Z' }
const TaskList = () => null, TaskPanel = () => null
const page = (await load('../app/dashboard/trips/[id]/page.tsx', {
  'react/jsx-runtime': jsx, 'next/link': { default: Link }, 'next/navigation': { redirect() { throw Error('redirect') } },
  '@/app/dashboard/AdminNav': { default: Null }, '@/lib/roles': roles,
  '@/app/dashboard/calendar/conflicts': { getConflictingTripSheetIds: () => new Set() },
  '@/lib/trip-colors': { getTripColorStyle: () => ({}) }, '@/lib/time': time, '@/lib/trip-tasks': taskHelpers,
  '@/app/tasks/TaskList': { default: TaskList }, '@/app/tasks/TaskDetailPanel': { default: TaskPanel },
  '@/lib/trip-sheets': tripHelpers, '@/lib/trip-workflow': await load('../lib/trip-workflow.ts'),
  '../SendTripNotificationButton': { default: Null }, './DownloadTripPdfButton': { default: Null },
  './BulkTripSheetAssignmentForm': { default: Bulk }, './TripHeader': { default: TripHeader }, './GroupedTripSheets': { default: Grouped },
  './trip-detail-presentation': helpers,
  '../../lib': { requireAdmin: async () => {
    if (!authorized) throw Error('denied')
    return { profile: { is_active: true, is_admin: true }, supabase: { from(table) {
      const log = { table, filters: [] }; queryLog.push(log)
      const q = {
        select() { return q }, eq(key, value) { log.filters.push([key, value]); return q }, order() { return q },
        in() { return q }, limit() { return q }, maybeSingle() { return Promise.resolve(result()) },
        then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject) },
      }
      function result() {
        return { data: table === 'trips' ? { id: 'trip', title: 'Trip', start_date: '2026-11-12', end_date: '2026-11-15', is_archived: false, workflow_state: 'active' }
          : table === 'trip_sheets' ? sheets : table === 'trip_tasks' ? [task] : table === 'trip_notifications' ? null : [] }
      }
      return q
    } } }
  } },
})).default
for (const query of [{}, { tab: 'tasks' }, { task: 'task' }, { newTask: '1' }]) {
  queryLog = []
  const tree = await page({ params: Promise.resolve({ id: 'trip' }), searchParams: Promise.resolve(query) })
  const elements = nodes(tree)
  const taskList = elements.find(node => node.type === TaskList)
  assert.equal(Boolean(taskList), helpers.getTripDetailTab(query) === 'tasks')
  if (taskList) assert.equal(taskList.props.refreshOnStatusChange, true)
  const panel = elements.find(node => node.type === TaskPanel)
  if (query.task || query.newTask) {
    assert(panel)
    assert.equal(panel.props.returnTo, '/dashboard/trips/trip?tab=tasks')
    assert.equal(panel.props.closeHref, '/dashboard/trips/trip?tab=tasks')
  }
  const primarySheetQuery = queryLog.find(log => log.table === 'trip_sheets')
  assert(!primarySheetQuery.filters.some(([key]) => key === 'is_archived'))
  assert(elements.some(node => React.Children.toArray(node.props?.children).some(child => typeof child === 'string' && child.includes('1 overdue'))))
}
authorized = false; queryLog = []
await assert.rejects(page({ params: Promise.resolve({ id: 'trip' }), searchParams: Promise.resolve({}) }), /denied/)
assert.equal(queryLog.length, 0)
// Preserve the existing server bulk-operation contracts without editing the action.
let assignmentRows, bulkWrites = []
const assignmentClient = { from(table) {
  let filters = [], operation = 'select', payload
  const q = {
    select() { return q }, eq(key, value) { filters.push(row => row[key] === value); return q },
    in(key, values) { filters.push(row => values.includes(row[key])); return q },
    insert(value) { operation = 'insert'; payload = value; return q },
    delete() { operation = 'delete'; return q },
    maybeSingle() { return Promise.resolve(result()) },
    then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject) },
  }
  function result() {
    if (table === 'profiles') return { data: { id: 'target', is_active: true, is_admin: true } }
    if (table === 'trip_sheets') return { data: ['s1', 's2', 's3'].map(id => ({ id, trip_id: 'trip' })).filter(row => filters.every(filter => filter(row))) }
    if (table === 'trip_sheet_assignments') {
      if (operation === 'delete') {
        bulkWrites.push('delete')
        assignmentRows = assignmentRows.filter(row => !filters.every(filter => filter(row)))
      } else if (operation === 'insert') {
        bulkWrites.push('insert')
        assignmentRows.push(...Array.from(payload, (row, index) => ({ ...row, id: `added-${index}` })))
      }
      return { data: assignmentRows.filter(row => filters.every(filter => filter(row))), error: null }
    }
    throw Error(table)
  }
  return q
} }
const tripActions = await load('../app/dashboard/trips/actions.ts', {
  'next/navigation': { redirect: path => { throw Object.assign(Error('redirect'), { path }) } },
  '@/app/lib/action-feedback': { appendToastParam: path => path }, '@/lib/roles': roles,
  '@/lib/trip-colors': {}, '@/lib/trip-date-validation': {}, '@/lib/trip-sheets': {},
  '@/lib/supabase/admin': {}, '@/lib/trip-workflow': {}, '../trip-sheets/validation': {}, '../trip-sheets/template-card-copy': {},
  '../lib': { requireAdmin: async () => ({ supabase: assignmentClient, user: { id: 'admin' } }) },
})
for (const [mode, replace] of [['assign_selected', false], ['assign_selected', true], ['assign_unassigned', false], ['clear_selected', false]]) {
  assignmentRows = [{ id: 'old', trip_sheet_id: 's1', resource_user_id: 'other' }, { id: 'kept', trip_sheet_id: 's2', resource_user_id: 'target' }]
  bulkWrites = []
  const form = new FormData()
  form.set('trip_id', 'trip'); form.set('resource_user_id', 'target'); form.set('action_type', mode)
  form.set('replace_existing', String(replace)); form.append('selected_trip_sheet_ids', 's1'); form.append('selected_trip_sheet_ids', 's2')
  await assert.rejects(tripActions.bulkAssignTripSheets(form), error => error.path === '/dashboard/trips/trip')
  if (mode === 'clear_selected') assert.equal(assignmentRows.length, 0)
  else if (mode === 'assign_unassigned') {
    assert(assignmentRows.some(row => row.trip_sheet_id === 's3' && row.resource_user_id === 'target'))
    assert(!assignmentRows.some(row => row.trip_sheet_id === 's1' && row.resource_user_id === 'target'))
  } else {
    assert(assignmentRows.some(row => row.trip_sheet_id === 's1' && row.resource_user_id === 'target'))
    assert.equal(assignmentRows.some(row => row.resource_user_id === 'other'), !replace)
    assert.equal(assignmentRows.filter(row => row.trip_sheet_id === 's2').length, 1)
  }
}
console.log('PASS: date grouping/sorting, multi-day uniqueness, URL tabs/deep links, opt-in task refresh/rollback, server guards and unchanged archive visibility.')
