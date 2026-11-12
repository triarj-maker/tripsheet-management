import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import * as jsx from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'

async function load(path, dependencies = {}) {
  const code = ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const exports = {}
  vm.runInNewContext(code, { exports, Buffer, URL, require(name) {
    if (!(name in dependencies)) throw Error(`Unexpected import: ${name}`)
    return dependencies[name]
  } })
  return exports
}
const plain = value => JSON.parse(JSON.stringify(value))
const time = await load('../lib/time.ts')
const utilities = await load('../lib/resource-assignment-schedule.ts', { '@/lib/time': time })
const now = time.parseDateTimeInAppTimeZoneToComparableTimestamp('2026-11-11', '12:00')
const session = (id, tripId, startDate, endDate = startDate) => ({
  id, tripId, title: `SESSION-${id}`, startDate, endDate, startTime: null, endTime: null,
  tripStartDate: '2026-11-01', tripEndDate: '2026-11-30',
  tripTitle: `Trip${tripId}`, customer: 'Same School', destination: 'Goa',
})
const entries = [session('future', 'A', '2026-11-20'), session('old', 'A', '2026-11-02'),
  session('ongoing', 'A', '2026-11-10', '2026-11-12'), session('other', 'B', '2026-11-13'),
  session('recent', 'B', '2026-11-09'), session('undated', 'C', null)]
const all = utilities.selectScheduleTrips(entries, 'all', now)
assert.deepEqual(plain(all.map(group => group.tripId)), ['A', 'B', 'C'])
assert.equal(all[0].sessionCount, 3)
assert.equal(all[0].assignedStartDate, '2026-11-02')
assert.equal(all[0].assignedEndDate, '2026-11-20')
assert.equal(all[0].tripStartDate, '2026-11-01')
assert.equal(all[0].tripEndDate, '2026-11-30')
const upcoming = utilities.selectScheduleTrips(entries, 'upcoming', now)
assert.deepEqual(plain(upcoming[0].sessions.map(row => row.id)), ['ongoing', 'future'])
assert.equal(upcoming[0].sessionCount, 2)
assert.equal(upcoming[0].assignedStartDate, '2026-11-10')
assert.deepEqual(plain(utilities.selectScheduleTrips(entries, 'past', now).map(row => row.tripId)), ['B', 'A'])
assert.equal(utilities.selectScheduleTrips([entries[0], entries[0]], 'all', now)[0].sessionCount, 1)
assert.equal(utilities.selectScheduleTrips([], 'all', now).length, 0)
// A gap within a long parent Trip is not an ongoing assignment.
const gap = [session('gap-before', 'D', '2026-11-01'), session('gap-after', 'D', '2026-11-25')]
assert.equal(utilities.selectScheduleTrips(gap, 'upcoming', now)[0].assignedStartDate, '2026-11-25')
assert.equal(utilities.selectScheduleTrips(gap, 'past', now)[0].assignedEndDate, '2026-11-01')
const dateOnly = session('today', 'E', '2026-11-11')
assert.equal(utilities.selectScheduleTrips([dateOnly], 'upcoming', time.parseDateTimeInAppTimeZoneToComparableTimestamp('2026-11-11', '23:59:59')).length, 1)

const Rows = (await load('../app/dashboard/resources/[id]/assignments/ResourceScheduleRows.tsx', {
  react: React, 'react/jsx-runtime': jsx, '@/lib/time': time,
  'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
})).default
const html = renderToStaticMarkup(React.createElement(Rows, { trips: upcoming }))
assert(html.includes('aria-expanded="false"'))
assert(html.includes('hidden=""'))
assert(html.includes('/trip-sheets/ongoing') && html.includes('/trip-sheets/future'))
assert(!html.includes('/trip-sheets/old'))
assert(html.includes('Parent Trip dates:'))

const pdf = await load('../lib/pdf.ts')
let rendered
const generator = await load('../lib/resource-assignment-schedule-pdf.ts', {
  '@/lib/time': time, '@/lib/pdf': { createSimplePdf(pages, options) {
    rendered = pages
    return pdf.createSimplePdf(pages, options)
  } },
})
const generatedAt = new Date('2026-11-11T12:00:00Z')
const buffer = generator.createResourceSchedulePdf({ name: 'Resource Name', entries: all, filter: 'all', generatedAt })
const lines = rendered.flatMap(page => page.lines.map(line => line.text))
assert.equal(lines.filter(text => text.includes('TripA')).length, 1)
assert.equal(lines.filter(text => text.includes('TripB')).length, 1)
assert(!lines.some(text => text.includes('SESSION-')))
assert(lines.includes('Sessions') && lines.includes('Assigned dates'))
assert(buffer.toString().includes('/MediaBox [0 0 595.28 841.89]'))
const empty = generator.createResourceSchedulePdf({ name: 'Resource', entries: [], filter: 'past', generatedAt })
assert(empty.toString().includes('No assignments'))
const longGroups = Array.from({ length: 65 }, (_, index) => ({ ...all[0], tripId: String(index), tripTitle: `Trip ${index}` }))
const longPdf = generator.createResourceSchedulePdf({ name: 'Resource Name', entries: longGroups, filter: 'all', generatedAt })
assert(rendered.length > 1)
assert(rendered.every(page => page.lines.some(line => line.text === 'Sessions')))
if (process.env.SCHEDULE_PDF_PREVIEW) await writeFile(process.env.SCHEDULE_PDF_PREVIEW, longPdf)

let authorized = true, calls = 0
const route = await load('../app/dashboard/resources/[id]/assignments/pdf/route.ts', {
  'next/server': { NextResponse: class { constructor(body, options = {}) { this.body = body; Object.assign(this, options) } } },
  '@/lib/resource-assignment-schedule.server': {
    requireScheduleAdmin: async () => { if (!authorized) throw Error('denied') },
    loadResourceAssignmentSchedule: async () => { calls++; return { resource: { full_name: 'Resource' }, entries, error: null } },
  },
  '@/lib/resource-assignment-schedule': utilities,
  '@/lib/resource-assignment-schedule-pdf': generator,
})
authorized = false
await assert.rejects(route.GET(new Request('https://example.test/pdf'), { params: Promise.resolve({ id: 'id' }) }), /denied/)
assert.equal(calls, 0)
authorized = true
for (const filter of ['upcoming', 'past', 'all']) {
  const response = await route.GET(new Request(`https://example.test/pdf?filter=${filter}`), { params: Promise.resolve({ id: 'id' }) })
  assert.equal(response.headers['Cache-Control'], 'no-store')
  const selected = utilities.selectScheduleTrips(entries, filter)
  const output = rendered.flatMap(page => page.lines.map(line => line.text)).join(' ')
  for (const tripId of ['A', 'B', 'C']) assert.equal(output.includes(`Trip${tripId}`), selected.some(group => group.tripId === tripId))
}
const lookupHelpers = await load('../lib/trip-sheets.ts')
let loaderAuthorized = true
const queries = []
const filters = []
const resourceId = '12345678-1234-1234-1234-123456789abc'
const database = {
  profiles: { data: { id: resourceId, full_name: 'Inactive Admin', is_active: false, is_admin: true } },
  trip_sheet_assignments: { data: [{ trip_sheet_id: 'sheet' }] },
  trip_sheets: { data: [{ id: 'sheet', trip_id: 'parent', title: 'Session', start_date: '2026-11-10', end_date: '2026-11-12',
    trip: { id: 'parent', start_date: '2026-11-01', end_date: '2026-11-30', title: 'Parent Trip', destination_ref: { name: 'Goa' } } }] },
}
const loader = await load('../lib/resource-assignment-schedule.server.ts', {
  'server-only': {}, react: { cache: fn => fn }, '@/lib/trip-sheets': lookupHelpers,
  '@/app/dashboard/lib': { requireAdmin: async () => {
    if (!loaderAuthorized) throw Error('denied')
    return { supabase: { from(table) {
      queries.push(table)
      const query = {
        select() { return query },
        eq(key, value) { filters.push([table, key, value]); return query },
        in() { return query },
        maybeSingle() { return Promise.resolve(database[table]) },
        then(resolve, reject) { return Promise.resolve(database[table]).then(resolve, reject) },
      }
      return query
    } } }
  } },
})
loaderAuthorized = false
await assert.rejects(loader.loadResourceAssignmentSchedule(resourceId), /denied/)
assert.equal(queries.length, 0)
loaderAuthorized = true
const loaded = await loader.loadResourceAssignmentSchedule(resourceId)
assert.equal(loaded.resource.is_active, false)
assert.deepEqual(queries, ['profiles', 'trip_sheet_assignments', 'trip_sheets'])
assert(filters.some(([table, key, value]) => table === 'trip_sheets' && key === 'is_archived' && value === false))
assert(filters.some(([table, key, value]) => table === 'trip_sheet_assignments' && key === 'resource_user_id' && value === resourceId))
assert.equal(loaded.entries[0].tripId, 'parent')
assert.equal(loaded.entries[0].startDate, '2026-11-10')
assert.equal(loaded.entries[0].tripStartDate, '2026-11-01')
console.log('PASS: Trip grouping, distinct identities, session date ranges, filters/order, gaps, date-only boundaries, expandable contents, grouped/empty/multipage PDF and route authorization.')
