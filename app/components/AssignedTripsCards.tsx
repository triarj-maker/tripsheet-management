import Link from 'next/link'

import type { AssignedTripSummary } from '@/app/lib/assigned-trips'

type AssignedTripsCardsProps = {
  trips: AssignedTripSummary[]
  emptyMessage?: string
  from?: string
}

type TripSection = {
  title: string
  items: AssignedTripSummary[]
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

function formatTripDateRange(startDate: string | null, endDate: string | null) {
  if (!startDate && !endDate) {
    return 'Date TBD'
  }

  if (!startDate || !endDate || startDate === endDate) {
    return formatDate(startDate || endDate)
  }

  return `${formatDate(startDate)} -> ${formatDate(endDate)}`
}

function formatAssignedCount(count: number) {
  return `${count} assigned to you`
}

function formatTime(value: string | null) {
  if (!value) {
    return 'Time TBD'
  }

  const [hoursText, minutesText] = value.split(':')
  const hours = Number(hoursText)
  const minutes = Number(minutesText)

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return value
  }

  const date = new Date()
  date.setHours(hours, minutes, 0, 0)

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

function parseIsoDate(value: string | null) {
  if (!value) {
    return null
  }

  const [yearText, monthText, dayText] = value.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)

  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return null
  }

  return new Date(year, month - 1, day)
}

function getRelativeDayLabel(value: string | null) {
  const parsedDate = parseIsoDate(value)

  if (!parsedDate) {
    return formatDate(value)
  }

  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const targetStart = new Date(
    parsedDate.getFullYear(),
    parsedDate.getMonth(),
    parsedDate.getDate()
  )
  const diffInDays = Math.round(
    (targetStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (diffInDays === 0) {
    return 'Today'
  }

  if (diffInDays === 1) {
    return 'Tomorrow'
  }

  if (diffInDays > 1 && diffInDays <= 6) {
    return `In ${diffInDays} days`
  }

  return formatDate(value)
}

function formatNextActivityLabel(trip: AssignedTripSummary) {
  const nextActivity = trip.next_activity

  if (!nextActivity) {
    return null
  }

  const dateLabel = getRelativeDayLabel(nextActivity.start_date)
  const timeLabel = nextActivity.start_time ? formatTime(nextActivity.start_time) : 'Time TBD'

  return {
    dateLabel,
    timeLabel,
  }
}

function buildViewHref(id: string, from?: string) {
  if (!from) {
    return `/trips/${id}`
  }

  const params = new URLSearchParams({ from })
  return `/trips/${id}?${params.toString()}`
}

function TripSection({ title, items, from }: TripSection & { from?: string }) {
  if (items.length === 0) {
    return null
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
          {title}
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          {items.length} trip{items.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {items.map((trip) => (
          (() => {
            const nextActivityTiming = formatNextActivityLabel(trip)

            return (
          <Link
            key={trip.id}
            href={buildViewHref(trip.id, from)}
            className="app-section-card block cursor-pointer space-y-3 border border-zinc-200 px-4 py-3 transition active:scale-[0.99] active:bg-zinc-50 hover:border-zinc-300 hover:bg-zinc-50 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
          >
            <div className="flex flex-wrap items-start gap-2.5">
              <div className="min-w-0 space-y-1">
                <p className="break-words text-base font-bold leading-6 text-gray-900 sm:text-lg">
                  {formatValue(trip.title)}
                </p>
              </div>

              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                {formatAssignedCount(trip.assigned_trip_sheet_count)}
              </span>
            </div>

            <dl className="space-y-2.5">
              <div className="min-w-0 space-y-0.5">
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Destination
                </dt>
                <dd className="break-words text-sm text-gray-900 sm:text-base">
                  {formatValue(trip.destination)}
                </dd>
              </div>

              <div className="space-y-0.5">
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Trip Dates
                </dt>
                <dd className="text-sm font-medium text-gray-900 sm:text-base">
                  {formatTripDateRange(trip.start_date, trip.end_date)}
                </dd>
              </div>
            </dl>

            <div className="rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                Next Activity
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {trip.next_activity?.trip_sheet_title ?? 'No assigned trip sheet'}
              </p>
              {trip.next_activity && nextActivityTiming ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span className="font-semibold text-gray-900">
                    {nextActivityTiming.dateLabel}
                  </span>
                  <span className="text-gray-500">·</span>
                  <span className="font-medium text-gray-700">
                    {nextActivityTiming.timeLabel}
                  </span>
                </div>
              ) : (
                <p className="mt-1.5 text-sm font-medium text-gray-600">
                  No upcoming assigned trip sheets.
                </p>
              )}
            </div>

            <div className="border-t border-zinc-200 pt-0.5">
              <span className="text-sm text-gray-500">View Trip</span>
            </div>
          </Link>
            )
          })()
        ))}
      </div>
    </section>
  )
}

export default function AssignedTripsCards({
  trips,
  emptyMessage = 'No trips assigned yet.',
  from,
}: AssignedTripsCardsProps) {
  const ongoingTrips = trips.filter((trip) => trip.status === 'ongoing')
  const upcomingTrips = trips.filter((trip) => trip.status === 'upcoming')

  return (
    <div className="space-y-6">
      {trips.length === 0 ? (
        <div className="app-section-card text-base text-gray-700">
          {emptyMessage}
        </div>
      ) : (
        <>
          <TripSection title="Ongoing" items={ongoingTrips} from={from} />
          <TripSection title="Coming Up" items={upcomingTrips} from={from} />
        </>
      )}
    </div>
  )
}
