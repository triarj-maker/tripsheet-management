import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import * as jsx from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import { isRedirectError } from 'next/dist/client/components/redirect-error.js'
import { getRedirectError, getURLFromRedirectError } from 'next/dist/client/components/redirect.js'

async function load(path, dependencies = {}, globals = {}) {
  const exports = {}
  const code = ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  vm.runInNewContext(code, { exports, URL, URLSearchParams, FormData, ...globals, require(name) {
    if (!(name in dependencies)) throw Error(`Unexpected import: ${name}`)
    return dependencies[name]
  } })
  return exports
}
const plain = value => JSON.parse(JSON.stringify(value))
const time = await load('../lib/time.ts')
const helpers = await load('../app/dashboard/trips/[id]/trip-detail-presentation.ts', { '@/lib/time': time })
const sheet = (id, title, date, users = []) => ({ id, title, start_date: date, start_time: '09:00', end_date: date, end_time: '10:00', updated_at: null,
  assignedUsers: users.map(label => ({ resourceUserId: label, label })) })
const sheets = [sheet('b', 'Lunch', '2026-11-13'), sheet('a', 'Pick-up', '2026-11-12', ['Inactive Guide']), sheet('c', 'Fort', '2026-11-12', ['Expert'])]
assert.deepEqual(Array.from(helpers.filterOperationalTripSheets(sheets, '  PICK-UP '), row => row.id), ['a'])
assert.deepEqual(Array.from(helpers.filterOperationalTripSheets(sheets, 'inactive GUIDE'), row => row.id), ['a'])
assert.equal(helpers.filterOperationalTripSheets(sheets, 'missing').length, 0)
assert.deepEqual(Array.from(helpers.groupTripSheetsByStartDate(helpers.filterOperationalTripSheets(sheets, '')), group => group.date), ['2026-11-12', '2026-11-13'])
let selected = helpers.updateTripSheetSelection(new Set(['outside']), ['a', 'b'], true)
assert.deepEqual(Array.from(selected), ['outside', 'a', 'b'])
assert.equal(helpers.matchingTripSheetSelection(selected, ['a', 'b']).checked, true)
selected = helpers.updateTripSheetSelection(selected, ['a', 'b'], false)
assert.deepEqual(Array.from(selected), ['outside'])
assert.equal(helpers.matchingTripSheetSelection(new Set(['a']), ['a', 'b']).indeterminate, true)

// Adapt real framework redirects without intercepting login/other framework flows.
let response = '/dashboard/trips/trip?toast=Assigned', backendFailure = null, backendCalls = 0
const adapter = await load('../app/dashboard/trips/[id]/bulk-assignment-submit.ts', {
  'next/dist/client/components/redirect-error': { isRedirectError },
  'next/dist/client/components/redirect': { getURLFromRedirectError },
  '../actions': { bulkAssignTripSheets: async () => { backendCalls++; if (backendFailure) throw backendFailure; throw getRedirectError(response, 'push') } },
})
const data = new FormData(); data.set('trip_id', 'trip')
assert.equal((await adapter.submitBulkTripSheetAssignments(data)).ok, true)
response = '/dashboard/trips/trip?error=Choose+a+resource'
assert.deepEqual(plain(await adapter.submitBulkTripSheetAssignments(data)), { ok: false, error: 'Choose a resource', redirectTo: response })
response = '/login?error=inactive'
await assert.rejects(adapter.submitBulkTripSheetAssignments(data), isRedirectError)
backendFailure = Error('Network failure')
await assert.rejects(adapter.submitBulkTripSheetAssignments(data), /Network failure/)
assert.equal(backendCalls, 4)

const Null = () => null
const Link = ({ children, ...props }) => React.createElement('a', props, children)
const MenuStub = () => null
const Grouped = (await load('../app/dashboard/trips/[id]/GroupedTripSheets.tsx', {
  'react/jsx-runtime': jsx, 'next/link': { default: Link }, '@/lib/time': time,
  './trip-detail-presentation': helpers, './TripSheetActionsMenu': { default: MenuStub },
})).default
let state = [], cursor = 0, effects = []
const hooks = {
  useState(initial) { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], next => { state[index] = typeof next === 'function' ? next(state[index]) : next }] },
  useRef(initial) { const index = cursor++; if (!(index in state)) state[index] = { current: initial }; return state[index] },
  useEffect(callback) { cursor++; effects.push(callback) },
}
const routeCalls = [], submissions = []
let submitResult = { ok: false, error: 'Choose resource', redirectTo: '/dashboard/trips/trip?error=Choose' }, submitError = null, allowConfirm = false, confirmMessage
const Bulk = (await load('../app/dashboard/trips/[id]/BulkTripSheetAssignmentForm.tsx', {
  react: hooks, 'react/jsx-runtime': jsx, 'next/link': { default: Link },
  'next/navigation': { useRouter: () => ({ refresh: () => routeCalls.push('refresh'), push: path => routeCalls.push(path) }), unstable_rethrow: error => { if (isRedirectError(error)) throw error } },
  '@/app/components/ActionSubmitButton': { default: Null }, './GroupedTripSheets': { default: Grouped },
  './trip-detail-presentation': helpers,
  './bulk-assignment-submit': { submitBulkTripSheetAssignments: async form => { submissions.push(form); if (submitError) throw submitError; return submitResult } },
}, { window: { confirm: message => { confirmMessage = message; return allowConfirm }, location: { pathname: '/dashboard/trips/trip', search: '' } } })).default
const props = { tripId: 'trip', returnPath: '/dashboard/trips/trip', tripSheets: sheets, availableResources: [{ id: 'active', label: 'Active Admin' }] }
function nodes(node) { return !node || typeof node !== 'object' ? [] : [node, ...React.Children.toArray(node.props?.children).flatMap(nodes)] }
function render() {
  cursor = 0; effects = []
  const tree = Bulk(props)
  const elements = nodes(tree)
  const all = elements.find(node => node.type === 'input' && node.props['aria-label'] === 'Select all matching Trip Sheets')
  all.props.ref.current = { indeterminate: false }
  effects.forEach(effect => effect())
  return { tree, elements, all, grouped: elements.find(node => node.type === Grouped) }
}
const searchInput = rendered => rendered.elements.find(node => node.type === 'input' && node.props.id === 'trip-sheet-search')
const selectedForm = rendered => rendered.elements.find(node => node.type === 'form' && node.props.onSubmit)
const selectedIds = rendered => rendered.grouped.props.selectedIds
let rendered = render()
assert(!selectedForm(rendered))
assert(!rendered.elements.some(node => node.type === 'summary'))
assert.equal(rendered.elements.filter(node => node.type === Link && node.props.href === '/dashboard/trip-sheets/new?tripId=trip').length, 1)
const headerHtml = renderToStaticMarkup(rendered.tree)
assert(headerHtml.includes('3 Trip Sheets · 2 scheduled days · 1 unassigned'))
assert(!headerHtml.includes('Assign to All Unassigned'))
rendered.grouped.props.onSelect('a', true)
rendered = render()
assert(selectedIds(rendered).has('a'))
assert.equal(rendered.all.props.ref.current.indeterminate, true)
const idsFromForm = form => nodes(form).filter(node => node.type === 'input' && node.props.name === 'selected_trip_sheet_ids').map(node => node.props.value)
assert.deepEqual(idsFromForm(selectedForm(rendered)), ['a'])
assert.equal(rendered.elements.find(node => node.props?.name === 'replace_existing').props.checked, false)
rendered.grouped.props.onDayToggle('2026-11-12', false)
searchInput(rendered).props.onChange({ target: { value: 'lunch' } })
rendered = render()
assert.deepEqual(Array.from(rendered.grouped.props.tripSheets, row => row.id), ['b'])
assert(selectedIds(rendered).has('a') && rendered.grouped.props.collapsedDays.has('2026-11-12'))
rendered.all.props.onChange({ currentTarget: { checked: true } })
rendered = render()
assert.deepEqual(Array.from(selectedIds(rendered)), ['a', 'b'])
assert.equal(rendered.all.props.checked, true)
rendered.elements.find(node => node.type === 'button' && node.props.children === 'Clear Matching Selection').props.onClick()
rendered = render()
assert.deepEqual(Array.from(selectedIds(rendered)), ['a'])
searchInput(rendered).props.onChange({ target: { value: '' } })
rendered = render()
rendered.all.props.onChange({ currentTarget: { checked: true } })
rendered = render()
assert.equal(selectedIds(rendered).size, 3)
assert.deepEqual(idsFromForm(selectedForm(rendered)), ['a', 'b', 'c'])
// Cancelled Clear Selected Assignments never submits.
let prevented = false
selectedForm(rendered).props.onSubmit({ nativeEvent: { submitter: { value: 'clear_selected' } }, preventDefault() { prevented = true } })
assert(prevented && confirmMessage.includes('3 selected'))
allowConfirm = true; prevented = false
selectedForm(rendered).props.onSubmit({ nativeEvent: { submitter: { value: 'clear_selected' } }, preventDefault() { prevented = true } })
assert(!prevented)
assert.equal(rendered.elements.filter(node => node.type === 'form').length, 1)
// Both validation errors and unexpected failures retain selection.
await selectedForm(rendered).props.action(data)
rendered = render()
assert.equal(selectedIds(rendered).size, 3)
assert(rendered.elements.some(node => node.props?.role === 'alert' && node.props.children === 'Choose resource'))
submitError = Error('offline')
await selectedForm(rendered).props.action(data)
rendered = render()
assert.equal(selectedIds(rendered).size, 3)
submitError = null; submitResult = { ok: true, error: null, redirectTo: '/dashboard/trips/trip?toast=Assigned' }
const finishing = selectedForm(rendered).props.action(data)
const beforeResponse = render()
assert.equal(selectedIds(beforeResponse).size, 3)
assert.equal(beforeResponse.grouped.props.pending, true)
assert.equal(beforeResponse.all.props.disabled, true)
const submissionCount = submissions.length
void selectedForm(beforeResponse).props.action(data)
assert.equal(submissions.length, submissionCount)
await finishing
rendered = render()
assert.equal(selectedIds(rendered).size, 0)
assert(routeCalls.includes('/dashboard/trips/trip?toast=Assigned'))
rendered.grouped.props.onSelect('a', true)
rendered = render()
rendered.elements.find(node => node.type === 'button' && node.props.children === 'Clear Selection').props.onClick()
assert.equal(selectedIds(render()).size, 0)
const groupedHtml = renderToStaticMarkup(React.createElement(Grouped, {
  trip: { id: 'trip' }, tripSheets: sheets, selectedIds: new Set(['a']), onSelect() {}, collapsedDays: new Set(), onDayToggle() {}, pending: false,
}))
assert(groupedHtml.includes('Inactive Guide') && groupedHtml.includes('Unassigned') && groupedHtml.includes('bg-amber-50'))
assert(groupedHtml.includes('href="/trip-sheets/a"') && groupedHtml.includes('href="/dashboard/trip-sheets/a/edit"'))
assert.equal((groupedHtml.match(/data-bulk-row/g) || []).length, 3)
assert.equal((groupedHtml.match(/<details open=""/g) || []).length, 2)
assert(!groupedHtml.includes('<table') && !groupedHtml.includes('<th') && !groupedHtml.includes('Updated'))
assert(!groupedHtml.includes('min-w-[700px]') && !groupedHtml.includes('/new?'))
assert(groupedHtml.includes('9:00 AM – 10:00 AM'))
const groupTree = Grouped({ trip: { id: 'trip' }, tripSheets: sheets, selectedIds: new Set(['a']), onSelect() {}, collapsedDays: new Set(['2026-11-12']), onDayToggle(day, open) { assert.equal(day, '2026-11-12'); assert.equal(open, true) }, pending: false })
const firstDay = nodes(groupTree).find(node => node.type === 'details')
assert.equal(firstDay.props.open, false)
firstDay.props.onToggle({ currentTarget: { open: true } })
assert(nodes(groupTree).find(node => node.type === 'input' && node.props.value === 'a').props.checked)
const emptyHtml = renderToStaticMarkup(React.createElement(Grouped, { trip: { id: 'trip' }, tripSheets: [], selectedIds: new Set(), onSelect() {}, collapsedDays: new Set(), onDayToggle() {}, pending: false }))
assert(emptyHtml.includes('No Trip Sheets match your search.'))

// Representative itinerary sizes retain every row, full text, grouping and controls.
for (const count of [1, 10, 35]) {
  const representative = Array.from({ length: count }, (_, index) => ({
    ...sheet(`sheet-${index}`, index === 0 ? 'A very long activity title with detailed operational context '.repeat(3) : `Activity ${index}`, `2026-11-${12 + index % 3}`,
      index === 0 ? ['Inactive Guide', 'A resource with an unusually long name', 'Another Expert'] : []),
    ...(index === 0 ? { end_date: '2026-11-16', end_time: '17:30' } : {}),
  }))
  const denseTree = Grouped({ trip: { id: 'trip' }, tripSheets: representative, selectedIds: new Set(['sheet-0']), onSelect() {}, collapsedDays: new Set(), onDayToggle() {}, pending: false })
  const denseNodes = nodes(denseTree)
  const denseHtml = renderToStaticMarkup(denseTree)
  assert.equal(denseNodes.filter(node => node.type === 'li').length, count)
  assert.equal(denseNodes.filter(node => node.type === MenuStub).length, count)
  assert.equal(denseNodes.filter(node => node.type === 'details' && node.props.open).length, Math.min(3, count))
  assert(denseHtml.includes(representative[0].title))
  assert(denseHtml.includes('Inactive Guide, A resource with an unusually long name, Another Expert'))
  assert(denseHtml.includes('12 Nov 2026, 9:00 AM → 16 Nov 2026, 5:30 PM'))
  assert(!denseHtml.includes('truncate') && !denseHtml.includes('overflow-hidden') && !denseHtml.includes('overflow-x'))
  assert(denseHtml.includes('md:contents') && denseHtml.includes('minmax(0,1fr)') && denseHtml.includes('overflow-wrap:anywhere'))
  const activity = denseNodes.find(node => node.type === 'li')
  assert(!activity.props.className.includes('h-') && activity.props.className.includes('py-1'))
  assert(denseNodes.find(node => node.type === 'input' && node.props.value === 'sheet-0').props.checked)
}

// Popover uses existing action components and top-layer placement with keyboard focus.
let confirmDelete = false, deletePrevented = false
const Delete = (await load('../app/dashboard/trip-sheets/DeleteTripSheetButton.tsx', {
  'react/jsx-runtime': jsx, '@/app/components/ActionSubmitButton': { default: Null }, './actions': { deleteTripSheet() {} },
}, { window: { confirm: () => confirmDelete } })).default
Delete({ tripSheetId: 'a', tripId: 'trip' }).props.onSubmit({ preventDefault() { deletePrevented = true } })
assert(deletePrevented)
confirmDelete = true; deletePrevented = false
Delete({ tripSheetId: 'a', tripId: 'trip' }).props.onSubmit({ preventDefault() { deletePrevented = true } })
assert(!deletePrevented)
let refIndex = 0, focusCount = 0, hideCount = 0, position
const menuRefs = [{ current: { getBoundingClientRect: () => ({ right: 370, top: 550, bottom: 590 }), focus() { focusCount++ } } }, { current: { hidePopover() { hideCount++ }, querySelector: () => ({ focus() { focusCount++ } }) } }]
const Duplicate = (await load('../app/dashboard/trip-sheets/DuplicateTripSheetButton.tsx', {
  'react/jsx-runtime': jsx, '@/app/components/ActionLinkButton': { default: Null },
})).default
const Menu = (await load('../app/dashboard/trips/[id]/TripSheetActionsMenu.tsx', {
  'react/jsx-runtime': jsx, 'next/link': { default: Link },
  react: { useId: () => 'menu', useRef: () => menuRefs[refIndex++], useState: value => [value, next => { position = next }], useEffect() {} },
  '@/app/dashboard/trip-sheets/DeleteTripSheetButton': { default: Delete }, '@/app/dashboard/trip-sheets/DuplicateTripSheetButton': { default: Duplicate },
}, { window: { innerWidth: 375, innerHeight: 600 } })).default
const menu = Menu({ tripSheetId: 'a', tripId: 'trip', title: 'Pick-up' })
const [trigger, panel] = menu.props.children
trigger.props.onClick()
assert(position.left >= 8 && position.left + 184 <= 375 && position.top + 156 < 600)
assert.equal(trigger.props['aria-label'], 'More actions for Pick-up')
assert.equal(panel.props.popover, 'auto')
panel.props.onToggle({ newState: 'open' })
panel.props.onKeyDown({ key: 'Escape', preventDefault() {} })
assert(focusCount === 2 && hideCount === 1)
const duplicate = nodes(menu).find(node => node.type === Duplicate)
assert.equal(Duplicate(duplicate.props).props.href, '/dashboard/trip-sheets/new?tripId=trip&duplicateFrom=a')
assert(nodes(menu).some(node => node.type === Link && node.props.href === '/trip-sheets/a'))
console.log('PASS: loaded-data search/grouping; controlled, filtered and hidden selection; error/success submission; compact rows/header; removed trip-wide UI; matching/all clear; inactive names; routes/delete confirmation and popover focus/Escape/placement.')
