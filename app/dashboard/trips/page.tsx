import Link from 'next/link'
import { Suspense } from 'react'

import AdminNav from '@/app/dashboard/AdminNav'
import ActionLinkButton from '@/app/components/ActionLinkButton'
import ArchivedToggle from '@/app/dashboard/trip-sheets/ArchivedToggle'
import FilterSelect from '@/app/dashboard/trip-sheets/FilterSelect'
import { getConflictingTripSheetIds } from '@/app/dashboard/calendar/conflicts'
import {
  formatTripTypeLabel,
  getDestinationName,
  type DestinationRelation,
} from '@/lib/trip-sheets'
import { diffDateStringsInDays, getCurrentDateStringInAppTimeZone } from '@/lib/time'
import {
  formatVisibleTripStateLabel,
  getVisibleTripState,
  type VisibleTripState,
} from '@/lib/trip-workflow'

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
  workflow_state: string | null
  trip_type: string | null
  destination_id: string | null
  destination_ref: DestinationRelation
  company_id: string | null
  school_id: string | null
}

type TripSheetSummaryRow = {
  id: string
  trip_id: string | null
  start_date: string | null
  start_time: string | null
  end_date: string | null
  end_time: string | null
  is_archived: boolean | null
  trip_sheet_assignments?: { id: string; resource_user_id: string }[] | null
}

type LookupOption = {
  id: string
  name: string | null
}

type TripsPageProps = {
  searchParams: Promise<{
    company_id?: string
    error?: string
    school_id?: string
    showArchived?: string
    showCompleted?: string
  }>
}

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

function buildTripSummary(
  tripSheets: TripSheetSummaryRow[],
  conflictingTripSheetIds: Set<string>
) {
  const summaryByTripId = new Map<
    string,
    { total: number; unassigned: number; hasConflict: boolean }
  >()

  for (const tripSheet of tripSheets) {
    if (!tripSheet.trip_id) {
      continue
    }

    const currentSummary = summaryByTripId.get(tripSheet.trip_id) ?? {
      total: 0,
      unassigned: 0,
      hasConflict: false,
    }

    currentSummary.total += 1
    if ((tripSheet.trip_sheet_assignments ?? []).length === 0) {
      currentSummary.unassigned += 1
    }
    if (conflictingTripSheetIds.has(tripSheet.id)) {
      currentSummary.hasConflict = true
    }

    summaryByTripId.set(tripSheet.trip_id, currentSummary)
  }

  return summaryByTripId
}

function getTripStatusLine({
  startDate,
  endDate,
  state,
  today,
}: {
  startDate: string | null
  endDate: string | null
  state: VisibleTripState
  today: string
}) {
  if (state === 'completed' || state === 'archived') {
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
  state: VisibleTripState
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
    return { rank: 1, dateValue: '', descending: false }
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
  const selectedCompanyId = params.company_id?.trim() ?? ''
  const selectedSchoolId = params.school_id?.trim() ?? ''
  const { supabase } = await requireAdmin()

  let tripQuery = supabase
    .from('trips')
    .select(
      'id, title, start_date, end_date, is_archived, workflow_state, trip_type, destination_id, destination_ref:destinations(name), company_id, school_id, company_ref:companies(name), school_ref:schools(name)'
    )

  if (selectedCompanyId) {
    tripQuery = tripQuery.eq('company_id', selectedCompanyId)
  }

  if (selectedSchoolId) {
    tripQuery = tripQuery.eq('school_id', selectedSchoolId)
  }

  const { data: tripData, error } = await tripQuery

  const { data: companyData, error: companiesError } = await supabase
    .from('companies')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true })

  const { data: schoolData, error: schoolsError } = await supabase
    .from('schools')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true })

  const companies = (companyData as LookupOption[] | null) ?? []
  const schools = (schoolData as LookupOption[] | null) ?? []
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
          .select(
            'id, trip_id, start_date, start_time, end_date, end_time, is_archived, trip_sheet_assignments(id, resource_user_id)'
          )
          .in('trip_id', tripIds)
      : { data: [], error: null }

  const tripSheets = (tripSheetData as TripSheetSummaryRow[] | null) ?? []
  const conflictTripIds = new Set(
    trips.filter((trip) => trip.is_archived !== true).map((trip) => trip.id)
  )
  const conflictTripSheets = tripSheets.filter(
    (tripSheet) =>
      tripSheet.trip_id &&
      conflictTripIds.has(tripSheet.trip_id) &&
      tripSheet.is_archived !== true
  )
  const tripSheetAssignments = conflictTripSheets.flatMap((tripSheet) =>
    (tripSheet.trip_sheet_assignments ?? []).map((assignment) => ({
      trip_sheet_id: tripSheet.id,
      resource_user_id: assignment.resource_user_id,
    }))
  )
  const conflictingTripSheetIds = getConflictingTripSheetIds(
    conflictTripSheets,
    tripSheetAssignments
  )
  const summaryByTripId = buildTripSummary(tripSheets, conflictingTripSheetIds)
  const today = getCurrentDateStringInAppTimeZone()

  const visibleTrips = trips
    .map((trip) => {
      const summary = summaryByTripId.get(trip.id)
      const childSheetCount = summary?.total ?? 0
      const unassignedChildSheetCount = summary?.unassigned ?? 0
      const hasChildSheetConflict = summary?.hasConflict ?? false
      const state = getVisibleTripState({
        workflowState: trip.workflow_state,
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
        unassignedChildSheetCount,
        hasChildSheetConflict,
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

  const errorMessage =
    error?.message ||
    companiesError?.message ||
    schoolsError?.message ||
    tripSheetsError?.message ||
    null
  const returnParams = new URLSearchParams()

  if (selectedCompanyId) {
    returnParams.set('company_id', selectedCompanyId)
  }

  if (selectedSchoolId) {
    returnParams.set('school_id', selectedSchoolId)
  }

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

        <div className="flex w-full flex-wrap items-end justify-between gap-3 lg:w-auto">
          <div className="flex flex-wrap items-center gap-3">
            <Suspense fallback={null}>
              <div className="flex flex-wrap items-center gap-3">
                <FilterSelect
                  id="company_id"
                  label="Company"
                  value={selectedCompanyId}
                  options={[
                    { label: 'All Companies', value: '' },
                    ...companies.map((company) => ({
                      label: company.name ?? company.id,
                      value: company.id,
                    })),
                  ]}
                />
                <FilterSelect
                  id="school_id"
                  label="School"
                  value={selectedSchoolId}
                  options={[
                    { label: 'All Schools', value: '' },
                    ...schools.map((school) => ({
                      label: school.name ?? school.id,
                      value: school.id,
                    })),
                  ]}
                />
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
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <ActionLinkButton
              href="/dashboard/trips/new"
              idleLabel="New Trip"
              pendingLabel="Creating…"
              className="ui-button-primary"
            />
            <ActionLinkButton
              href="/dashboard/trips/clone"
              idleLabel="Clone Trip"
              pendingLabel="Opening…"
              className="ui-button-secondary"
            />
          </div>
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
              <th className="w-[12%] px-4 py-3 font-medium text-gray-700">Trip Sheets</th>
              <th className="w-[8%] px-4 py-3 font-medium text-gray-700">State</th>
              <th className="w-[20%] px-4 py-3 font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleTrips.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-4 text-gray-700">
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
                  <td className="px-4 py-3 text-gray-900">
                    <p className="font-medium leading-5">{trip.childSheetCount}</p>
                    {trip.unassignedChildSheetCount > 0 ||
                    trip.hasChildSheetConflict ? (
                      <p className="mt-0.5 whitespace-nowrap text-xs font-medium leading-4">
                        {trip.unassignedChildSheetCount > 0 ? (
                          <span className="text-red-600">
                            {trip.unassignedChildSheetCount} unassigned
                          </span>
                        ) : null}
                        {trip.unassignedChildSheetCount > 0 &&
                        trip.hasChildSheetConflict ? (
                          <span className="px-1 text-gray-400">·</span>
                        ) : null}
                        {trip.hasChildSheetConflict ? (
                          <span
                            className="text-amber-600"
                            title="Scheduling conflict detected"
                          >
                            ⚠
                          </span>
                        ) : null}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    <span
                      className={
                        trip.state === 'archived'
                          ? 'ui-badge ui-badge-red'
                          : trip.state === 'completed'
                            ? 'ui-badge bg-amber-100 text-amber-700'
                            : trip.state === 'tentative'
                              ? 'ui-badge bg-slate-100 text-slate-700'
                            : 'ui-badge ui-badge-green'
                      }
                    >
                      {formatVisibleTripStateLabel(trip.state)}
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
