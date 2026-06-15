import AdminNav from '@/app/dashboard/AdminNav'
import { requireAdmin } from '@/app/dashboard/lib'
import { getCurrentDateStringInAppTimeZone } from '@/lib/time'
import { getDestinationName, type DestinationRelation } from '@/lib/trip-sheets'

type TripRow = {
  id: string
  workflow_state: string | null
  end_date: string | null
  is_archived: boolean | null
  destination_ref: DestinationRelation
}

type SummaryCardProps = {
  label: string
  value: number
  helpText: string
}

type DestinationCount = {
  destination: string
  upcoming: number
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

function buildDestinationCounts(trips: TripRow[], today: string) {
  const counts = new Map<string, DestinationCount>()

  for (const trip of trips) {
    if (!isOperationalTrip(trip) || !trip.end_date) {
      continue
    }

    const destination = getDestinationName(trip.destination_ref, 'No destination') ?? 'No destination'
    const count =
      counts.get(destination) ?? {
        destination,
        upcoming: 0,
        completed: 0,
        total: 0,
      }

    if (String(trip.end_date) >= today) {
      count.upcoming += 1
    } else {
      count.completed += 1
    }

    count.total = count.upcoming + count.completed
    counts.set(destination, count)
  }

  return Array.from(counts.values()).sort(
    (a, b) => b.total - a.total || a.destination.localeCompare(b.destination)
  )
}

export default async function OverviewPage() {
  const { supabase } = await requireAdmin()
  const today = getCurrentDateStringInAppTimeZone()
  const { data, error } = await supabase
    .from('trips')
    .select('id, workflow_state, end_date, is_archived, destination_ref:destinations(name)')

  const trips = (data as TripRow[] | null) ?? []
  const activeTrips = trips.filter(
    (trip) => trip.workflow_state === 'active' && isUpcomingTrip(trip, today)
  ).length
  const tentativeTrips = trips.filter(
    (trip) => trip.workflow_state === 'tentative' && isUpcomingTrip(trip, today)
  ).length
  const completedTrips = trips.filter((trip) => isCompletedTrip(trip, today)).length
  const totalTrips = activeTrips + tentativeTrips + completedTrips
  const destinationCounts: DestinationCount[] = buildDestinationCounts(trips, today)

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

      {error ? <p className="app-banner-error">{error.message}</p> : null}

      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <SummaryCard
          label="Active Trips"
          value={activeTrips}
          helpText="Active, non-archived trips ending today or later."
        />
        <SummaryCard
          label="Tentative Trips"
          value={tentativeTrips}
          helpText="Tentative, non-archived trips ending today or later."
        />
        <SummaryCard
          label="Completed Trips"
          value={completedTrips}
          helpText="Active or tentative trips that ended before today."
        />
        <SummaryCard
          label="Total Trips"
          value={totalTrips}
          helpText="Active, tentative, and completed operational trips."
        />
      </section>

      <section className="app-section-card">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Trips by Destination</h2>
          <p className="mt-1 text-sm text-gray-600">
            Upcoming and completed trips grouped by destination.
          </p>
        </div>

        {destinationCounts.length === 0 ? (
          <p className="text-sm text-gray-600">No operational trips by destination.</p>
        ) : (
          <div className="app-table-wrap">
            <table className="app-table">
              <thead>
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-700">Destination</th>
                  <th className="w-[8rem] px-4 py-3 font-medium text-gray-700">Upcoming</th>
                  <th className="w-[8rem] px-4 py-3 font-medium text-gray-700">Completed</th>
                  <th className="w-[8rem] px-4 py-3 font-medium text-gray-700">Total</th>
                </tr>
              </thead>
              <tbody>
                {destinationCounts.map((item) => (
                  <tr key={item.destination}>
                    <td className="px-4 py-3 font-medium text-gray-900">{item.destination}</td>
                    <td className="px-4 py-3 text-gray-700">{item.upcoming}</td>
                    <td className="px-4 py-3 text-gray-700">{item.completed}</td>
                    <td className="px-4 py-3 text-gray-700">{item.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
