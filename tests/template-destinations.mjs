import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import * as jsx from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'

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
const destination = '11111111-1111-1111-1111-111111111111'
const source = '22222222-2222-2222-2222-222222222222'
const newId = '33333333-3333-3333-3333-333333333333'
const sourceCard = { title: 'Card', category: 'expert', card_url: '/module-cards/example.html', sort_order: 4 }
let authorized, calls, options
function reset(settings = {}) { authorized = true; calls = []; options = settings }
const redirect = path => { throw Object.assign(Error('redirect'), { path }) }
const supabase = { from(table) {
  const call = { table, operation: 'select', filters: [] }
  calls.push(call)
  const query = {
    select(columns) { call.columns = columns; return query },
    insert(payload) { call.operation = 'insert'; call.payload = payload; return query },
    update(payload) { call.operation = 'update'; call.payload = payload; return query },
    delete() { call.operation = 'delete'; return query },
    eq(key, value) { call.filters.push([key, value]); return query },
    order() { return query },
    single() { return Promise.resolve(result()) },
    maybeSingle() { return Promise.resolve(result()) },
    then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject) },
  }
  function result() {
    if (table === 'destinations') return options.destinationFailure ? { data: null, error: { message: 'lookup failed' } }
      : { data: options.missingDestination ? null : call.filters.length ? { id: destination } : [{ id: destination, name: 'Goa' }] }
    if (table === 'trip_templates') {
      if (call.operation === 'insert') return { data: { id: newId }, error: options.insertError ? { message: 'insert failed' } : null }
      if (call.operation === 'delete') return { error: options.cleanupError ? { message: 'cleanup failed' } : null }
      if (call.operation === 'update') return { error: null }
      return { data: options.missingSource ? null : { id: source, title: 'Original', heading: 'Heading', body: '**Markdown**',
        default_start_time: '08:15:00', default_end_time: '17:30:00', destination_id: options.nullDestination ? null : destination,
        archived_at: '2026-11-01T00:00:00Z' } }
    }
    if (table === 'template_cards') return call.operation === 'insert'
      ? { error: options.cardWriteError ? { message: 'copy failed' } : null }
      : { data: options.noCards ? [] : [sourceCard], error: options.cardReadError ? { message: 'read failed' } : null }
    throw Error(`Unexpected table: ${table}`)
  }
  return query
} }
const requireAdmin = async () => { if (!authorized) throw Error('denied'); return { supabase, user: { id: 'admin' } } }
const validation = await load('../app/dashboard/templates/validation.ts')
const actions = await load('../app/dashboard/templates/actions.ts', {
  'next/cache': { revalidatePath() {} },
  'next/navigation': { redirect }, './lib': { requireAdmin }, './validation': validation,
  '@/app/lib/action-feedback': { appendToastParam: path => path },
})
function input(dest = destination, duplicate = false) {
  const form = new FormData()
  for (const [key, value] of Object.entries({ id: source, title: 'Original Copy', heading: 'Heading', body: '**Markdown**',
    default_start_time: '08:15', default_end_time: '17:30', destination_id: dest, archived_at: '2026-01-01' })) form.set(key, value)
  if (duplicate) form.set('duplicate_from', source)
  return form
}
async function run(action, form, pathPart) {
  await assert.rejects(action(form), error => error.path?.includes(pathPart))
}
for (const dest of [destination, '']) {
  reset()
  await run(actions.createTemplate, input(dest), '/dashboard/templates')
  const inserted = calls.find(call => call.table === 'trip_templates' && call.operation === 'insert').payload
  assert.equal(inserted.destination_id, dest || null)
  assert.equal(inserted.archived_at, null)
  assert.equal(inserted.body, '**Markdown**')
  assert.equal(inserted.default_start_time, '08:15')
  assert.equal(inserted.default_end_time, '17:30')
  assert(!calls.some(call => call.table === 'template_cards'))
  reset()
  await run(actions.updateTemplate, input(dest), '#template-details')
  const updated = calls.find(call => call.operation === 'update').payload
  assert.equal(updated.destination_id, dest || null)
  assert(!('archived_at' in updated))
  assert.equal(updated.body, '**Markdown**')
  assert(!calls.some(call => call.table === 'template_cards'))
  reset()
  await run(actions.createTemplate, input(dest, true), '/dashboard/templates')
  assert.equal(calls.find(call => call.table === 'trip_templates' && call.operation === 'insert').payload.destination_id, dest || null)
  assert.equal(calls.find(call => call.table === 'trip_templates' && call.operation === 'insert').payload.archived_at, null)
  const cards = calls.find(call => call.table === 'template_cards' && call.operation === 'insert').payload
  assert.deepEqual(JSON.parse(JSON.stringify(cards)), [{ ...sourceCard, template_id: newId }])
  assert(!calls.some(call => call.table === 'trip_sheets'))
}
for (const action of [actions.createTemplate, actions.updateTemplate]) {
  reset(); authorized = false
  await assert.rejects(action(input()), /denied/)
  assert.equal(calls.length, 0)
  reset()
  await run(action, input('invalid'), 'Select+a+valid+destination')
  assert(!calls.some(call => call.operation === 'insert' || call.operation === 'update'))
  reset({ missingDestination: true })
  await run(action, input(), 'Selected+destination+was+not+found')
  assert(!calls.some(call => call.operation === 'insert' || call.operation === 'update'))
}
reset({ cardReadError: true })
await run(actions.createTemplate, input(destination, true), 'duplicateFrom=')
assert(!calls.some(call => call.operation === 'insert'))
reset({ cardWriteError: true })
await run(actions.createTemplate, input(destination, true), 'copy+failed')
assert(calls.some(call => call.operation === 'delete' && call.filters.some(([key, value]) => key === 'id' && value === newId)))
reset({ cardWriteError: true, cleanupError: true })
await run(actions.createTemplate, input(destination, true), `${newId}/edit`)

const Null = () => null
const TemplateForm = (await load('../app/dashboard/templates/TemplateForm.tsx', {
  'react/jsx-runtime': jsx, './validation': validation,
  'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
  '@/app/components/ActionSubmitButton': { default: Null },
})).default
const newPage = (await load('../app/dashboard/templates/new/page.tsx', {
  'react/jsx-runtime': jsx, '@/app/dashboard/AdminNav': { default: Null }, '../actions': actions,
  '../lib': { requireAdmin }, '../TemplateForm': { default: TemplateForm },
})).default
const editPage = (await load('../app/dashboard/templates/[id]/edit/page.tsx', {
  'react/jsx-runtime': jsx, 'next/navigation': { redirect }, '@/app/dashboard/AdminNav': { default: Null },
  '../../TemplateCardsSection': { default: Null }, '../../TemplateForm': { default: TemplateForm },
  '../../actions': actions, '../../lib': { requireAdmin },
})).default
function findForm(element) {
  if (!element || typeof element !== 'object') return null
  if (element.type === TemplateForm) return element
  for (const child of React.Children.toArray(element.props?.children)) { const found = findForm(child); if (found) return found }
  return null
}
for (const nullDestination of [true, false]) {
  reset({ nullDestination })
  const form = findForm(await newPage({ searchParams: Promise.resolve({ duplicateFrom: source }) }))
  assert.equal(form.props.initialDestinationId, nullDestination ? '' : destination)
  assert.equal(form.props.duplicateFrom, source)
  assert.equal(form.props.initialBody, '**Markdown**')
  assert.equal(form.props.initialDefaultStartTime, '08:15')
  const html = renderToStaticMarkup(form)
  assert(html.includes('No destination'))
  assert(html.includes(`value="${nullDestination ? '' : destination}" selected=""`))
  reset({ nullDestination })
  const editForm = findForm(await editPage({ params: Promise.resolve({ id: source }), searchParams: Promise.resolve({}) }))
  assert.equal(editForm.props.initialDestinationId, nullDestination ? '' : destination)
  assert.equal(editForm.props.initialDefaultEndTime, '17:30')
}
reset({ destinationFailure: true })
assert.equal(findForm(await editPage({ params: Promise.resolve({ id: source }), searchParams: Promise.resolve({}) })), null)
const migration = await readFile(new URL('../sql/20261112_trip_templates_destination_archive.sql', import.meta.url), 'utf8')
assert(migration.includes('on delete restrict'))
assert(migration.includes('archived_at timestamptz'))
assert(migration.includes('idx_trip_templates_destination_id') && migration.includes('idx_trip_templates_archived_at'))
console.log('PASS: create/edit/duplicate destinations and nulls; saved form values; duplicate cards/defaults; unarchived copies; validation/authentication; copy error handling; migration source checks (SQL not executed).')
