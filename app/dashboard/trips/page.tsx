import Link from 'next/link'
import { Suspense } from 'react'

import AdminNav from '@/app/dashboard/AdminNav'
import ActionLinkButton from '@/app/components/ActionLinkButton'
import ArchivedToggle from '@/app/dashboard/trip-sheets/ArchivedToggle'
import {
  formatTripTypeLabel,
  getDestinationName,
  type DestinationRelation,
} from '@/lib/trip-sheets'

import ArchiveTripButton from './ArchiveTripButton'
import DeleteTripButton from './DeleteTripButton'
import RestoreTripButton from './RestoreTripButton'
import { requireAdmin } from '../lib'

type TripRow = {
  id: string
  title: string | null
  start_date: string | null
  end_date: string | null
  trip_type: string | null
  destination_id: string | null
  destination_ref: DestinationRelation
  guest_name: string | null
  company: string | null
}

type TripSheetSummaryRow = {
  id: string
  trip_id: string | null
  is_archived: boolean | null
}

type TripsPageProps = {
  searchParams: Promise<{
    error?: string
    showArchived?: string
  }>
}

function parseDate(value: string | null) {
  if (!value) {
    return null
  }

  const [year, month, day] = value.split('-').map(Number)

  if (!year || !month || !day) {
    return null
  }

  return new Date(Date.UTC(year, month - 1, day))
}

function formatDate(value: string | null) {
  const date = parseDate(value)

  if (!date) {
    return '-'
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function diffInDays(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / 86400000)
}

function formatGuestCompanySummary(trip: Pick<TripRow, 'guest_name' | 'company'>) {
  const guestName = trip.guest_name?.trim() ?? ''
  const company = trip.company?.trim() ?? ''

  if (guestName && company) {
    return `${guestName} · ${company}`
  }

  if (guestName) {
    return guestName
  }

  if (company) {
    return company
  }

  return '-'
}

function buildTripSummary(tripSheets: TripSheetSummaryRow[]) {
  const summaryByTripId = new Map<
    string,
    {
      total: number
      active: number
    }
  >()

  for (const tripSheet of tripSheets) {
    if (!tripSheet.trip_id) {
      continue
    }

    const currentSummary = summaryByTripId.get(tripSheet.trip_id) ?? {
      total: 0,
      active: 0,
    }

    currentSummary.total += 1

    if (!tripSheet.is_archived) {
      currentSummary.active += 1
    }

    summaryByTripId.set(tripSheet.trip_id, currentSummary)
  }

  return summaryByTripId
}

function getTripStatusLine({
  startDate,
  endDate,
  isArchived,
  todayUtc,
}: {
  startDate: string | null
  endDate: string | null
  isArchived: boolean
  todayUtc: Date
}) {
  if (isArchived) {
    return null
  }

  const parsedStartDate = parseDate(startDate)
  const parsedEndDate = parseDate(endDate)

  if (!parsedStartDate || !parsedEndDate) {
    return null
  }

  const daysUntilStart = diffInDays(todayUtc, parsedStartDate)

  if (parsedStartDate <= todayUtc && parsedEndDate >= todayUtc) {
    return 'Ongoing'
  }

  if (parsedStartDate > todayUtc) {
    if (daysUntilStart === 0) {
      return 'Starts today'
    }

    if (daysUntilStart === 1) {
      return 'Starts tomorrow'
    }

    return `Starts in ${daysUntilStart} days`
  }

  return null
}

function getSortMeta({
  startDate,
  endDate,
  isArchived,
  todayUtc,
}: {
  startDate: string | null
  endDate: string | null
  isArchived: boolean
  todayUtc: Date
}) {
  if (isArchived) {
    return {
      rank: 4,
      dateValue: startDate ?? '',
      descending: true,
    }
  }

  const parsedStartDate = parseDate(startDate)
  const parsedEndDate = parseDate(endDate)

  if (!parsedStartDate || !parsedEndDate) {
    return {
      rank: 3,
      dateValue: '',
      descending: false,
    }
  }

  if (parsedStartDate <= todayUtc && parsedEndDate >= todayUtc) {
    return {
      rank: 0,
      dateValue: startDate ?? '',
      descending: false,
    }
  }

  if (parsedStartDate > todayUtc) {
    return {
      rank: 1,
      dateValue: startDate ?? '',
      descending: false,
    }
  }

  return {
    rank: 2,
    dateValue: startDate ?? '',
    descending: true,
  }
}

export default async function TripsPage({ searchParams }: TripsPageProps) {
  const params = await searchParams
  const showArchived = params.showArchived === 'true'
  const { supabase } = await requireAdmin()

  const { data: tripData, error } = await supabase
    .from('trips')
    .select(
      'id, title, start_date, end_date, trip_type, destination_id, destination_ref:destinations(name), guest_name, company'
    )

  const trips = ((tripData as TripRow[] | null) ?? []).map((trip) => ({
    ...trip,
    destination:
      getDestinationName(trip.destination_ref, 'Unknown destination') ??
      'Unknown destination',
  }))
  const tripIds = trips.map((trip) => trip.id)

  const { data: tripSheetData, error: tripSheetsError } =
    tripIds.length > 0
      ? await supabase
          .from('trip_sheets')
          .select('id, trip_id, is_archived')
          .in('trip_id', tripIds)
      : { data: [], error: null }

  const tripSheets = (tripSheetData as TripSheetSummaryRow[] | null) ?? []
  const summaryByTripId = buildTripSummary(tripSheets)
  const today = new Date()
  const todayUtc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  )

  const visibleTrips = trips
    .map((trip) => {
      const summary = summaryByTripId.get(trip.id)
      const childSheetCount = summary?.total ?? 0
      const isArchived = childSheetCount > 0 && (summary?.active ?? 0) === 0
      const sortMeta = getSortMeta({
        startDate: trip.start_date,
        endDate: trip.end_date,
        isArchived,
        todayUtc,
      })

      return {
        ...trip,
        childSheetCount,
        isArchived,
        statusLine: getTripStatusLine({
          startDate: trip.start_date,
          endDate: trip.end_date,
          isArchived,
          todayUtc,
        }),
        sortMeta,
      }
    })
    .filter((trip) => showArchived || !trip.isArchived)
    .sort((left, right) => {
      if (left.sortMeta.rank !== right.sortMeta.rank) {
        return left.sortMeta.rank - right.sortMeta.rank
      }

      if (left.sortMeta.dateValue !== right.sortMeta.dateValue) {
        if (left.sortMeta.descending) {
          return right.sortMeta.dateValue.localeCompare(left.sortMeta.dateValue)
        }

        return left.sortMeta.dateValue.localeCompare(right.sortMeta.dateValue)
      }

      return (left.title ?? '').localeCompare(right.title ?? '')
    })

  const errorMessage = error?.message || tripSheetsError?.message || null
  const returnPath = `/dashboard/trips${showArchived ? '?showArchived=true' : ''}`

  return (
    <>
      <AdminNav current="trips" />

      <div className="app-page-header">
        <div>
          <h1 className="app-page-title">Trips</h1>
          <p className="app-page-subtitle">
            Manage top-level trips and drill into their child trip sheets.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Suspense fallback={null}>
            <ArchivedToggle
              checked={showArchived}
              compact
              label="Show Archived"
            />
          </Suspense>

          <ActionLinkButton
            href="/dashboard/trips/new"
            idleLabel="Create Trip"
            pendingLabel="Creating…"
            className="ui-button-primary"
          />
        </div>
      </div>

      {params.error ? <p className="app-banner-error">{params.error}</p> : null}
      {errorMessage ? <p className="app-banner-error">{errorMessage}</p> : null}

      <div className="app-table-wrap">
        <table className="app-table table-fixed">
          <thead>
            <tr>
              <th className="w-[20%] px-4 py-3 font-medium text-gray-700">Trip</th>
              <th className="w-[14%] px-4 py-3 font-medium text-gray-700">Start</th>
              <th className="w-[12%] px-4 py-3 font-medium text-gray-700">Type</th>
              <th className="w-[14%] px-4 py-3 font-medium text-gray-700">Destination</th>
              <th className="w-[16%] px-4 py-3 font-medium text-gray-700">Customer</th>
              <th className="w-[8%] px-4 py-3 font-medium text-gray-700">Trip Sheets</th>
              <th className="w-[8%] px-4 py-3 font-medium text-gray-700">State</th>
              <th className="w-[20%] px-4 py-3 font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleTrips.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-4 text-gray-700">
                  No trips created yet.
                </td>
              </tr>
            ) : (
              visibleTrips.map((trip) => (
                <tr
                  key={trip.id}
                  className={`align-top${trip.isArchived ? ' opacity-70' : ''}`}
                >
                  <td className="px-4 py-3 text-gray-900">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold leading-5 text-gray-900">
                        {trip.title ?? 'Untitled trip'}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    <p className="truncate">{formatDate(trip.start_date)}</p>
                    {trip.statusLine ? (
                      <p
                        className={`mt-0.5 truncate text-xs ${
                          trip.statusLine === 'Ongoing' ? 'text-red-600' : 'text-gray-500'
                        }`}
                      >
                        {trip.statusLine}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    {formatTripTypeLabel(trip.trip_type)}
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    <p className="truncate">{trip.destination}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    <p className="truncate" title={formatGuestCompanySummary(trip)}>
                      {formatGuestCompanySummary(trip)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-gray-900">{trip.childSheetCount}</td>
                  <td className="px-4 py-3 text-gray-900">
                    <span
                      className={
                        trip.isArchived
                          ? 'ui-badge ui-badge-red'
                          : trip.childSheetCount === 0
                            ? 'ui-badge bg-zinc-100 text-zinc-700'
                            : 'ui-badge ui-badge-green'
                      }
                    >
                      {trip.childSheetCount === 0
                        ? 'Open'
                        : trip.isArchived
                          ? 'Archived'
                          : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      {trip.isArchived ? (
                        <>
                          <DeleteTripButton tripId={trip.id} returnPath={returnPath} />
                          <ActionLinkButton
                            href={`/dashboard/trips/new?cloneFrom=${trip.id}`}
                            idleLabel="Clone"
                            pendingLabel="Opening…"
                            className="ui-button-neutral ui-button-compact whitespace-nowrap"
                          />
                          <RestoreTripButton tripId={trip.id} returnPath={returnPath} />
                        </>
                      ) : (
                        <>
                          <Link
                            href={`/dashboard/trips/${trip.id}`}
                            className="ui-button ui-button-secondary ui-button-compact whitespace-nowrap"
                          >
                            Open
                          </Link>
                          <ActionLinkButton
                            href={`/dashboard/trips/new?cloneFrom=${trip.id}`}
                            idleLabel="Clone"
                            pendingLabel="Opening…"
                            className="ui-button-neutral ui-button-compact whitespace-nowrap"
                          />
                          <ArchiveTripButton tripId={trip.id} returnPath={returnPath} />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
