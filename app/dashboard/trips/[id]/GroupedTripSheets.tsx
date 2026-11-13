'use client'

import Link from 'next/link'
import TripSheetActionsMenu from './TripSheetActionsMenu'
import { formatTimeValue } from '@/lib/time'
import { formatTripSheetDay, groupTripSheetsByStartDate, type OperationalTripSheet } from './trip-detail-presentation'

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)) : '-'
}
function formatTime(value: string | null) { return value ? formatTimeValue(value) : null }
function formatDateTimePoint(dateValue: string | null, timeValue: string | null) {
  const formattedDate = formatDate(dateValue)

  if (formattedDate === '-') {
    return '-'
  }

  const formattedTime = formatTime(timeValue)

  return formattedTime ? `${formattedDate}, ${formattedTime}` : formattedDate
}

function formatTripSheetSchedule(
  startDate: string | null,
  startTime: string | null,
  endDate: string | null,
  endTime: string | null
) {
  if (!startDate && !endDate) {
    return '-'
  }

  if (startDate && (!endDate || startDate === endDate)) {
    const start = formatTime(startTime)
    const end = formatTime(endTime)
    if (!start && !end) return 'Time not set'
    if (!start) return `Ends ${end}`
    return end && end !== start ? `${start} – ${end}` : start
  }

  const formattedStart = formatDateTimePoint(startDate, startTime)

  if (!endDate) {
    return formattedStart
  }

  const formattedEnd = formatDateTimePoint(endDate, endTime)

  if (
    startDate === endDate &&
    (startTime ?? '') === (endTime ?? '')
  ) {
    return formattedStart
  }

  return `${formattedStart} → ${formattedEnd}`
}

export default function GroupedTripSheets({ trip, tripSheets, selectedIds, onSelect, collapsedDays, onDayToggle, pending }: {
  trip: { id: string }
  tripSheets: OperationalTripSheet[]
  selectedIds: ReadonlySet<string>
  onSelect: (id: string, checked: boolean) => void
  collapsedDays: ReadonlySet<string>
  onDayToggle: (day: string, open: boolean) => void
  pending: boolean
}) {
  const groups = groupTripSheetsByStartDate(tripSheets)
  return (
    <div className="space-y-1.5">
      {!groups.length ? <p className="text-sm text-gray-600">No Trip Sheets match your search.</p> : null}
      {groups.map(group => (
        <details key={group.date ?? 'undated'} open={!collapsedDays.has(group.date ?? 'undated')} onToggle={event => onDayToggle(group.date ?? 'undated', event.currentTarget.open)} className="rounded-lg border border-zinc-200">
          <summary className="cursor-pointer rounded-lg bg-zinc-50 px-2 py-1.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-emerald-700">
            {formatTripSheetDay(group.date)} · {group.rows.length} Trip Sheet{group.rows.length === 1 ? '' : 's'}
          </summary>
          <ul className="divide-y divide-zinc-200">
            {group.rows.map(tripSheet => {
              const title = tripSheet.title ?? 'Untitled trip sheet'
              const assignedResourceLabel = tripSheet.assignedUsers.map(resource => resource.label).join(', ')
              return (
                <li key={tripSheet.id} className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-x-2 px-2 py-1 md:grid-cols-[1.75rem_8rem_minmax(0,1fr)_10rem_auto] lg:grid-cols-[1.75rem_8rem_minmax(0,1fr)_12.5rem_auto]">
                  <label className="flex min-h-8 min-w-7 self-start cursor-pointer items-center justify-center rounded focus-within:outline-2 focus-within:outline-emerald-700">
                    <input type="checkbox" value={tripSheet.id} checked={selectedIds.has(tripSheet.id)} disabled={pending}
                      onChange={event => onSelect(tripSheet.id, event.currentTarget.checked)}
                      data-bulk-row="true" aria-label={`Select ${title}`} className="h-4 w-4 rounded border-zinc-300" />
                  </label>
                  <div className="min-w-0 md:contents">
                    <div className="flex flex-wrap items-baseline gap-x-2 md:contents">
                      <p className="min-w-0 text-xs leading-5 text-gray-600 [overflow-wrap:anywhere]">
                        {formatTripSheetSchedule(tripSheet.start_date, tripSheet.start_time, tripSheet.end_date, tripSheet.end_time)}
                      </p>
                      <Link href={`/trip-sheets/${tripSheet.id}`} className="min-w-0 rounded text-sm font-semibold leading-5 text-gray-900 [overflow-wrap:anywhere] hover:underline focus-visible:outline-2 focus-visible:outline-emerald-700">
                        {title}
                      </Link>
                    </div>
                    <p className="min-w-0 text-xs leading-5 text-gray-600 [overflow-wrap:anywhere] md:text-sm">
                      {assignedResourceLabel || <span className="inline-block rounded bg-amber-50 px-1.5 text-amber-900">Unassigned</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 self-start whitespace-nowrap">
                    <Link href={`/dashboard/trip-sheets/${tripSheet.id}/edit`} className="ui-button ui-button-primary ui-button-compact" style={{ height: 32, padding: '0 8px' }}>Edit</Link>
                    <TripSheetActionsMenu tripSheetId={tripSheet.id} tripId={trip.id} title={title} />
                  </div>
                </li>
              )
            })}
          </ul>
        </details>
      ))}
    </div>
  )
}
