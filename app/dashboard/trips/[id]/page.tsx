import Link from 'next/link'
import { redirect } from 'next/navigation'

import AdminNav from '@/app/dashboard/AdminNav'
import DeleteTripSheetButton from '@/app/dashboard/trip-sheets/DeleteTripSheetButton'
import DuplicateTripSheetButton from '@/app/dashboard/trip-sheets/DuplicateTripSheetButton'
import { getTripColorStyle } from '@/lib/trip-colors'
import {
  formatTripTypeLabel,
  getDestinationName,
  type DestinationRelation,
} from '@/lib/trip-sheets'

import SendTripNotificationButton from '../SendTripNotificationButton'
import TripSheetAssignmentPopover from '../TripSheetAssignmentPopover'
import { requireAdmin } from '../../lib'

type TripDetailPageProps = {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    error?: string
  }>
}

type TripRow = {
  id: string
  title: string | null
  trip_color: string | null
  trip_type: string | null
  start_date: string | null
  end_date: string | null
  destination_id: string | null
  destination_ref: DestinationRelation
  guest_name: string | null
  company: string | null
  phone_number: string | null
  adult_count: number | null
  kid_count: number | null
}

type TripSheetRow = {
  id: string
  trip_id: string | null
  title: string | null
  start_date: string | null
  start_time: string | null
  end_date: string | null
  end_time: string | null
  updated_at: string | null
}

type AssignmentRow = {
  id: string
  trip_sheet_id: string
  resource_user_id: string
}

type ResourceProfile = {
  id: string
  full_name: string | null
  email: string | null
  role: string | null
}

type TripNotificationSummaryRow = {
  sent_at: string | null
  status: 'success' | 'partial_failure' | 'failed' | null
  recipient_count: number | null
  success_count: number | null
}

function buildTripsRedirect(error: string) {
  const params = new URLSearchParams({ error })
  return `/dashboard/trips?${params.toString()}`
}

function formatValue(value: string | null) {
  return value ?? '-'
}

function formatCount(value: number | null) {
  return String(value ?? 0)
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

function formatTime(value: string | null) {
  if (!value) {
    return null
  }

  const [hours, minutes] = value.split(':').map(Number)

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return value
  }

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(1970, 0, 1, hours, minutes)))
}

function formatDateTimePoint(dateValue: string | null, timeValue: string | null) {
  const formattedDate = formatDate(dateValue)

  if (formattedDate === '-') {
    return '-'
  }

  const formattedTime = formatTime(timeValue)

  return formattedTime ? `${formattedDate}, ${formattedTime}` : formattedDate
}

function formatTripSheetSchedule(
  startDate: string | null,
  startTime: string | null,
  endDate: string | null,
  endTime: string | null
) {
  if (!startDate && !endDate) {
    return '-'
  }

  const formattedStart = formatDateTimePoint(startDate, startTime)

  if (!endDate) {
    return formattedStart
  }

  const formattedEnd = formatDateTimePoint(endDate, endTime)

  if (
    startDate === endDate &&
    (startTime ?? '') === (endTime ?? '')
  ) {
    return formattedStart
  }

  return `${formattedStart} → ${formattedEnd}`
}

function formatCustomerSummary(trip: Pick<TripRow, 'guest_name' | 'company'>) {
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

function formatAssignedName(resource: ResourceProfile | null) {
  if (!resource) {
    return 'Unnamed resource'
  }

  return resource.full_name?.trim() || resource.email?.trim() || 'Unnamed resource'
}

function formatUpdatedAt(value: string | null) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function sortTripSheetsChronologically(tripSheets: TripSheetRow[]) {
  return [...tripSheets].sort((left, right) => {
    const dateComparison = (left.start_date ?? '').localeCompare(right.start_date ?? '')

    if (dateComparison !== 0) {
      return dateComparison
    }

    return (left.start_time ?? '00:00').localeCompare(right.start_time ?? '00:00')
  })
}

export default async function TripDetailPage({
  params,
  searchParams,
}: TripDetailPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const { supabase, profile } = await requireAdmin()

  const { data, error } = await supabase
    .from('trips')
    .select(
      'id, title, trip_color, trip_type, start_date, end_date, destination_id, destination_ref:destinations(name), guest_name, company, phone_number, adult_count, kid_count'
    )
    .eq('id', id)
    .maybeSingle()

  const trip = (data as TripRow | null) ?? null

  if (!trip) {
    redirect(buildTripsRedirect(error?.message ?? 'Trip not found.'))
  }

  const { data: tripSheetData, error: tripSheetsError } = await supabase
    .from('trip_sheets')
    .select('id, trip_id, title, start_date, start_time, end_date, end_time, updated_at')
    .eq('trip_id', id)
    .order('start_date', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: true })

  const tripSheets = sortTripSheetsChronologically(
    (tripSheetData as TripSheetRow[] | null) ?? []
  )
  const tripSheetIds = tripSheets.map((tripSheet) => tripSheet.id)

  const { data: assignmentData, error: assignmentsError } =
    tripSheetIds.length > 0
      ? await supabase
          .from('trip_sheet_assignments')
          .select('id, trip_sheet_id, resource_user_id')
          .order('created_at', { ascending: true })
          .in('trip_sheet_id', tripSheetIds)
      : { data: [], error: null }

  const assignments = (assignmentData as AssignmentRow[] | null) ?? []
  const resourceUserIds = Array.from(
    new Set(assignments.map((assignment) => assignment.resource_user_id))
  )
  const { data: activeResourceData, error: activeResourcesError } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .in('role', ['resource', 'admin'])
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  const activeResources = (activeResourceData as ResourceProfile[] | null) ?? []
  const { data: resourceData, error: resourcesError } =
    resourceUserIds.length > 0
      ? await supabase
          .from('profiles')
          .select('id, full_name, email, role')
          .in('id', resourceUserIds)
      : { data: [], error: null }

  const resources = (resourceData as ResourceProfile[] | null) ?? []
  const { data: latestNotificationData, error: latestNotificationError } = await supabase
    .from('trip_notifications')
    .select('sent_at, status, recipient_count, success_count')
    .eq('trip_id', id)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const latestNotification =
    (latestNotificationData as TripNotificationSummaryRow | null) ?? null
  const resourcesById = new Map<string, ResourceProfile>()
  const assignedTripSheetCountByResourceUserId = new Map<string, number>()

  for (const resource of activeResources) {
    resourcesById.set(resource.id, resource)
  }

  for (const resource of resources) {
    resourcesById.set(resource.id, resource)
  }

  const assignedResourcesByTripSheetId = new Map<
    string,
    Array<{
      assignmentId: string
      resourceUserId: string
      label: string
    }>
  >()

  for (const assignment of assignments) {
    const currentAssignments =
      assignedResourcesByTripSheetId.get(assignment.trip_sheet_id) ?? []
    const resolvedResource = resourcesById.get(assignment.resource_user_id) ?? null
    const currentAssignedCount =
      assignedTripSheetCountByResourceUserId.get(assignment.resource_user_id) ?? 0

    currentAssignments.push({
      assignmentId: assignment.id,
      resourceUserId: assignment.resource_user_id,
      label: formatAssignedName(resolvedResource),
    })

    assignedResourcesByTripSheetId.set(assignment.trip_sheet_id, currentAssignments)
    assignedTripSheetCountByResourceUserId.set(
      assignment.resource_user_id,
      currentAssignedCount + 1
    )
  }

  const errorMessage =
    tripSheetsError?.message ||
    assignmentsError?.message ||
    activeResourcesError?.message ||
    resourcesError?.message ||
    latestNotificationError?.message ||
    null
  const destinationName = getDestinationName(trip.destination_ref, 'Unknown destination')
  const tripColorStyle = getTripColorStyle(trip.trip_color)
  const returnPath = `/dashboard/trips/${trip.id}`

  return (
    <>
      <AdminNav current="trips" />

      {query.error ? <p className="app-banner-error">{query.error}</p> : null}

      <div className="app-page-header">
        <div>
          <h1 className="app-page-title flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-full border"
              style={{
                backgroundColor: tripColorStyle.background,
                borderColor: tripColorStyle.border,
              }}
            />
            <span>{trip.title ?? 'Untitled trip'}</span>
          </h1>
          <p className="app-page-subtitle">
            Review the parent trip and manage its child trip sheets underneath.
          </p>
        </div>

        {profile?.role === 'admin' ? (
          <SendTripNotificationButton
            tripId={trip.id}
            tripTitle={trip.title ?? 'Untitled trip'}
            recipientCount={resourceUserIds.length}
          />
        ) : null}
      </div>

      {errorMessage ? <p className="app-banner-error">{errorMessage}</p> : null}

      <section className="app-section-card mb-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Trip Summary</h2>
            <p className="mt-1 text-sm text-gray-600">
              Parent trip details and passenger counts for this trip.
            </p>
          </div>

          <Link href={`/dashboard/trips/${trip.id}/edit`} className="ui-button ui-button-secondary">
            Edit Trip
          </Link>
        </div>

        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs font-medium text-gray-500">Customer</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {formatCustomerSummary(trip)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Trip Type</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatTripTypeLabel(trip.trip_type)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Start Date</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatDate(trip.start_date)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">End Date</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatDate(trip.end_date)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Destination</dt>
            <dd className="mt-1 text-sm text-gray-900">{destinationName}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Phone</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatValue(trip.phone_number)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Adult Numbers</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatCount(trip.adult_count)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Kid Numbers</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatCount(trip.kid_count)}</dd>
          </div>
        </dl>

        {latestNotification ? (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Last Notified
            </p>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-700">
              <p>
                <span className="font-medium text-gray-900">When:</span>{' '}
                {formatUpdatedAt(latestNotification.sent_at)}
              </p>
              <p>
                <span className="font-medium text-gray-900">Status:</span>{' '}
                {latestNotification.status ?? '-'}
              </p>
              <p>
                <span className="font-medium text-gray-900">Recipients:</span>{' '}
                {(latestNotification.success_count ?? 0)}/
                {latestNotification.recipient_count ?? 0}
              </p>
            </div>
          </div>
        ) : null}
      </section>

      <section className="app-section-card space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Trip Sheets</h2>
          <p className="mt-1 text-sm text-gray-600">
            Execution units under this trip remain assignment-driven.
          </p>
        </div>

        <div className="app-table-wrap">
          <table className="app-table table-fixed">
            <thead>
              <tr>
                <th className="w-[28%] px-4 py-3 font-medium text-gray-700">Schedule</th>
                <th className="w-[28%] px-4 py-3 font-medium text-gray-700">Resource</th>
                <th className="w-[10%] px-4 py-3 font-medium text-gray-700">Updated</th>
                <th className="w-[34%] px-4 py-3 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tripSheets.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-gray-700">
                    No trip sheets added yet.
                  </td>
                </tr>
              ) : (
                tripSheets.map((tripSheet) => {
                  const assignedResources =
                    assignedResourcesByTripSheetId.get(tripSheet.id) ?? []
                  const assignedResourceIds = new Set(
                    assignedResources.map((resource) => resource.resourceUserId)
                  )
                  const availableResourcesForTripSheet = activeResources.filter(
                    (resource) => !assignedResourceIds.has(resource.id)
                  )

                  return (
                  <tr
                    key={tripSheet.id}
                    className="align-top"
                  >
                    <td className="px-4 py-3.5 text-gray-900">
                      <div className="space-y-1">
                        <p
                          className="truncate text-sm text-gray-700"
                          title={formatTripSheetSchedule(
                            tripSheet.start_date,
                            tripSheet.start_time,
                            tripSheet.end_date,
                            tripSheet.end_time
                          )}
                        >
                          {formatTripSheetSchedule(
                            tripSheet.start_date,
                            tripSheet.start_time,
                            tripSheet.end_date,
                            tripSheet.end_time
                          )}
                        </p>
                        <p
                          className="truncate text-[15px] font-semibold leading-5 text-gray-900"
                          title={tripSheet.title ?? 'Untitled trip sheet'}
                        >
                          {tripSheet.title ?? 'Untitled trip sheet'}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-gray-900">
                      <TripSheetAssignmentPopover
                        tripSheetId={tripSheet.id}
                        assignedResources={assignedResources.map((resource) => ({
                          assignmentId: resource.assignmentId,
                          label: resource.label,
                        }))}
                        availableResources={availableResourcesForTripSheet.map((resource) => ({
                          id: resource.id,
                          label: `${resource.full_name?.trim() || resource.email?.trim() || resource.id} (${resource.role === 'admin' ? 'Admin' : 'Resource'})`,
                        }))}
                        returnPath={returnPath}
                      />
                    </td>
                    <td className="px-4 py-3.5 text-gray-900">
                      <p className="whitespace-nowrap">{formatUpdatedAt(tripSheet.updated_at)}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <Link
                          href={`/dashboard/trip-sheets/${tripSheet.id}/edit`}
                          className="ui-button ui-button-primary ui-button-compact shrink-0 whitespace-nowrap"
                        >
                          Edit
                        </Link>
                        <Link
                          href={`/trip-sheets/${tripSheet.id}`}
                          className="ui-button ui-button-secondary ui-button-compact shrink-0 whitespace-nowrap"
                        >
                          View
                        </Link>
                        <DuplicateTripSheetButton
                          tripSheetId={tripSheet.id}
                          tripId={trip.id}
                          className="ui-button-secondary ui-button-compact shrink-0 whitespace-nowrap"
                        />
                        <DeleteTripSheetButton
                          tripSheetId={tripSheet.id}
                          tripId={trip.id}
                          className="ui-button-danger ui-button-compact shrink-0 whitespace-nowrap"
                        />
                      </div>
                    </td>
                  </tr>
                )})
              )}
              <tr>
                <td colSpan={4} className="px-4 pb-1 pt-3">
                  <div className="mx-auto w-full max-w-md">
                    <Link
                      href={`/dashboard/trip-sheets/new?tripId=${trip.id}`}
                      className="block rounded-xl border border-dashed border-zinc-400 bg-zinc-100 px-4 py-3 text-center text-sm font-semibold text-gray-800 transition hover:border-zinc-500 hover:bg-zinc-200 hover:text-gray-900"
                    >
                      + Add New Trip Sheet
                    </Link>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

    </>
  )
}
