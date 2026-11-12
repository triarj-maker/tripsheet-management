import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import ts from 'typescript'

async function load(path, dependencies = {}) {
  const exports = {}
  const code = ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  vm.runInNewContext(code, { exports, FormData, URLSearchParams, require(name) {
    if (!(name in dependencies)) throw Error(`Unexpected import: ${name}`)
    return dependencies[name]
  } })
  return exports
}
const id = '11111111-1111-1111-1111-111111111111'
const redirect = path => { throw Object.assign(Error('redirect'), { path }) }
let authorized, template, queries, invalidations, errorMode, copied
function reset(archivedAt = null) {
  authorized = true; template = { id, archived_at: archivedAt }; queries = []; invalidations = []; errorMode = ''; copied = 0
}
const supabase = { from(table) {
  const call = { table, operation: 'select', filters: [] }
  queries.push(call)
  const query = {
    select() { return query },
    update(payload) { call.operation = 'update'; call.payload = payload; return query },
    insert(payload) { call.operation = 'insert'; call.payload = payload; return query },
    eq(key, value) { call.filters.push([key, value]); return query },
    is(key, value) { call.filters.push([key, value]); return query },
    order() { return query },
    single() { return Promise.resolve(result()) },
    maybeSingle() { return Promise.resolve(result()) },
    then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject) },
  }
  function result() {
    if (table === 'trip_templates') {
      if (call.operation === 'update') {
        if (errorMode === 'write') return { error: { message: 'write failed' } }
        if (call.filters.every(([key, value]) => template[key] === value)) Object.assign(template, call.payload)
        return { error: null }
      }
      if (errorMode === 'read') return { error: { message: 'read failed' }, data: null }
      return { data: template }
    }
    if (table === 'trips') return { data: { id: 'trip', start_date: '2026-11-01', end_date: '2026-11-30' } }
    if (table === 'trip_sheets' && call.operation === 'insert') return { data: { id: 'new-sheet', trip_id: 'trip', template_id: call.payload.template_id } }
    throw Error(`Unexpected access to ${table}`)
  }
  return query
} }
const requireAdmin = async () => { if (!authorized) throw Error('denied'); return { supabase, user: { id: 'admin' } } }
const cache = { revalidatePath: path => invalidations.push(path) }
const feedback = { appendToastParam: path => path }
const actions = await load('../app/dashboard/templates/actions.ts', {
  'next/navigation': { redirect }, 'next/cache': cache, './lib': { requireAdmin },
  './validation': await load('../app/dashboard/templates/validation.ts'), '@/app/lib/action-feedback': feedback,
})
const form = () => { const data = new FormData(); data.set('id', id); return data }
async function run(action, data, part = '/dashboard/templates') {
  await assert.rejects(action(data), error => error.path?.includes(part))
}
reset()
await run(actions.archiveTemplate, form())
assert(!Number.isNaN(Date.parse(template.archived_at)))
const originalTimestamp = template.archived_at
assert.deepEqual(JSON.parse(JSON.stringify(queries.find(query => query.operation === 'update').payload)), { archived_at: originalTimestamp })
assert(queries.every(query => query.table === 'trip_templates'))
assert(invalidations.includes('/dashboard/trip-sheets/new'))
queries = []
await run(actions.archiveTemplate, form())
assert.equal(template.archived_at, originalTimestamp)
assert(!queries.some(query => query.operation === 'update'))
await run(actions.restoreTemplate, form())
assert.equal(template.archived_at, null)
queries = []
await run(actions.restoreTemplate, form())
assert(!queries.some(query => query.operation === 'update'))
for (const action of [actions.archiveTemplate, actions.restoreTemplate]) {
  reset(); authorized = false
  await assert.rejects(action(form()), /denied/)
  assert.equal(queries.length, 0)
  reset(); template = null
  await run(action, form(), 'Template+not+found')
  assert(!queries.some(query => query.operation === 'update'))
  reset(); errorMode = 'read'
  await run(action, form(), 'read+failed')
}
reset(); errorMode = 'write'
await run(actions.archiveTemplate, form(), 'write+failed')
assert.equal(template.archived_at, null)

const dateValidation = await load('../lib/trip-date-validation.ts')
const sheetActions = await load('../app/dashboard/trip-sheets/actions.ts', {
  'next/navigation': { redirect }, 'next/cache': cache, './lib': { requireAdmin },
  '@/app/lib/action-feedback': feedback, '@/lib/trip-date-validation': dateValidation,
  '@/lib/roles': await load('../lib/roles.ts'), '@/lib/supabase/server': { createClient: async () => supabase },
  './trip-sheet-assignments': { insertTripSheetAssignments: async () => ({ error: null }) },
  './template-card-copy': { copyTemplateCardsToTripSheets: async () => { copied++; return { error: null } } },
})
function sheetForm(templateId = id) {
  const data = new FormData()
  for (const [key, value] of Object.entries({ trip_id: 'trip', title: 'Sheet', start_date: '2026-11-12', end_date: '2026-11-13', body: 'Body', template_id: templateId })) data.set(key, value)
  return data
}
reset('2026-11-01T00:00:00Z')
await run(sheetActions.createTripSheet, sheetForm(), 'template+is+archived')
assert(!queries.some(query => query.operation === 'insert'))
assert.equal(copied, 0)
reset(); template = null
await run(sheetActions.createTripSheet, sheetForm(), 'Template+not+found')
assert(!queries.some(query => query.operation === 'insert'))
for (const templateId of [id, '']) {
  reset()
  await run(sheetActions.createTripSheet, sheetForm(templateId), '/dashboard/trips/trip')
  assert.equal(queries.find(query => query.table === 'trip_sheets').payload.template_id, templateId || null)
  assert.equal(copied, templateId ? 1 : 0)
  assert(!queries.some(query => query.operation === 'update'))
}

// The sole creation picker excludes archived templates; edit queries retain
// historical references and template Edit/Duplicate do not add an archive filter.
const picker = await readFile(new URL('../app/dashboard/trip-sheets/new/page.tsx', import.meta.url), 'utf8')
assert(picker.includes(".is('archived_at', null)"))
for (const path of ['../app/dashboard/templates/new/page.tsx', '../app/dashboard/templates/[id]/edit/page.tsx', '../app/dashboard/trip-sheets/[id]/edit/page.tsx']) {
  assert(!(await readFile(new URL(path, import.meta.url), 'utf8')).includes(".is('archived_at', null)"))
}
// Listing rendering and menu controls are covered by template-listing.mjs.
reset()
const filteredForm = form()
filteredForm.set('return_to', '/dashboard/templates?status=all&q=Goa')
await run(actions.archiveTemplate, filteredForm, '/dashboard/templates?status=all&q=Goa')
reset()
filteredForm.set('return_to', 'https://example.invalid/redirect')
await run(actions.archiveTemplate, filteredForm, '/dashboard/templates')
console.log('PASS: archive/restore timestamps, idempotence, Admin gates, missing/error targets, timestamp-only writes, creation validation, active/blank templates, historical route access and safe listing return paths.')
