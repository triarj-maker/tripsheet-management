import { redirect } from 'next/navigation'

import AdminNav from '@/app/dashboard/AdminNav'
import ActionSubmitButton from '@/app/components/ActionSubmitButton'
import { getDestinationName, type DestinationRelation } from '@/lib/trip-sheets'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  assignResourceToTripSheet,
  removeResourceFromTripSheet,
} from '../../actions'
import { requireAdmin } from '../../lib'
import { guestOrCompanyRequiredMessage } from '../../validation'

import ArchiveTripSheetButton from './ArchiveTripSheetButton'
import EditTripSheetForm from './EditTripSheetForm'

type EditTripSheetPageProps = {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    error?: string
  }>
}

type TripSheet = {
  id: string
  title: string | null
  trip_type: string | null
  destination_id: string | null
  destination_ref: DestinationRelation
  start_date: string | null
  end_date: string | null
  guest_name: string | null
  company: string | null
  phone_number: string | null
  template_id: string | null
  body_text: string | null
}

type Assignment = {
  id: string
  resource_user_id: string
}

type ResourceProfile = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  role: string | null
}

type DestinationOption = {
  id: string
  name: string | null
  is_active: boolean | null
}

type NotificationRecord = {
  resource_user_id: string
  notification_type: string | null
  status: string | null
  sent_at: string | null
  error_message: string | null
}

type NotificationSummary = {
  statusLabel: 'Sent' | 'Failed' | 'Pending'
  sentAt: string | null
  errorMessage: string | null
}

function buildTripSheetsRedirect(error: string) {
  const params = new URLSearchParams({ error })
  return `/dashboard/trip-sheets?${params.toString()}`
}

function formatSentAt(value: string | null) {
  if (!value) {
    return null
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  const datePart = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
  const timePart = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)

  return `${datePart}, ${timePart}`
}

function buildNotificationSummary(records: NotificationRecord[]) {
  const sentRecord = records.find((record) => record.status === 'sent')

  if (sentRecord) {
    return {
      statusLabel: 'Sent',
      sentAt: sentRecord.sent_at,
      errorMessage: null,
    } satisfies NotificationSummary
  }

  const failedRecord = records.find((record) => record.status === 'failed')

  if (failedRecord) {
    return {
      statusLabel: 'Failed',
      sentAt: failedRecord.sent_at,
      errorMessage: failedRecord.error_message,
    } satisfies NotificationSummary
  }

  return {
    statusLabel: 'Pending',
    sentAt: null,
    errorMessage: null,
  } satisfies NotificationSummary
}

function statusBadgeClass(statusLabel: NotificationSummary['statusLabel']) {
  if (statusLabel === 'Sent') {
    return 'bg-green-100 text-green-700'
  }

  if (statusLabel === 'Failed') {
    return 'bg-red-100 text-red-700'
  }

  return 'bg-zinc-100 text-zinc-700'
}

function formatAssignableLabel(resource: ResourceProfile) {
  const baseLabel = resource.full_name ?? resource.email ?? resource.id
  const roleLabel = resource.role === 'admin' ? 'Admin' : 'Resource'

  return `${baseLabel} (${roleLabel})`
}

export default async function EditTripSheetPage({
  params,
  searchParams,
}: EditTripSheetPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const { supabase } = await requireAdmin()
  const { data, error } = await supabase
    .from('trip_sheets')
    .select(
      'id, title, trip_type, destination_id, destination_ref:destinations(name), start_date, end_date, guest_name, company, phone_number, template_id, body_text'
    )
    .eq('id', id)
    .maybeSingle()

  const tripSheet = (data as TripSheet | null) ?? null

  if (!tripSheet) {
    redirect(buildTripSheetsRedirect(error?.message ?? 'Trip sheet not found.'))
  }

  const { data: templateData } = tripSheet.template_id
    ? await supabase
        .from('trip_templates')
        .select('title')
        .eq('id', tripSheet.template_id)
        .maybeSingle()
    : { data: null }

  const templateName =
    ((templateData as { title: string | null } | null)?.title ?? null) || 'Locked template'

  const { data: destinationData, error: destinationsError } = await supabase
    .from('destinations')
    .select('id, name, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true })

  let destinations = (destinationData as DestinationOption[] | null) ?? []

  if (
    tripSheet.destination_id &&
    !destinations.some((destination) => destination.id === tripSheet.destination_id)
  ) {
    let selectedDestination: DestinationOption | null = null

    try {
      const adminClient = createAdminClient()
      const { data: selectedDestinationData } = await adminClient
        .from('destinations')
        .select('id, name, is_active')
        .eq('id', tripSheet.destination_id)
        .maybeSingle()

      selectedDestination = (selectedDestinationData as DestinationOption | null) ?? null
    } catch {}

    if (selectedDestination) {
      destinations = [...destinations, selectedDestination].sort((left, right) =>
        (left.name ?? '').localeCompare(right.name ?? '')
      )
    } else {
      const destinationName = getDestinationName(
        tripSheet.destination_ref,
        'Unknown destination'
      )

      destinations = [
        ...destinations,
        {
          id: tripSheet.destination_id,
          name: destinationName,
          is_active: false,
        },
      ].sort((left, right) => (left.name ?? '').localeCompare(right.name ?? ''))
    }
  }

  const { data: assignmentData, error: assignmentError } = await supabase
    .from('trip_sheet_assignments')
    .select('id, resource_user_id')
    .eq('trip_sheet_id', id)
    .order('assigned_at', { ascending: true })

  const assignments = (assignmentData as Assignment[] | null) ?? []
  const assignedResourceIds = assignments.map((assignment) => assignment.resource_user_id)

  const { data: activeResourceData, error: activeResourcesError } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, role')
    .in('role', ['resource', 'admin'])
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  const activeResources = (activeResourceData as ResourceProfile[] | null) ?? []

  const { data: assignedProfilesData, error: assignedProfilesError } =
    assignedResourceIds.length > 0
      ? await supabase
          .from('profiles')
          .select('id, full_name, email, phone, role')
          .in('id', assignedResourceIds)
      : { data: [], error: null }

  const assignedProfiles = (assignedProfilesData as ResourceProfile[] | null) ?? []
  const assignedProfilesById = new Map(
    assignedProfiles.map((profile) => [profile.id, profile])
  )
  const assignedResources = assignments.map((assignment) => ({
    assignmentId: assignment.id,
    resourceUserId: assignment.resource_user_id,
    profile: assignedProfilesById.get(assignment.resource_user_id) ?? null,
  }))
  const availableResources = activeResources.filter(
    (resource) => !assignedResourceIds.includes(resource.id)
  )
  const { data: notificationData, error: notificationsError } =
    assignedResourceIds.length > 0
      ? await supabase
          .from('trip_sheet_notifications')
          .select(
            'resource_user_id, notification_type, status, sent_at, error_message'
          )
          .eq('trip_sheet_id', id)
          .in('resource_user_id', assignedResourceIds)
          .in('notification_type', ['assignment', 'reminder_3_day'])
          .order('sent_at', { ascending: false })
      : { data: [], error: null }

  const notifications = (notificationData as NotificationRecord[] | null) ?? []
  const notificationsByResourceAndType = new Map<string, NotificationRecord[]>()

  for (const notification of notifications) {
    const key = `${notification.resource_user_id}:${notification.notification_type}`
    const currentNotifications = notificationsByResourceAndType.get(key) ?? []

    currentNotifications.push(notification)
    notificationsByResourceAndType.set(key, currentNotifications)
  }

  const assignmentSectionError =
    destinationsError?.message ||
    assignmentError?.message ||
    activeResourcesError?.message ||
    assignedProfilesError?.message ||
    null
  const notificationsSectionError = notificationsError?.message || null

  return (
    <>
      <AdminNav current="trip-sheets" />

        <div className="app-page-header">
          <div>
            <h1 className="app-page-title">Edit Trip Sheet</h1>
            <p className="app-page-subtitle">
              Update trip details, assignments, and notification visibility.
            </p>
          </div>
        </div>

        {query.error && query.error !== guestOrCompanyRequiredMessage ? (
          <p className="app-banner-error">
            {query.error}
          </p>
        ) : null}

        {assignmentSectionError ? (
          <p className="app-banner-error">
            {assignmentSectionError}
          </p>
        ) : null}

        <div className="space-y-5">
          <EditTripSheetForm
            tripSheet={tripSheet}
            templateName={templateName}
            destinations={destinations.map((destination) => ({
              id: destination.id,
              name: destination.name ?? destination.id,
            }))}
            errorMessage={query.error}
          />

          <section className="app-section-card space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Assigned Resources</h2>
              <p className="mt-1 text-sm text-gray-600">
                Manage the resources currently assigned to this trip sheet.
              </p>
            </div>

            <div className="space-y-2.5">
              {assignedResources.length === 0 ? (
                <p className="text-sm text-gray-700">No resources assigned yet.</p>
              ) : (
                assignedResources.map(({ assignmentId, profile }) => (
                  <div
                    key={assignmentId}
                    className="flex items-start justify-between gap-4 rounded-lg border border-zinc-200 px-3 py-2.5"
                  >
                    <div className="space-y-0.5 text-sm text-gray-900">
                      <p>{profile?.full_name ?? '-'}</p>
                      <p>{profile?.email ?? '-'}</p>
                      <p>{profile?.phone ?? '-'}</p>
                    </div>

                    <form action={removeResourceFromTripSheet}>
                      <input type="hidden" name="trip_sheet_id" value={tripSheet.id} />
                      <input type="hidden" name="assignment_id" value={assignmentId} />
                      <ActionSubmitButton
                        idleLabel="Remove"
                        pendingLabel="Removing…"
                        className="ui-button-secondary ui-button-compact"
                      />
                    </form>
                  </div>
                ))
              )}
            </div>

            <form
              action={assignResourceToTripSheet}
              className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"
            >
              <input type="hidden" name="trip_sheet_id" value={tripSheet.id} />

              <div>
                <label htmlFor="resource_user_id" className="ui-label">Assign Resource</label>
                <select
                  id="resource_user_id"
                  name="resource_user_id"
                  required
                  className="ui-select ui-select-compact"
                >
                  <option value="">Select a resource</option>
                  {availableResources.map((resource) => (
                    <option key={resource.id} value={resource.id}>
                      {formatAssignableLabel(resource)}
                    </option>
                  ))}
                </select>
              </div>

              <ActionSubmitButton
                idleLabel="Assign Resource"
                pendingLabel="Assigning…"
                className="ui-button-primary ui-button-compact md:min-w-[9rem]"
              />
            </form>
          </section>

          <section className="app-section-card space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Notification Status</h2>
              <p className="mt-1 text-sm text-gray-600">
                Review the current assignment and reminder notification states.
              </p>
            </div>

            {notificationsSectionError ? (
              <p className="app-banner-error">
                {notificationsSectionError}
              </p>
            ) : null}

            {assignedResources.length === 0 ? (
              <p className="text-sm text-gray-700">No resources assigned yet.</p>
            ) : (
              <div className="space-y-3">
                {assignedResources.map(({ assignmentId, resourceUserId, profile }) => {
                  const assignmentNotification = buildNotificationSummary(
                    notificationsByResourceAndType.get(`${resourceUserId}:assignment`) ??
                      []
                  )
                  const reminderNotification = buildNotificationSummary(
                    notificationsByResourceAndType.get(
                      `${resourceUserId}:reminder_3_day`
                    ) ?? []
                  )

                  return (
                    <div key={assignmentId} className="rounded-lg border border-zinc-200 p-3.5">
                      <p className="mb-3 text-sm font-medium text-gray-900">
                        {profile?.full_name ?? 'Unknown resource'}
                      </p>

                      <div className="grid gap-3 md:grid-cols-2">
                        {[
                          {
                            label: 'Assignment',
                            notification: assignmentNotification,
                          },
                          {
                            label: '3-Day Reminder',
                            notification: reminderNotification,
                          },
                        ].map(({ label, notification }) => {
                          const formattedSentAt = formatSentAt(notification.sentAt)

                          return (
                            <div
                              key={label}
                              className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3"
                            >
                              <div className="mb-2.5 flex items-center justify-between gap-3">
                                <p className="text-sm font-medium text-gray-900">{label}</p>
                                <span
                                  className={`ui-badge ${statusBadgeClass(notification.statusLabel)}`}
                                >
                                  {notification.statusLabel}
                                </span>
                              </div>

                              {formattedSentAt ? (
                                <p className="text-sm text-gray-700">
                                  Sent at: {formattedSentAt}
                                </p>
                              ) : null}

                              {notification.statusLabel === 'Failed' &&
                              notification.errorMessage ? (
                                <p className="mt-2 text-sm text-red-700">
                                  Error: {notification.errorMessage}
                                </p>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        <div className="mt-5">
          <ArchiveTripSheetButton tripSheetId={tripSheet.id} />
        </div>
    </>
  )
}
