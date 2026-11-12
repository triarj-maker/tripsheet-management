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
  vm.runInNewContext(code, { exports, URLSearchParams, ...globals, require(name) {
    if (!(name in dependencies)) throw Error(`Unexpected import: ${name}`)
    return dependencies[name]
  } })
  return exports
}
const utils = await load('../app/dashboard/templates/listing.ts')
const defaults = utils.parseTemplateListing({})
assert.equal(defaults.status, 'active')
assert.equal(defaults.sort, 'updated_desc')
assert.equal(defaults.hasFilters, false)
assert.equal(utils.parseTemplateListing({ q: '  alpha  ' }).q, 'alpha')
assert.equal(utils.parseTemplateListing({ destination: 'invalid', status: 'bad', sort: 'bad' }).returnTo, '/dashboard/templates')
assert.equal(utils.escapeTemplateSearch('10%_\\'), '10\\%\\_\\\\')
const destination = '11111111-1111-1111-1111-111111111111'
const rows = [
  { id: 'a', title: 'Alpha Trek', destination_id: destination, destination_ref: { name: 'Goa' }, archived_at: null, updated_at: '2026-11-01' },
  { id: 'b', title: 'Beta Trek', destination_id: null, destination_ref: null, archived_at: null, updated_at: '2026-11-03' },
  { id: 'c', title: 'Archived Alpha', destination_id: destination, destination_ref: { name: 'Goa' }, archived_at: '2026-10-01', updated_at: '2026-11-02' },
  { id: 'd', title: '100%_literal', destination_id: null, destination_ref: null, archived_at: null, updated_at: '2026-11-04' },
]
let queries, authorized = true
function query(table) {
  const log = { table, filters: [], orders: [] }
  queries.push(log)
  const q = {
    select(columns, options) { log.columns = columns; log.options = options; return q },
    ilike(column, pattern) { log.search = pattern.slice(1, -1).replace(/\\([\\%_])/g, '$1').toLowerCase(); return q },
    eq(column, value) { log.filters.push(row => row[column] === value); return q },
    is(column, value) { log.filters.push(row => row[column] === value); return q },
    not(column, operator, value) { assert.equal(operator, 'is'); log.filters.push(row => row[column] !== value); return q },
    order(column, options) { log.orders.push([column, options]); return q },
    range(from, to) { log.range = [from, to]; return q },
    then(resolve, reject) {
      if (table === 'destinations') return Promise.resolve({ data: [{ id: destination, name: 'Goa' }] }).then(resolve, reject)
      let selected = rows.filter(row => log.filters.every(filter => filter(row)) && (!log.search || row.title.toLowerCase().includes(log.search)))
      selected = selected.sort((left, right) => {
        for (const [column, options] of log.orders) {
          const order = left[column].localeCompare(right[column]) * (options.ascending ? 1 : -1)
          if (order) return order
        }
        return 0
      })
      const data = log.range ? selected.slice(log.range[0], log.range[1] + 1) : selected
      return Promise.resolve({ data, count: selected.length }).then(resolve, reject)
    },
  }
  return q
}
const Link = ({ children, ...props }) => React.createElement('a', props, children)
const Null = () => null
const MenuMarker = props => React.createElement('span', { 'data-template': props.templateId, 'data-return-to': props.returnTo })
const page = (await load('../app/dashboard/templates/page.tsx', {
  'react/jsx-runtime': jsx, 'next/link': { default: Link }, '@/app/dashboard/AdminNav': { default: Null },
  '@/app/components/ActionLinkButton': { default: Null }, './TemplateActionsMenu': { default: MenuMarker },
  './listing': utils, '@/lib/trip-sheets': await load('../lib/trip-sheets.ts'), '@/lib/time': await load('../lib/time.ts'),
  './lib': { requireAdmin: async () => { if (!authorized) throw Error('denied'); return { supabase: { from: query } } } },
})).default
async function render(params = {}) {
  queries = []
  const tree = await page({ searchParams: Promise.resolve(params) })
  const html = renderToStaticMarkup(tree)
  assert.equal(queries.length, 2) // One joined template query and one destination lookup, independent of result count.
  assert(queries[0].columns.includes('destination_ref:destinations(name)'))
  return { html, ids: [...html.matchAll(/data-template="([^"]+)"/g)].map(match => match[1]) }
}
assert.deepEqual((await render()).ids, ['d', 'b', 'a'])
assert.deepEqual((await render({ q: '  ALPHA  ', destination, status: 'all' })).ids, ['c', 'a'])
assert.deepEqual((await render({ destination: 'unassigned' })).ids, ['d', 'b'])
assert.deepEqual((await render({ status: 'archived' })).ids, ['c'])
assert.deepEqual((await render({ status: 'all' })).ids, ['d', 'b', 'c', 'a'])
assert.deepEqual((await render({ q: '%_' })).ids, ['d'])
for (const [sort, ids] of Object.entries({ name_asc: ['d', 'a', 'b'], name_desc: ['b', 'a', 'd'], updated_asc: ['a', 'b', 'd'], updated_desc: ['d', 'b', 'a'] })) {
  assert.deepEqual((await render({ sort })).ids, ids)
}
const filtered = await render({ q: ' Trek ', destination: 'unassigned', status: 'all', sort: 'name_asc' })
assert.deepEqual(filtered.ids, ['b'])
assert(filtered.html.includes('1 matching template') && filtered.html.includes('Clear Filters'))
assert(filtered.html.includes('Unassigned') && filtered.html.includes('/dashboard/templates/b/edit'))
const empty = await render({ q: 'no-match' })
assert(empty.html.includes('0 matching templates') && empty.html.includes('No templates match'))
const defaultHtml = (await render()).html
assert(!defaultHtml.includes('Clear Filters'))
assert(defaultHtml.includes('flex-nowrap') && defaultHtml.includes('app-table-wrap') && defaultHtml.includes('sm:grid-cols-2'))
const originalLength = rows.length
for (let index = 0; index < 105; index++) rows.push({ ...rows[0], id: `extra-${index}`, title: `Extra ${index}` })
const firstPage = await render({ status: 'all' })
assert.equal(firstPage.ids.length, 100)
assert(firstPage.html.includes('Next') && firstPage.html.includes('109 matching templates'))
assert.equal((await render({ status: 'all', page: '2' })).ids.length, 9)
assert.equal(utils.parseTemplateListing({ page: '-3' }).page, 1)
assert.equal(utils.templateListingPageHref('/dashboard/templates?q=Alpha&page=2', 1), '/dashboard/templates?q=Alpha')
rows.splice(originalLength)
authorized = false; queries = []
await assert.rejects(page({ searchParams: Promise.resolve({}) }), /denied/)
assert.equal(queries.length, 0)

const archive = () => {}, restore = () => {}, remove = () => {}
const actions = { archiveTemplate: archive, restoreTemplate: restore, deleteTemplate: remove }
const Submit = props => React.createElement('button', { type: 'submit', className: props.className }, props.idleLabel)
const Duplicate = props => React.createElement('button', { 'data-href': props.href }, props.idleLabel)
let confirmation = false, prevented = false
const Delete = (await load('../app/dashboard/templates/DeleteTemplateButton.tsx', {
  'react/jsx-runtime': jsx, '@/app/components/ActionSubmitButton': { default: Submit },
  '@/app/dashboard/templates/actions': actions,
}, { window: { confirm: () => confirmation } })).default
const deleteForm = Delete({ templateId: 'a', returnTo: defaults.returnTo })
deleteForm.props.onSubmit({ preventDefault() { prevented = true } })
assert(prevented)
confirmation = true; prevented = false
deleteForm.props.onSubmit({ preventDefault() { prevented = true } })
assert(!prevented)

const refs = [], states = []
let focused = 0, hidden = 0, rect
const trigger = { getBoundingClientRect: () => rect, focus() { focused++ } }
const popover = { hidePopover() { hidden++ }, querySelector: () => ({ focus() { focused++ } }) }
const hooks = {
  useEffect() {}, useId: () => 'menu',
  useState: value => [value, next => states.push(next)],
  useRef: () => { const ref = { current: refs.length % 2 === 0 ? trigger : popover }; refs.push(ref); return ref },
}
const Menu = (await load('../app/dashboard/templates/TemplateActionsMenu.tsx', {
  react: hooks, 'react/jsx-runtime': jsx, './actions': actions, './DeleteTemplateButton': { default: Delete },
  '@/app/components/ActionLinkButton': { default: Duplicate }, '@/app/components/ActionSubmitButton': { default: Submit },
}, { window: { innerWidth: 375, innerHeight: 600 } })).default
for (const archived of [false, true]) {
  const tree = Menu({ templateId: 'a', title: 'Alpha', archived, returnTo: filtered.html ? '/dashboard/templates?status=all' : '' })
  const [button, panel] = tree.props.children
  rect = { top: 555, bottom: 590, right: 365 }
  button.props.onClick()
  const position = states.at(-1)
  assert(position.top >= 8 && position.top + 156 < 600 && position.left + 184 <= 375)
  assert.equal(panel.props.popover, 'auto')
  panel.props.onToggle({ newState: 'open' })
  assert(focused > 0)
  panel.props.onKeyDown({ key: 'Escape', preventDefault() {} })
  assert(hidden > 0)
  const form = React.Children.toArray(panel.props.children).find(child => child.type === 'form')
  assert.equal(form.props.action, archived ? restore : archive)
  const text = renderToStaticMarkup(tree)
  assert(text.includes('Duplicate') && text.includes('Delete') && text.includes(archived ? 'Restore' : 'Archive'))
  assert(text.includes('More actions for Alpha') && text.includes('return_to'))
}
console.log('PASS: default Active, literal/trimmed/case-insensitive search, combined filters, unassigned, all sorts, counts/empty states, bounded query count, Admin gate, menu placement/focus/Escape, action eligibility and delete confirmation.')
