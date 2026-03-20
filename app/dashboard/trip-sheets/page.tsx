import Link from 'next/link'
import { Suspense } from 'react'

import AdminNav from '@/app/dashboard/AdminNav'
import ActionLinkButton from '@/app/components/ActionLinkButton'

import ArchivedToggle from './ArchivedToggle'
import DeleteArchivedTripSheetButton from './DeleteArchivedTripSheetButton'
import SortSelect from './SortSelect'
import UnarchiveTripSheetButton from './UnarchiveTripSheetButton'
import { requireAdmin } from './lib'

type TripSheet = {
  id: string
  title: string | null
  destination: string | null
  start_date: string | null
  end_date: string | null
  guest_name: string | null
  is_archived: boolean | null
  created_at: string | null
  updated_at: string | null
}

type Assignment = {
  trip_sheet_id: string
  resource_user_id: string
}

type ResourceProfile = {
  id: string
  full_name: string | null
}

type TripSheetsPageProps = {
  searchParams: Promise<{
    error?: string
    showArchived?: string
    q?: string
    assignment?: string
    resourceId?: string
    sort?: string
  }>
}

function getSortValue(value: string | undefined) {
  switch (value) {
    case 'created_asc':
    case 'start_asc':
    case 'start_desc':
      return value
    default:
      return 'created_desc'
  }
}

function formatValue(value: string | boolean | null) {
  if (value === null) {
    return '-'
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }

  return value
}

export default async function TripSheetsPage({
  searchParams,
}: TripSheetsPageProps) {
  const params = await searchParams
  const showArchived = params.showArchived === 'true'
  const searchTerm = params.q?.trim() ?? ''
  const assignmentFilter =
    params.assignment === 'assigned' || params.assignment === 'unassigned'
      ? params.assignment
      : 'all'
  const resourceFilterId = params.resourceId?.trim() ?? ''
  const sortValue = getSortValue(params.sort)
  const { supabase } = await requireAdmin()

  let query = supabase
    .from('trip_sheets')
    .select(
      'id, title, destination, start_date, end_date, guest_name, is_archived, created_at, updated_at'
    )

  if (!showArchived) {
    query = query.eq('is_archived', false)
  }

  if (searchTerm) {
    query = query.or(
      `title.ilike.%${searchTerm}%,guest_name.ilike.%${searchTerm}%,destination.ilike.%${searchTerm}%`
    )
  }

  if (sortValue === 'created_asc') {
    query = query.order('created_at', { ascending: true })
  } else if (sortValue === 'start_asc') {
    query = query.order('start_date', { ascending: true })
  } else if (sortValue === 'start_desc') {
    query = query.order('start_date', { ascending: false })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  const { data, error } = await query

  const tripSheets = (data as TripSheet[] | null) ?? []
  const tripSheetIds = tripSheets.map((tripSheet) => tripSheet.id)
  const { data: assignmentData, error: assignmentError } =
    tripSheetIds.length > 0
      ? await supabase
          .from('trip_sheet_assignments')
          .select('trip_sheet_id, resource_user_id')
          .in('trip_sheet_id', tripSheetIds)
          .order('assigned_at', { ascending: true })
      : { data: [], error: null }

  const assignments = (assignmentData as Assignment[] | null) ?? []
  const { data: resourceData, error: resourceError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'resource')
    .order('full_name', { ascending: true })

  const resources = (resourceData as ResourceProfile[] | null) ?? []
  const resourceNamesById = new Map(
    resources.map((resource) => [resource.id, resource.full_name ?? 'Unnamed resource'])
  )
  const assignmentSummaryByTripSheetId = new Map<
    string,
    {
      count: number
      names: string[]
    }
  >()

  for (const assignment of assignments) {
    const currentSummary = assignmentSummaryByTripSheetId.get(assignment.trip_sheet_id) ?? {
      count: 0,
      names: [],
    }

    currentSummary.count += 1
    currentSummary.names.push(
      resourceNamesById.get(assignment.resource_user_id) ?? 'Unnamed resource'
    )
    assignmentSummaryByTripSheetId.set(assignment.trip_sheet_id, currentSummary)
  }

  const filteredTripSheets = tripSheets.filter((tripSheet) => {
    const assignmentSummary = assignmentSummaryByTripSheetId.get(tripSheet.id)
    const hasAssignments = Boolean(assignmentSummary)

    if (assignmentFilter === 'assigned' && !hasAssignments) {
      return false
    }

    if (assignmentFilter === 'unassigned' && hasAssignments) {
      return false
    }

    if (
      resourceFilterId &&
      !assignments.some(
        (assignment) =>
          assignment.trip_sheet_id === tripSheet.id &&
          assignment.resource_user_id === resourceFilterId
      )
    ) {
      return false
    }

    return true
  })
  const assignmentVisibilityError = assignmentError?.message || resourceError?.message || null

  return (
    <>
      <AdminNav current="trip-sheets" />

        <div className="app-page-header">
          <div>
            <h1 className="app-page-title">Trip Sheets</h1>
            <p className="app-page-subtitle">
              Track trips, assignments, and archived records in one place.
            </p>
          </div>

          <ActionLinkButton
            href="/dashboard/trip-sheets/new"
            idleLabel="Create Trip Sheet"
            pendingLabel="Creating…"
            className="ui-button-primary"
          />
        </div>

        {error ? (
          <p className="app-banner-error">
            {error.message}
          </p>
        ) : null}

        {params.error ? (
          <p className="app-banner-error">
            {params.error}
          </p>
        ) : null}

        {assignmentVisibilityError ? (
          <p className="app-banner-error">
            {assignmentVisibilityError}
          </p>
        ) : null}

        <div className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <form className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[minmax(18rem,2fr)_11rem_12rem_auto_auto]">
              {showArchived ? (
                <input type="hidden" name="showArchived" value="true" />
              ) : null}

              <div className="sm:col-span-2 lg:col-span-4 xl:col-span-1">
                <label htmlFor="q" className="ui-label-compact">
                  Search
                </label>
                <input
                  id="q"
                  name="q"
                  type="search"
                  aria-label="Search"
                  defaultValue={searchTerm}
                  placeholder="Search trip, customer, or destination"
                  className="ui-input ui-input-compact"
                />
              </div>

              <div>
                <label htmlFor="assignment" className="ui-label-compact">
                  Assignment
                </label>
                <select
                  id="assignment"
                  name="assignment"
                  defaultValue={assignmentFilter}
                  className="ui-select ui-select-compact"
                >
                  <option value="all">All</option>
                  <option value="assigned">Assigned</option>
                  <option value="unassigned">Unassigned</option>
                </select>
              </div>

              <div>
                <label htmlFor="resourceId" className="ui-label-compact">
                  Resource
                </label>
                <select
                  id="resourceId"
                  name="resourceId"
                  defaultValue={resourceFilterId}
                  className="ui-select ui-select-compact"
                >
                  <option value="">All resources</option>
                  {resources.map((resource) => (
                    <option key={resource.id} value={resource.id}>
                      {resource.full_name ?? 'Unnamed resource'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end gap-2">
                <button
                  type="submit"
                  className="ui-button ui-button-secondary ui-button-compact w-full sm:w-auto"
                >
                  Apply Filters
                </button>
                <Link
                  href={showArchived ? '/dashboard/trip-sheets?showArchived=true' : '/dashboard/trip-sheets'}
                  className="ui-button ui-button-secondary ui-button-compact w-full sm:w-auto"
                >
                  Clear
                </Link>
              </div>
            </form>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[12.5rem_auto]">
              <Suspense fallback={null}>
                <SortSelect value={sortValue} compact />
              </Suspense>

              <div>
                <p className="ui-label-compact">Archived</p>
                <Suspense fallback={null}>
                  <ArchivedToggle
                    checked={showArchived}
                    compact
                    className="min-h-[2.375rem] rounded-lg border border-zinc-200 bg-white px-3 py-2"
                  />
                </Suspense>
              </div>
            </div>
          </div>
        </div>

        <div className="app-table-wrap">
          <table className="app-table table-fixed">
            <thead>
              <tr>
                <th className="w-[21%] px-3 py-2.5 font-medium text-gray-700">Trip</th>
                <th className="w-[13%] px-3 py-2.5 font-medium text-gray-700">Destination</th>
                <th className="w-[9%] px-3 py-2.5 font-medium text-gray-700">Start</th>
                <th className="w-[16%] px-3 py-2.5 font-medium text-gray-700">Customer</th>
                <th className="w-[24%] px-3 py-2.5 font-medium text-gray-700">
                  Staff
                </th>
                <th className="w-[17%] px-3 py-2.5 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTripSheets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-gray-700">
                    No trip sheets found.
                  </td>
                </tr>
              ) : (
                filteredTripSheets.map((tripSheet) => {
                  const assignmentSummary = assignmentSummaryByTripSheetId.get(tripSheet.id)

                  return (
                    <tr key={tripSheet.id} className="align-top">
                      <td className="px-3 py-3 text-gray-900">
                        <div className="min-w-0">
                          <p
                            className="truncate text-[15px] font-semibold leading-5 text-gray-900"
                            title={formatValue(tripSheet.title)}
                          >
                            {formatValue(tripSheet.title)}
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-gray-900">
                        <p className="truncate" title={formatValue(tripSheet.destination)}>
                          {formatValue(tripSheet.destination)}
                        </p>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-gray-900">
                        {formatValue(tripSheet.start_date)}
                      </td>
                      <td className="px-3 py-3 text-gray-900">
                        <p className="truncate" title={formatValue(tripSheet.guest_name)}>
                          {formatValue(tripSheet.guest_name)}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-gray-900">
                        {assignmentSummary ? (
                          <div className="min-w-0 space-y-1">
                            <p className="leading-none">
                              <span className="ui-badge ui-badge-green">
                                {assignmentSummary.count} assigned
                              </span>
                            </p>
                            <p
                              className="truncate text-sm leading-5 text-gray-700"
                              title={assignmentSummary.names.join(', ')}
                            >
                              {assignmentSummary.names.join(', ')}
                            </p>
                          </div>
                        ) : (
                          <span className="ui-badge ui-badge-red">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          {tripSheet.is_archived ? (
                            <>
                              <Link
                                href={`/trip-sheets/${tripSheet.id}`}
                                className="ui-button ui-button-neutral ui-button-compact"
                              >
                                View
                              </Link>
                              <UnarchiveTripSheetButton tripSheetId={tripSheet.id} />
                              <DeleteArchivedTripSheetButton tripSheetId={tripSheet.id} />
                            </>
                          ) : (
                            <>
                              <Link
                                href={`/dashboard/trip-sheets/${tripSheet.id}/edit`}
                                className="ui-button ui-button-primary ui-button-compact"
                              >
                                Edit
                              </Link>
                              <Link
                                href={`/trip-sheets/${tripSheet.id}`}
                                className="ui-button ui-button-neutral ui-button-compact"
                              >
                                View
                              </Link>
                              <ActionLinkButton
                                href={`/dashboard/trip-sheets/new?duplicateFrom=${tripSheet.id}`}
                                idleLabel="Duplicate"
                                pendingLabel="Duplicating…"
                                className="ui-button-secondary ui-button-compact"
                              />
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
    </>
  )
}
