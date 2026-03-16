import Link from 'next/link'

import AdminNav from '@/app/dashboard/AdminNav'

import ArchivedToggle from './ArchivedToggle'
import SortSelect from './SortSelect'
import { requireAdmin } from './lib'

type TripSheet = {
  id: string
  title: string | null
  destination: string | null
  start_date: string | null
  end_date: string | null
  guest_name: string | null
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
    .select('id, title, destination, start_date, end_date, guest_name, created_at, updated_at')

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
    <main className="min-h-screen bg-zinc-100 px-4 py-12">
      <div className="mx-auto max-w-5xl rounded-2xl bg-white p-8 shadow-sm">
        <AdminNav current="trip-sheets" />

        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-gray-900">Trip Sheets</h1>

          <Link
            href="/dashboard/trip-sheets/new"
            className="rounded border border-gray-900 bg-gray-900 px-3 py-2 text-sm font-medium text-white"
          >
            Create Trip Sheet
          </Link>
        </div>

        {error ? (
          <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error.message}
          </p>
        ) : null}

        {params.error ? (
          <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {params.error}
          </p>
        ) : null}

        {assignmentVisibilityError ? (
          <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {assignmentVisibilityError}
          </p>
        ) : null}

        <div className="mb-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
            <form className="space-y-5">
              {showArchived ? (
                <input type="hidden" name="showArchived" value="true" />
              ) : null}

              <section className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
                  Search
                </h2>
                <input
                  id="q"
                  name="q"
                  type="search"
                  aria-label="Search"
                  defaultValue={searchTerm}
                  placeholder="Search title, guest, or destination"
                  className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400"
                />
              </section>

              <section className="space-y-3 border-t border-zinc-200 pt-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label
                      htmlFor="assignment"
                      className="mb-1 block text-sm font-medium text-gray-700"
                    >
                      Assignment
                    </label>
                    <select
                      id="assignment"
                      name="assignment"
                      defaultValue={assignmentFilter}
                      className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-gray-900"
                    >
                      <option value="all">All</option>
                      <option value="assigned">Assigned</option>
                      <option value="unassigned">Unassigned</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="resourceId"
                      className="mb-1 block text-sm font-medium text-gray-700"
                    >
                      Resource
                    </label>
                    <select
                      id="resourceId"
                      name="resourceId"
                      defaultValue={resourceFilterId}
                      className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-gray-900"
                    >
                      <option value="">All resources</option>
                      {resources.map((resource) => (
                        <option key={resource.id} value={resource.id}>
                          {resource.full_name ?? 'Unnamed resource'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <p className="mb-1 text-sm font-medium text-gray-700">Archived</p>
                    <ArchivedToggle checked={showArchived} className="rounded bg-white px-3 py-2" />
                  </div>
                </div>
              </section>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-gray-900"
                >
                  Apply Filters
                </button>
                <Link
                  href={showArchived ? '/dashboard/trip-sheets?showArchived=true' : '/dashboard/trip-sheets'}
                  className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-gray-900"
                >
                  Clear
                </Link>
              </div>
            </form>

            <section className="space-y-3 border-t border-zinc-200 pt-4 lg:border-t-0 lg:border-l lg:pl-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
                Sort
              </h2>
              <SortSelect value={sortValue} />
            </section>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="w-[18rem] px-4 py-3 font-medium text-gray-700">Trip</th>
                <th className="w-[16rem] px-4 py-3 font-medium text-gray-700">Destination</th>
                <th className="w-[9rem] px-4 py-3 font-medium text-gray-700">Start</th>
                <th className="w-[14rem] px-4 py-3 font-medium text-gray-700">Customer</th>
                <th className="min-w-[20rem] px-4 py-3 font-medium text-gray-700">
                  Staff
                </th>
                <th className="w-[15rem] px-4 py-3 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTripSheets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-5 text-gray-700">
                    No trip sheets found.
                  </td>
                </tr>
              ) : (
                filteredTripSheets.map((tripSheet) => {
                  const assignmentSummary = assignmentSummaryByTripSheetId.get(tripSheet.id)

                  return (
                  <tr
                    key={tripSheet.id}
                    className="border-b border-zinc-100 align-top transition-colors hover:bg-zinc-50"
                  >
                    <td className="px-4 py-4 text-gray-900">
                      <div className="max-w-full space-y-1">
                        <p className="text-[15px] font-semibold leading-6 whitespace-normal break-words text-gray-900">
                          {formatValue(tripSheet.title)}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-gray-900">
                      {formatValue(tripSheet.destination)}
                    </td>
                      <td className="px-4 py-4 whitespace-nowrap text-gray-900">
                        {formatValue(tripSheet.start_date)}
                      </td>
                      <td className="px-4 py-4 text-gray-900">
                        {formatValue(tripSheet.guest_name)}
                      </td>
                      <td className="px-4 py-4 text-gray-900">
                        {assignmentSummary ? (
                          <div className="space-y-1">
                            <p>
                              <span className="inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                                {assignmentSummary.count} assigned
                              </span>
                            </p>
                            <p className="text-sm leading-6 text-gray-700">
                              {assignmentSummary.names.join(', ')}
                            </p>
                          </div>
                        ) : (
                          <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <Link
                            href={`/dashboard/trip-sheets/${tripSheet.id}/edit`}
                            className="rounded border border-gray-900 bg-gray-900 px-3 py-1 text-sm font-medium text-white"
                          >
                            Edit
                          </Link>
                          <Link
                            href={`/trip-sheets/${tripSheet.id}`}
                            className="rounded border border-zinc-300 bg-white px-3 py-1 text-sm text-gray-900"
                          >
                            View
                          </Link>
                          <Link
                            href={`/dashboard/trip-sheets/new?duplicateFrom=${tripSheet.id}`}
                            className="rounded border border-zinc-300 bg-white px-3 py-1 text-sm text-gray-900"
                          >
                            Duplicate
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
