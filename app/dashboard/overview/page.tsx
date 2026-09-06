import Link from 'next/link'

import AdminNav from '@/app/dashboard/AdminNav'
import { requireAdmin } from '@/app/dashboard/lib'
import { getCurrentDateStringInAppTimeZone } from '@/lib/time'
import { getDestinationName, type DestinationRelation } from '@/lib/trip-sheets'

type TripRow = {
  id: string
  title: string | null
  workflow_state: string | null
  start_date: string | null
  end_date: string | null
  is_archived: boolean | null
  destination_id: string | null
  destination_ref: DestinationRelation
}

type TripSheetRow = {
  id: string
  trip_id: string | null
  start_date: string | null
  is_archived: boolean | null
  trip_sheet_assignments: { id: string }[] | null
}

type SummaryCardProps = {
  label: string
  value: number
  helpText: string
}

type DestinationCount = {
  key: string
  destination: string
  active: number
  tentative: number
  completed: number
  total: number
}

function SummaryCard({ label, value, helpText }: SummaryCardProps) {
  return (
    <div className="app-section-card">
      <p className="text-sm font-medium text-gray-600">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-gray-900">{value}</p>
      <p className="mt-2 text-sm text-gray-600">{helpText}</p>
    </div>
  )
}

function isOperationalTrip(trip: TripRow) {
  return (
    trip.is_archived !== true &&
    (trip.workflow_state === 'active' || trip.workflow_state === 'tentative')
  )
}

function isUpcomingTrip(trip: TripRow, today: string) {
  return isOperationalTrip(trip) && Boolean(trip.end_date) && String(trip.end_date) >= today
}

function isCompletedTrip(trip: TripRow, today: string) {
  return isOperationalTrip(trip) && Boolean(trip.end_date) && String(trip.end_date) < today
}

function addDays(dateValue: string, days: number) {
  const [year, month, day] = dateValue.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))

  return date.toISOString().slice(0, 10)
}

function formatDate(value: string | null) {
  if (!value) {
    return 'Date not set'
  }

  const [year, month, day] = value.split('-').map(Number)

  if (!year || !month || !day) {
    return value
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function formatState(trip: TripRow) {
  return trip.workflow_state === 'tentative' ? 'Tentative' : 'Active'
}

function buildDestinationCounts(trips: TripRow[], today: string) {
  const counts = new Map<string, DestinationCount>()

  for (const trip of trips) {
    if (!isOperationalTrip(trip) || !trip.end_date) {
      continue
    }

    const key = trip.destination_id ?? 'no-destination'
    const destination = getDestinationName(trip.destination_ref, 'No destination') ?? 'No destination'
    const count =
      counts.get(key) ?? {
        key,
        destination,
        active: 0,
        tentative: 0,
        completed: 0,
        total: 0,
      }

    if (String(trip.end_date) < today) {
      count.completed += 1
    } else if (trip.workflow_state === 'tentative') {
      count.tentative += 1
    } else {
      count.active += 1
    }

    count.total = count.active + count.tentative + count.completed
    counts.set(key, count)
  }

  return Array.from(counts.values()).sort(
    (a, b) => b.total - a.total || a.destination.localeCompare(b.destination)
  )
}

export default async function OverviewPage() {
  const { supabase } = await requireAdmin()
  const today = getCurrentDateStringInAppTimeZone()
  const thirtyDaysFromToday = addDays(today, 30)
  const { data, error } = await supabase
    .from('trips')
    .select(
      'id, title, workflow_state, start_date, end_date, is_archived, destination_id, destination_ref:destinations(name)'
    )

  const trips = (data as TripRow[] | null) ?? []
  const liveTrips = trips.filter((trip) => isUpcomingTrip(trip, today))
  const liveTripIds = liveTrips.map((trip) => trip.id)
  const { data: tripSheetData, error: tripSheetsError } =
    liveTripIds.length > 0
      ? await supabase
          .from('trip_sheets')
          .select('id, trip_id, start_date, is_archived, trip_sheet_assignments(id)')
          .in('trip_id', liveTripIds)
      : { data: [], error: null }

  const tripSheets = ((tripSheetData as TripSheetRow[] | null) ?? []).filter(
    (tripSheet) => tripSheet.is_archived !== true
  )
  const unassignedTripSheets = tripSheets.filter(
    (tripSheet) =>
      Boolean(tripSheet.start_date) &&
      String(tripSheet.start_date) >= today &&
      (tripSheet.trip_sheet_assignments?.length ?? 0) === 0
  )
  const tripsWithAssignmentGaps = new Set(
    unassignedTripSheets
      .filter((tripSheet) => {
        const parentTrip = liveTrips.find((trip) => trip.id === tripSheet.trip_id)

        return (
          Boolean(parentTrip?.start_date) &&
          String(parentTrip?.start_date) >= today &&
          String(parentTrip?.start_date) <= thirtyDaysFromToday
        )
      })
      .map((tripSheet) => tripSheet.trip_id)
      .filter(Boolean)
  ).size
  const tentativeTripsStartingSoon = liveTrips.filter(
    (trip) =>
      trip.workflow_state === 'tentative' &&
      Boolean(trip.start_date) &&
      String(trip.start_date) >= today &&
      String(trip.start_date) <= thirtyDaysFromToday
  ).length
  const upcomingTrips = liveTrips
    .filter((trip) => Boolean(trip.start_date) && String(trip.start_date) >= today)
    .sort(
      (left, right) =>
        String(left.start_date).localeCompare(String(right.start_date)) ||
        String(left.title ?? '').localeCompare(String(right.title ?? ''))
    )
    .slice(0, 8)
  const activeTrips = trips.filter(
    (trip) => trip.workflow_state === 'active' && isUpcomingTrip(trip, today)
  ).length
  const tentativeTrips = trips.filter(
    (trip) => trip.workflow_state === 'tentative' && isUpcomingTrip(trip, today)
  ).length
  const completedTrips = trips.filter((trip) => isCompletedTrip(trip, today)).length
  const totalTrips = activeTrips + tentativeTrips + completedTrips
  const destinationCounts = buildDestinationCounts(trips, today)
  const queryError = error ?? tripSheetsError

  return (
    <>
      <AdminNav current="overview" />

      <div className="app-page-header">
        <div>
          <h1 className="app-page-title">Overview</h1>
          <p className="app-page-subtitle">
            Admin snapshot of upcoming trips and destination workload.
          </p>
        </div>
      </div>

      {queryError ? <p className="app-banner-error">{queryError.message}</p> : null}

      <section className="mb-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Portfolio Snapshot</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Active Trips" value={activeTrips} helpText="Active, non-archived trips ending today or later." />
          <SummaryCard label="Tentative Trips" value={tentativeTrips} helpText="Tentative, non-archived trips ending today or later." />
          <SummaryCard label="Completed Trips" value={completedTrips} helpText="Active or tentative trips that ended before today." />
          <SummaryCard label="Total Trips" value={totalTrips} helpText="Active, tentative, and completed operational trips." />
        </div>
      </section>

      <section className="mb-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Trips by Destination</h2>
          <p className="mt-1 text-sm text-gray-600">Operational trip mix by destination.</p>
        </div>

        {destinationCounts.length === 0 ? (
          <div className="app-section-card text-sm text-gray-600">No operational trips by destination.</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {destinationCounts.map((item) => (
              <div key={item.key} className="app-section-card">
                <p className="text-sm font-semibold uppercase tracking-wide text-gray-900">{item.destination}</p>
                <p className="mt-3 text-2xl font-semibold text-gray-900">{item.total} <span className="text-sm font-medium text-gray-600">Trips</span></p>
                <dl className="mt-4 space-y-2 border-t border-gray-200 pt-3 text-sm">
                  <div className="flex justify-between gap-4"><dt className="text-gray-600">Active</dt><dd className="font-medium text-gray-900">{item.active}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-gray-600">Tentative</dt><dd className="font-medium text-gray-900">{item.tentative}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-gray-600">Completed</dt><dd className="font-medium text-gray-900">{item.completed}</dd></div>
                </dl>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mb-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Needs Attention</h2>
          <p className="mt-1 text-sm text-gray-600">Operational items that may require follow-up.</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <SummaryCard label="Unassigned Modules" value={unassignedTripSheets.length} helpText="Upcoming modules on live operational trips with no assigned resource." />
          <SummaryCard label="Trips Starting Soon With Gaps" value={tripsWithAssignmentGaps} helpText="Starting within 30 days with one or more unassigned modules." />
          <SummaryCard label="Tentative Trips Starting Soon" value={tentativeTripsStartingSoon} helpText="Tentative trips beginning within the next 30 days." />
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Upcoming Trips</h2>
          <p className="mt-1 text-sm text-gray-600">Next trips in chronological order.</p>
        </div>

        {upcomingTrips.length === 0 ? (
          <div className="app-section-card text-sm text-gray-600">No upcoming operational trips.</div>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {upcomingTrips.map((trip) => (
                <div key={trip.id} className="app-section-card !p-4">
                  <p className="text-xs font-medium text-gray-500">{formatDate(trip.start_date)}</p>
                  <Link href={`/dashboard/trips/${trip.id}`} className="mt-1 block font-semibold text-gray-900 hover:underline">{trip.title ?? 'Untitled trip'}</Link>
                  <div className="mt-2 flex items-center justify-between gap-3 text-sm text-gray-600">
                    <span>{getDestinationName(trip.destination_ref, 'No destination')}</span>
                    <span>{formatState(trip)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="app-table-wrap hidden md:block">
              <table className="app-table">
                <thead><tr><th className="px-4 py-3 font-medium text-gray-700">Date</th><th className="px-4 py-3 font-medium text-gray-700">Trip</th><th className="px-4 py-3 font-medium text-gray-700">Destination</th><th className="px-4 py-3 font-medium text-gray-700">State</th></tr></thead>
                <tbody>
                  {upcomingTrips.map((trip) => (
                    <tr key={trip.id}>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-700">{formatDate(trip.start_date)}</td>
                      <td className="px-4 py-3"><Link href={`/dashboard/trips/${trip.id}`} className="font-medium text-gray-900 hover:underline">{trip.title ?? 'Untitled trip'}</Link></td>
                      <td className="px-4 py-3 text-gray-700">{getDestinationName(trip.destination_ref, 'No destination')}</td>
                      <td className="px-4 py-3 text-gray-700">{formatState(trip)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </>
  )
}
