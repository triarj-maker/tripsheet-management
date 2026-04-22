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
import { diffDateStringsInDays, getCurrentDateStringInAppTimeZone } from '@/lib/time'

import ArchiveTripButton from './ArchiveTripButton'
import DeleteTripButton from './DeleteTripButton'
import RestoreTripButton from './RestoreTripButton'
import { requireAdmin } from '../lib'

type TripRow = {
  id: string
  title: string | null
  start_date: string | null
  end_date: string | null
  is_archived: boolean | null
  trip_type: string | null
  destination_id: string | null
  destination_ref: DestinationRelation
  guest_name: string | null
  company: string | null
}

type TripSheetSummaryRow = {
  id: string
  trip_id: string | null
}

type TripsPageProps = {
  searchParams: Promise<{
    error?: string
    showArchived?: string
    showCompleted?: string
  }>
}

type TripListState = 'active' | 'completed' | 'archived'

function formatDate(value: string | null) {
  if (!value) {
    return '-'
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
  const summaryByTripId = new Map<string, { total: number }>()

  for (const tripSheet of tripSheets) {
    if (!tripSheet.trip_id) {
      continue
    }

    const currentSummary = summaryByTripId.get(tripSheet.trip_id) ?? {
      total: 0,
    }

    currentSummary.total += 1

    summaryByTripId.set(tripSheet.trip_id, currentSummary)
  }

  return summaryByTripId
}

function getTripState({
  endDate,
  isArchived,
  today,
}: {
  endDate: string | null
  isArchived: boolean
  today: string
}): TripListState {
  if (isArchived) {
    return 'archived'
  }

  if (endDate && today > endDate) {
    return 'completed'
  }

  return 'active'
}

function getTripStatusLine({
  startDate,
  endDate,
  state,
  today,
}: {
  startDate: string | null
  endDate: string | null
  state: TripListState
  today: string
}) {
  if (state !== 'active') {
    return null
  }

  if (!startDate || !endDate) {
    return null
  }

  const daysUntilStart = diffDateStringsInDays(today, startDate)

  if (startDate <= today && endDate >= today) {
    return 'Ongoing'
  }

  if (startDate > today) {
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
  state,
  today,
}: {
  startDate: string | null
  endDate: string | null
  state: TripListState
  today: string
}) {
  if (state === 'archived') {
    return {
      rank: 4,
      dateValue: startDate ?? '',
      descending: true,
    }
  }

  if (state === 'completed') {
    return {
      rank: 3,
      dateValue: endDate ?? startDate ?? '',
      descending: true,
    }
  }

  if (!startDate || !endDate) {
    return { rank: 2, dateValue: '', descending: false }
  }

  if (startDate <= today && endDate >= today) {
    return {
      rank: 0,
      dateValue: startDate ?? '',
      descending: false,
    }
  }

  if (startDate > today) {
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
  const showCompleted = params.showCompleted === 'true'
  const { supabase } = await requireAdmin()

  const { data: tripData, error } = await supabase
    .from('trips')
    .select(
      'id, title, start_date, end_date, is_archived, trip_type, destination_id, destination_ref:destinations(name), guest_name, company'
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
          .select('id, trip_id')
          .in('trip_id', tripIds)
      : { data: [], error: null }

  const tripSheets = (tripSheetData as TripSheetSummaryRow[] | null) ?? []
  const summaryByTripId = buildTripSummary(tripSheets)
  const today = getCurrentDateStringInAppTimeZone()

  const visibleTrips = trips
    .map((trip) => {
      const summary = summaryByTripId.get(trip.id)
      const childSheetCount = summary?.total ?? 0
      const state = getTripState({
        endDate: trip.end_date,
        isArchived: trip.is_archived === true,
        today,
      })
      const sortMeta = getSortMeta({
        startDate: trip.start_date,
        endDate: trip.end_date,
        state,
        today,
      })

      return {
        ...trip,
        childSheetCount,
        state,
        statusLine: getTripStatusLine({
          startDate: trip.start_date,
          endDate: trip.end_date,
          state,
          today,
        }),
        sortMeta,
      }
    })
    .filter((trip) => {
      if (trip.state === 'archived') {
        return showArchived
      }

      if (trip.state === 'completed') {
        return showCompleted
      }

      return true
    })
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
  const returnParams = new URLSearchParams()

  if (showCompleted) {
    returnParams.set('showCompleted', 'true')
  }

  if (showArchived) {
    returnParams.set('showArchived', 'true')
  }

  const returnQuery = returnParams.toString()
  const returnPath = `/dashboard/trips${returnQuery ? `?${returnQuery}` : ''}`

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
            <div className="flex flex-wrap items-center gap-3">
              <ArchivedToggle
                checked={showCompleted}
                compact
                label="Show Completed"
                queryParam="showCompleted"
              />
              <ArchivedToggle
                checked={showArchived}
                compact
                label="Show Archived"
              />
            </div>
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
              <th className="w-[10%] px-4 py-3 font-medium text-gray-700">Customer</th>
              <th className="w-[8%] px-4 py-3 font-medium text-gray-700">Trip Sheets</th>
              <th className="w-[8%] px-4 py-3 font-medium text-gray-700">State</th>
              <th className="w-[26%] px-4 py-3 font-medium text-gray-700">Actions</th>
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
                  className={`align-top${trip.state === 'archived' ? ' opacity-70' : ''}`}
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
                  <td className="max-w-0 px-4 py-3 text-gray-900">
                    <p
                      className="overflow-hidden text-ellipsis whitespace-nowrap"
                      title={formatGuestCompanySummary(trip)}
                    >
                      {formatGuestCompanySummary(trip)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-gray-900">{trip.childSheetCount}</td>
                  <td className="px-4 py-3 text-gray-900">
                    <span
                      className={
                        trip.state === 'archived'
                          ? 'ui-badge ui-badge-red'
                          : trip.state === 'completed'
                            ? 'ui-badge bg-amber-100 text-amber-700'
                            : 'ui-badge ui-badge-green'
                      }
                    >
                      {trip.state === 'archived'
                        ? 'Archived'
                        : trip.state === 'completed'
                          ? 'Completed'
                          : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      {trip.state === 'archived' ? (
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
