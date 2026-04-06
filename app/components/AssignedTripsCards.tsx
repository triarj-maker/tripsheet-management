import Link from 'next/link'

import type { AssignedTripSummary } from '@/app/lib/assigned-trips'

type AssignedTripsCardsProps = {
  trips: AssignedTripSummary[]
  emptyMessage?: string
  className?: string
  from?: string
}

function formatValue(value: string | null) {
  return value ?? '-'
}

function formatDate(value: string | null) {
  if (!value) {
    return '-'
  }

  const [year, month, day] = value.split('-').map(Number)

  if (!year || !month || !day) {
    return value
  }

  return `${day} ${new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))}`
}

function formatAssignedCount(count: number) {
  return `${count} assigned to you`
}

function buildViewHref(id: string, from?: string) {
  if (!from) {
    return `/trips/${id}`
  }

  const params = new URLSearchParams({ from })
  return `/trips/${id}?${params.toString()}`
}

export default function AssignedTripsCards({
  trips,
  emptyMessage = 'No trips assigned yet.',
  className = 'grid gap-4 md:grid-cols-2 xl:grid-cols-3',
  from,
}: AssignedTripsCardsProps) {
  return (
    <div className={className}>
      {trips.length === 0 ? (
        <div className="app-section-card text-base text-gray-700">
          {emptyMessage}
        </div>
      ) : (
        trips.map((trip) => (
          <Link
            key={trip.id}
            href={buildViewHref(trip.id, from)}
            className="app-section-card block space-y-3 transition hover:bg-zinc-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="break-words text-lg font-bold leading-7 text-gray-900">
                  {formatValue(trip.title)}
                </p>
              </div>

              <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                {formatAssignedCount(trip.assigned_trip_sheet_count)}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div className="col-span-2 min-w-0 space-y-1">
                <dt className="text-sm font-medium text-gray-700">Destination</dt>
                <dd className="break-words text-base text-gray-900">
                  {formatValue(trip.destination)}
                </dd>
              </div>

              <div className="space-y-1">
                <dt className="text-sm font-medium text-gray-700">Start</dt>
                <dd className="text-base text-gray-900">{formatDate(trip.start_date)}</dd>
              </div>

              <div className="space-y-1">
                <dt className="text-sm font-medium text-gray-700">End</dt>
                <dd className="text-base text-gray-900">{formatDate(trip.end_date)}</dd>
              </div>
            </dl>

            <div className="flex items-center justify-between gap-3 border-t border-zinc-200 pt-2">
              <p className="text-sm text-gray-600">
                {trip.assigned_trip_sheet_count} trip sheet
                {trip.assigned_trip_sheet_count === 1 ? '' : 's'}
              </p>
              <span className="text-sm font-medium text-gray-700">View Trip</span>
            </div>
          </Link>
        ))
      )}
    </div>
  )
}
