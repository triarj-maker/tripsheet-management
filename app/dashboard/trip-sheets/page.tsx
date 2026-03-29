import Link from 'next/link'
import { Suspense } from 'react'

import AdminNav from '@/app/dashboard/AdminNav'
import ActionLinkButton from '@/app/components/ActionLinkButton'
import { getDestinationName, type DestinationRelation } from '@/lib/trip-sheets'

import ArchivedToggle from './ArchivedToggle'
import DeleteArchivedTripSheetButton from './DeleteArchivedTripSheetButton'
import FilterSelect from './FilterSelect'
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

type TripSheetRow = {
  id: string
  title: string | null
  destination_id: string | null
  destination_ref: DestinationRelation
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
  role: string | null
}

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const dayInMilliseconds = 24 * 60 * 60 * 1000

function getTodayDateString() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const year = parts.find((part) => part.type === 'year')?.value ?? '0000'
  const month = parts.find((part) => part.type === 'month')?.value ?? '01'
  const day = parts.find((part) => part.type === 'day')?.value ?? '01'

  return `${year}-${month}-${day}`
}

function parseDateString(dateString: string | null) {
  if (!dateString) {
    return null
  }

  const [year, month, day] = dateString.split('-').map(Number)

  if (!year || !month || !day) {
    return null
  }

  return { year, month, day }
}

function toUtcTime(dateString: string | null) {
  const parsedDate = parseDateString(dateString)

  if (!parsedDate) {
    return null
  }

  return Date.UTC(parsedDate.year, parsedDate.month - 1, parsedDate.day)
}

function formatFullDate(dateString: string | null) {
  const parsedDate = parseDateString(dateString)

  if (!parsedDate) {
    return '-'
  }

  return `${parsedDate.day} ${monthNames[parsedDate.month - 1]} ${parsedDate.year}`
}

function formatDateOrRange(startDate: string | null, endDate: string | null) {
  const parsedStartDate = parseDateString(startDate)
  const parsedEndDate = parseDateString(endDate)

  if (!parsedStartDate) {
    return '-'
  }

  if (
    !parsedEndDate ||
    (parsedStartDate.year === parsedEndDate.year &&
      parsedStartDate.month === parsedEndDate.month &&
      parsedStartDate.day === parsedEndDate.day)
  ) {
    return formatFullDate(startDate)
  }

  if (
    parsedStartDate.year === parsedEndDate.year &&
    parsedStartDate.month === parsedEndDate.month
  ) {
    return `${parsedStartDate.day}\u2013${parsedEndDate.day} ${
      monthNames[parsedStartDate.month - 1]
    } ${parsedStartDate.year}`
  }

  if (parsedStartDate.year === parsedEndDate.year) {
    return `${parsedStartDate.day} ${monthNames[parsedStartDate.month - 1]} \u2013 ${
      parsedEndDate.day
    } ${monthNames[parsedEndDate.month - 1]} ${parsedStartDate.year}`
  }

  return `${parsedStartDate.day} ${monthNames[parsedStartDate.month - 1]} ${
    parsedStartDate.year
  } \u2013 ${parsedEndDate.day} ${monthNames[parsedEndDate.month - 1]} ${
    parsedEndDate.year
  }`
}

function getDayDifference(fromDate: string, toDate: string) {
  const fromTime = toUtcTime(fromDate)
  const toTime = toUtcTime(toDate)

  if (fromTime === null || toTime === null) {
    return null
  }

  return Math.round((toTime - fromTime) / dayInMilliseconds)
}

function getStartColumnDisplay(tripSheet: TripSheet, today: string) {
  if (!tripSheet.start_date) {
    return {
      primary: '-',
      secondary: null,
    }
  }

  const endDate = tripSheet.end_date ?? tripSheet.start_date
  const rangeLabel = formatDateOrRange(tripSheet.start_date, endDate)

  if (tripSheet.is_archived || today > endDate) {
    return {
      primary: rangeLabel,
      secondary: 'Completed',
    }
  }

  if (today >= tripSheet.start_date && today <= endDate) {
    return {
      primary: rangeLabel,
      secondary: 'Ongoing',
    }
  }

  const dayDifference = getDayDifference(today, tripSheet.start_date)

  if (dayDifference === null || dayDifference <= 0) {
    return {
      primary: formatFullDate(tripSheet.start_date),
      secondary: 'Starts today',
    }
  }

  if (dayDifference === 1) {
    return {
      primary: formatFullDate(tripSheet.start_date),
      secondary: 'Starts tomorrow',
    }
  }

  return {
    primary: formatFullDate(tripSheet.start_date),
    secondary: `Starts in ${dayDifference} days`,
  }
}

function formatAssignableLabel(resource: ResourceProfile) {
  const baseLabel = resource.full_name ?? 'Unnamed resource'
  const roleLabel = resource.role === 'admin' ? 'Admin' : 'Resource'

  return `${baseLabel} (${roleLabel})`
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
      'id, title, destination_id, destination_ref:destinations(name), start_date, end_date, guest_name, is_archived, created_at, updated_at'
    )

  if (!showArchived) {
    query = query.eq('is_archived', false)
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

  const tripSheets = ((data as TripSheetRow[] | null) ?? []).map((tripSheet) => ({
    ...tripSheet,
    destination: getDestinationName(tripSheet.destination_ref, 'Unknown destination'),
  }))
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
    .select('id, full_name, role')
    .in('role', ['resource', 'admin'])
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

  const normalizedSearchTerm = searchTerm.toLowerCase()

  const filteredTripSheets = tripSheets.filter((tripSheet) => {
    const assignmentSummary = assignmentSummaryByTripSheetId.get(tripSheet.id)
    const hasAssignments = Boolean(assignmentSummary)

    if (normalizedSearchTerm) {
      const matchesSearch = [
        tripSheet.title,
        tripSheet.guest_name,
        tripSheet.destination,
      ].some((value) => value?.toLowerCase().includes(normalizedSearchTerm))

      if (!matchesSearch) {
        return false
      }
    }

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
  const today = getTodayDateString()

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

        <div className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-2.5">
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <Suspense fallback={null}>
                <FilterSelect
                  id="assignment"
                  label="Assignment"
                  value={assignmentFilter}
                  defaultValue="all"
                  options={[
                    { label: 'All', value: 'all' },
                    { label: 'Assigned', value: 'assigned' },
                    { label: 'Unassigned', value: 'unassigned' },
                  ]}
                />
              </Suspense>

              <Suspense fallback={null}>
                <FilterSelect
                  id="resourceId"
                  label="Resource"
                  value={resourceFilterId}
                  options={[
                    { label: 'All resources', value: '' },
                    ...resources.map((resource) => ({
                      label: formatAssignableLabel(resource),
                      value: resource.id,
                    })),
                  ]}
                />
              </Suspense>

              <Suspense fallback={null}>
                <SortSelect value={sortValue} compact />
              </Suspense>
            </div>

            <Suspense fallback={null}>
              <ArchivedToggle checked={showArchived} compact />
            </Suspense>
          </div>
        </div>

        <div className="app-table-wrap">
          <table className="app-table table-fixed">
            <thead>
              <tr>
                <th className="w-[21%] px-3 py-2.5 font-medium text-gray-700">Trip</th>
                <th className="w-[12%] px-3 py-2.5 font-medium text-gray-700">Destination</th>
                <th className="w-[12%] px-3 py-2.5 font-medium text-gray-700">Start</th>
                <th className="w-[15%] px-3 py-2.5 font-medium text-gray-700">Customer</th>
                <th className="w-[23%] px-3 py-2.5 font-medium text-gray-700">
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
                  const startDisplay = getStartColumnDisplay(tripSheet, today)

                  return (
                    <tr
                      key={tripSheet.id}
                      className={`align-top${tripSheet.is_archived ? ' opacity-70' : ''}`}
                    >
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
                      <td className="px-3 py-3 text-gray-900">
                        <div className="min-w-0 space-y-0.5">
                          <p
                            className="truncate text-sm leading-5 text-gray-900"
                            title={startDisplay.primary}
                          >
                            {startDisplay.primary}
                          </p>
                          {startDisplay.secondary ? (
                            <p className="truncate text-xs leading-4 text-gray-500">
                              {startDisplay.secondary}
                            </p>
                          ) : null}
                        </div>
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
