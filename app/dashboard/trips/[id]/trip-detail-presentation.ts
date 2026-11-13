import { parseDateTimeInAppTimeZoneToComparableTimestamp } from '@/lib/time'

type DatedSheet = { id: string; start_date: string | null; start_time: string | null }

export function groupTripSheetsByStartDate<T extends DatedSheet>(sheets: T[]) {
  const ordered = [...sheets].sort((a, b) =>
    (a.start_date ?? '9999-12-31').localeCompare(b.start_date ?? '9999-12-31') ||
    (a.start_time ?? '00:00').localeCompare(b.start_time ?? '00:00') || a.id.localeCompare(b.id)
  )
  const groups = new Map<string | null, T[]>()
  for (const sheet of ordered) {
    const rows = groups.get(sheet.start_date) ?? []
    rows.push(sheet)
    groups.set(sheet.start_date, rows)
  }
  return [...groups].map(([date, rows]) => ({ date, rows }))
}

export function formatTripSheetDay(date: string | null) {
  const timestamp = parseDateTimeInAppTimeZoneToComparableTimestamp(date, null)
  return timestamp === null ? 'Date not set' : new Intl.DateTimeFormat('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(timestamp))
}

export type TripDetailQuery = {
  error?: string
  success?: string
  task?: string
  newTask?: string
  tab?: string
}
export function getTripDetailTab(query: TripDetailQuery) {
  return query.task || query.newTask === '1' || query.tab === 'tasks' ? 'tasks' : 'trip-sheets'
}
export function tripDetailTabHref(tripId: string, query: TripDetailQuery, tab: 'trip-sheets' | 'tasks') {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) if (value) params.set(key, value)
  params.set('tab', tab)
  // Explicitly leaving Tasks closes its panel; old task deep links still open Tasks.
  if (tab === 'trip-sheets') { params.delete('task'); params.delete('newTask') }
  return `/dashboard/trips/${tripId}?${params}`
}

export type OperationalTripSheet = {
  id: string
  title: string | null
  start_date: string | null
  start_time: string | null
  end_date: string | null
  end_time: string | null
  updated_at: string | null
  assignedUsers: Array<{ resourceUserId: string; label: string }>
}

export function filterOperationalTripSheets(sheets: OperationalTripSheet[], search: string) {
  const term = search.trim().toLowerCase()
  return term ? sheets.filter(sheet => (sheet.title ?? '').toLowerCase().includes(term) ||
    sheet.assignedUsers.some(user => user.label.toLowerCase().includes(term))) : sheets
}

export function updateTripSheetSelection(selected: ReadonlySet<string>, ids: string[], checked: boolean) {
  const next = new Set(selected)
  for (const id of ids) { if (checked) next.add(id); else next.delete(id) }
  return next
}

export function matchingTripSheetSelection(selected: ReadonlySet<string>, ids: string[]) {
  const count = ids.filter(id => selected.has(id)).length
  return { checked: ids.length > 0 && count === ids.length, indeterminate: count > 0 && count < ids.length }
}
