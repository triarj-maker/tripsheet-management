import { eligibleProfiles } from '@/lib/roles'
import type { PermissionProfile } from '@/lib/roles'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import AdminNav from '@/app/dashboard/AdminNav'
import { getConflictingTripSheetIds } from '@/app/dashboard/calendar/conflicts'
import { getPermissionLabel, isAdminRole } from '@/lib/roles'
import { getTripColorStyle } from '@/lib/trip-colors'
import { getCurrentDateStringInAppTimeZone } from '@/lib/time'
import { isTaskOverdue, type TaskListItem } from '@/lib/trip-tasks'
import TaskList from '@/app/tasks/TaskList'
import TaskDetailPanel from '@/app/tasks/TaskDetailPanel'
import type { TaskComment } from '@/app/tasks/types'
import {
  formatTripCustomerSummary,
  formatTripTypeLabel,
  getDestinationName,
  type DestinationRelation,
  type LookupNameRelation,
} from '@/lib/trip-sheets'
import {
  formatVisibleTripStateLabel,
  getVisibleTripState,
  isTripNotificationAllowed,
  type VisibleTripState,
} from '@/lib/trip-workflow'

import SendTripNotificationButton from '../SendTripNotificationButton'
import { requireAdmin } from '../../lib'
import BulkTripSheetAssignmentForm from './BulkTripSheetAssignmentForm'
import DownloadTripPdfButton from './DownloadTripPdfButton'
import TripHeader from './TripHeader'
import { getTripDetailTab, tripDetailTabHref } from './trip-detail-presentation'

type TripDetailPageProps = {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    error?: string
    success?: string
    task?: string
    tab?: string
    newTask?: string
  }>
}

type TripRow = {
  id: string
  title: string | null
  trip_color: string | null
  trip_type: string | null
  start_date: string | null
  end_date: string | null
  workflow_state: string | null
  is_archived: boolean | null
  destination_id: string | null
  destination_ref: DestinationRelation
  company_id: string | null
  school_id: string | null
  company_ref: LookupNameRelation
  school_ref: LookupNameRelation
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

type ConflictTripSheetRow = {
  id: string
  start_date: string | null
  start_time: string | null
  end_date: string | null
  end_time: string | null
}

type AssignmentRow = {
  id: string
  trip_sheet_id: string
  resource_user_id: string
}

type ResourceProfile = PermissionProfile & {
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

function getVisibleStateBadgeClasses(state: VisibleTripState) {
  if (state === 'archived') {
    return 'ui-badge bg-red-100 text-red-700'
  }

  if (state === 'completed') {
    return 'ui-badge bg-amber-100 text-amber-700'
  }

  if (state === 'tentative') {
    return 'ui-badge bg-slate-100 text-slate-700'
  }

  return 'ui-badge bg-green-100 text-green-700'
}

function buildTripsRedirect(error: string) {
  const params = new URLSearchParams({ error })
  return `/dashboard/trips?${params.toString()}`
}

function buildCalendarWeekHref(dateValue: string | null) {
  const params = new URLSearchParams({ view: 'week' })

  if (dateValue) {
    params.set('date', dateValue)
  }

  return `/dashboard/calendar?${params.toString()}`
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
      'id, title, trip_color, trip_type, start_date, end_date, workflow_state, is_archived, destination_id, destination_ref:destinations(name), company_id, school_id, company_ref:companies(name), school_ref:schools(name), guest_name, company, phone_number, adult_count, kid_count'
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
    .select('id, full_name, email, role, is_admin, is_active, profile_operational_roles(role_code)')
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  const activeResources = eligibleProfiles((activeResourceData as ResourceProfile[] | null) ?? [])
  const { data: resourceData, error: resourcesError } =
    resourceUserIds.length > 0
      ? await supabase
          .from('profiles')
          .select('id, full_name, email, role, is_admin, is_active, profile_operational_roles(role_code)')
          .in('id', resourceUserIds)
      : { data: [], error: null }

  const resources = (resourceData as ResourceProfile[] | null) ?? []
  const { data: conflictTripSheetData, error: conflictTripSheetsError } =
    resourceUserIds.length > 0 && trip.start_date && trip.end_date
      ? await supabase
          .from('trip_sheets')
          .select(
            'id, start_date, start_time, end_date, end_time, trip:trips!inner(is_archived)'
          )
          .eq('is_archived', false)
          .eq('trip.is_archived', false)
          .not('start_date', 'is', null)
          .not('end_date', 'is', null)
          .lte('start_date', trip.end_date)
          .gte('end_date', trip.start_date)
      : { data: [], error: null }

  const conflictTripSheets =
    (conflictTripSheetData as ConflictTripSheetRow[] | null) ?? []
  const conflictTripSheetIds = conflictTripSheets.map((tripSheet) => tripSheet.id)
  const { data: conflictAssignmentData, error: conflictAssignmentsError } =
    conflictTripSheetIds.length > 0 && resourceUserIds.length > 0
      ? await supabase
          .from('trip_sheet_assignments')
          .select('trip_sheet_id, resource_user_id')
          .in('trip_sheet_id', conflictTripSheetIds)
          .in('resource_user_id', resourceUserIds)
      : { data: [], error: null }

  const conflictingTripSheetIds = getConflictingTripSheetIds(
    conflictTripSheets,
    (conflictAssignmentData as Pick<
      AssignmentRow,
      'trip_sheet_id' | 'resource_user_id'
    >[] | null) ?? []
  )
  const hasTripConflict = tripSheetIds.some((tripSheetId) =>
    conflictingTripSheetIds.has(tripSheetId)
  )
  const { data: latestNotificationData, error: latestNotificationError } = await supabase
    .from('trip_notifications')
    .select('sent_at, status, recipient_count, success_count')
    .eq('trip_id', id)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const latestNotification =
    (latestNotificationData as TripNotificationSummaryRow | null) ?? null
  const { data: taskData, error: tasksError } = await supabase
    .from('trip_tasks')
    .select('id, title, description, trip_id, trip_sheet_id, assigned_to, due_at, status, completed_at, trip:trips(id, title), trip_sheet:trip_sheets(id, title), assignee:profiles!trip_tasks_assigned_to_fkey(id, full_name, email)')
    .eq('trip_id', id)
  const tasks = (taskData as TaskListItem[] | null) ?? []
  const selectedTask = query.task ? tasks.find((task) => task.id === query.task) ?? null : null
  const { data: taskCommentData, error: taskCommentsError } = selectedTask
    ? await supabase
        .from('trip_task_comments')
        .select('id, body, created_at, author:profiles!trip_task_comments_author_id_fkey(id, full_name, email)')
        .eq('task_id', selectedTask.id)
        .order('created_at')
    : { data: [], error: null }
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
    conflictTripSheetsError?.message ||
    conflictAssignmentsError?.message ||
    latestNotificationError?.message ||
    tasksError?.message ||
    taskCommentsError?.message ||
    null
  const destinationName = getDestinationName(trip.destination_ref, 'Unknown destination')
  const tripColorStyle = getTripColorStyle(trip.trip_color)
  const returnPath = `/dashboard/trips/${trip.id}`
  const tasksPath = `${returnPath}?tab=tasks`
  const activeTab = getTripDetailTab(query)
  const overdueCount = tasks.filter(task => isTaskOverdue(task)).length
  const calendarWeekHref = buildCalendarWeekHref(trip.start_date)
  const visibleTripState = getVisibleTripState({
    workflowState: trip.workflow_state,
    isArchived: trip.is_archived === true,
    endDate: trip.end_date,
    today: getCurrentDateStringInAppTimeZone(),
  })
  const notifyDisabledReason = isTripNotificationAllowed(visibleTripState)
    ? undefined
    : visibleTripState === 'tentative'
      ? 'Notifications are only available after a trip is marked Active.'
      : visibleTripState === 'archived'
        ? 'Notifications are not available for archived trips.'
        : 'Notifications are only available for Active trips.'

  return (
    <>
      <AdminNav current="trips" />

      {query.error ? <p className="app-banner-error">{query.error}</p> : null}
      {query.success ? <p className="app-banner-success">{query.success}</p> : null}

      <TripHeader
        title={trip.title ?? 'Untitled trip'}
        state={formatVisibleTripStateLabel(visibleTripState)}
        badgeClass={getVisibleStateBadgeClasses(visibleTripState)}
        colorStyle={{ backgroundColor: tripColorStyle.background, borderColor: tripColorStyle.border }}
        customer={formatTripCustomerSummary(trip)} destination={destinationName ?? 'Unknown destination'}
        dates={`${formatDate(trip.start_date)} – ${formatDate(trip.end_date)}`}
        adults={trip.adult_count ?? 0} childrenCount={trip.kid_count ?? 0}
        actions={<>
          <Link href={`/dashboard/trips/${trip.id}/edit`} className="ui-button ui-button-secondary">Edit Trip</Link>

          <Link
            href={calendarWeekHref}
            className="ui-button ui-button-secondary"
            title={
              hasTripConflict
                ? 'Open the calendar week for this trip. Scheduling conflict detected.'
                : 'Open the calendar week for this trip.'
            }
          >
            <span>Open in Calendar</span>
            {hasTripConflict ? (
              <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full bg-red-500"
                />
                <span className="sr-only">Scheduling conflict detected</span>
              </span>
            ) : null}
          </Link>

          <DownloadTripPdfButton tripId={trip.id} />

          {isAdminRole(profile) ? (
            <SendTripNotificationButton
              tripId={trip.id}
              tripTitle={trip.title ?? 'Untitled trip'}
              recipientCount={resourceUserIds.length}
              disabledReason={notifyDisabledReason}
            />
          ) : null}
        </>}
        secondaryDetails={<>
          <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div><dt className="text-gray-500">Trip Type</dt><dd>{formatTripTypeLabel(trip.trip_type)}</dd></div>
            <div><dt className="text-gray-500">Phone</dt><dd>{formatValue(trip.phone_number)}</dd></div>
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
        </>}
      />
      {errorMessage ? <p className="app-banner-error">{errorMessage}</p> : null}
      <nav aria-label="Trip workspace" className="mb-4 flex flex-wrap gap-2">
        <Link id="trip-sheets-tab" href={tripDetailTabHref(trip.id, query, 'trip-sheets')} aria-current={activeTab === 'trip-sheets' ? 'page' : undefined} className={`ui-button ${activeTab === 'trip-sheets' ? 'ui-button-primary' : 'ui-button-secondary'}`}>
          Trip Sheets ({tripSheets.length})
        </Link>
        <Link id="tasks-tab" href={tripDetailTabHref(trip.id, query, 'tasks')} aria-current={activeTab === 'tasks' ? 'page' : undefined} className={`ui-button ${activeTab === 'tasks' ? 'ui-button-primary' : 'ui-button-secondary'}`}>
          Tasks ({tasks.length}){overdueCount ? ` · ${overdueCount} overdue` : ''}
        </Link>
      </nav>

      {activeTab === 'tasks' ? <section aria-labelledby="tasks-tab" className="app-section-card mb-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Tasks</h2>
            <p className="mt-1 text-sm text-gray-600">Operational work for this Trip.</p>
          </div>
          <Link href={`${tasksPath}&newTask=1`} className="ui-button ui-button-primary">
            Create task
          </Link>
        </div>
        <TaskList tasks={tasks} refreshOnStatusChange hrefForTask={(taskId) => `${tasksPath}&task=${taskId}`} />
      </section> : null}

      <section hidden={activeTab !== 'trip-sheets'} aria-labelledby="trip-sheets-tab" className="app-section-card space-y-4">
        <BulkTripSheetAssignmentForm
          key={trip.id}
          tripId={trip.id}
          returnPath={returnPath}
          availableResources={activeResources.map((resource) => ({
            id: resource.id,
            label: `${resource.full_name?.trim() || resource.email?.trim() || resource.id} (${getPermissionLabel(resource)})`,
          }))}
          tripSheets={tripSheets.map(sheet => ({
            ...sheet,
            assignedUsers: (assignedResourcesByTripSheetId.get(sheet.id) ?? []).map(({ resourceUserId, label }) => ({ resourceUserId, label })),
          }))}
        />
      </section>

      {(query.newTask === '1' || selectedTask) ? (
        <TaskDetailPanel
          task={selectedTask}
          comments={(taskCommentData as TaskComment[] | null) ?? []}
          trips={[{ id: trip.id, title: trip.title }]}
          tripSheets={tripSheets.map(({ id: sheetId, trip_id, title }) => ({ id: sheetId, trip_id, title }))}
          assignees={activeResources.map(({ id: profileId, full_name, email }) => ({ id: profileId, full_name, email }))}
          isAdmin
          returnTo={tasksPath}
          closeHref={tasksPath}
          lockedTripId={trip.id}
        />
      ) : null}

    </>
  )
}
