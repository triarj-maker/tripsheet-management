'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendTripNotificationEmail } from '@/lib/email'

type TripNotificationResult = {
  ok: boolean
  tripId: string
  recipientCount: number
  successCount: number
  failureCount: number
  status: 'success' | 'partial_failure' | 'failed'
  message: string
}

type TripRecord = {
  id: string
  title: string | null
  start_date: string | null
  end_date: string | null
  destination:
    | {
        name: string | null
      }
    | Array<{
        name: string | null
      }>
    | null
}

type TripSheetRecord = {
  id: string
  title: string | null
  start_date: string | null
  start_time: string | null
  end_date: string | null
  end_time: string | null
}

type AssignmentRecord = {
  trip_sheet_id: string
  resource_user_id: string
}

type ProfileRecord = {
  id: string
  full_name: string | null
  email: string | null
  is_active: boolean | null
}

function getDestinationName(destination: TripRecord['destination']) {
  if (Array.isArray(destination)) {
    return destination[0]?.name ?? null
  }

  return destination?.name ?? null
}

function getResultMessage({
  recipientCount,
  successCount,
  failureCount,
  status,
}: {
  recipientCount: number
  successCount: number
  failureCount: number
  status: TripNotificationResult['status']
}) {
  if (recipientCount === 0) {
    return 'No assigned resources were found for this trip.'
  }

  if (status === 'success') {
    return `Trip notification sent to ${successCount} recipient${successCount === 1 ? '' : 's'}.`
  }

  if (status === 'failed') {
    return `Trip notification failed for all ${failureCount} recipient${failureCount === 1 ? '' : 's'}.`
  }

  return `Trip notification sent to ${successCount} recipient${successCount === 1 ? '' : 's'} and failed for ${failureCount}.`
}

export async function sendTripNotification(tripId: string): Promise<TripNotificationResult> {
  const normalizedTripId = tripId.trim()

  if (!normalizedTripId) {
    return {
      ok: false,
      tripId: normalizedTripId,
      recipientCount: 0,
      successCount: 0,
      failureCount: 0,
      status: 'failed',
      message: 'Trip not found.',
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false,
      tripId: normalizedTripId,
      recipientCount: 0,
      successCount: 0,
      failureCount: 0,
      status: 'failed',
      message: 'You do not have access to send trip notifications.',
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, is_active')
    .eq('id', user.id)
    .maybeSingle()

  const currentProfile =
    (profile as { id: string; role: string | null; is_active: boolean | null } | null) ?? null

  if (!currentProfile || currentProfile.is_active === false || currentProfile.role !== 'admin') {
    return {
      ok: false,
      tripId: normalizedTripId,
      recipientCount: 0,
      successCount: 0,
      failureCount: 0,
      status: 'failed',
      message: 'You do not have access to send trip notifications.',
    }
  }

  const adminClient = createAdminClient()
  const { data: tripData, error: tripError } = await adminClient
    .from('trips')
    .select('id, title, start_date, end_date, destination:destinations(name)')
    .eq('id', normalizedTripId)
    .maybeSingle()

  const trip = (tripData as TripRecord | null) ?? null

  if (tripError || !trip || !trip.start_date || !trip.end_date) {
    return {
      ok: false,
      tripId: normalizedTripId,
      recipientCount: 0,
      successCount: 0,
      failureCount: 0,
      status: 'failed',
      message: tripError?.message ?? 'Trip not found.',
    }
  }

  const { data: tripSheetData, error: tripSheetsError } = await adminClient
    .from('trip_sheets')
    .select('id, title, start_date, start_time, end_date, end_time')
    .eq('trip_id', normalizedTripId)
    .order('start_date', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: true })

  if (tripSheetsError) {
    return {
      ok: false,
      tripId: normalizedTripId,
      recipientCount: 0,
      successCount: 0,
      failureCount: 0,
      status: 'failed',
      message: tripSheetsError.message,
    }
  }

  const tripSheets = (tripSheetData as TripSheetRecord[] | null) ?? []
  const tripSheetsById = new Map<string, TripSheetRecord>()

  for (const tripSheet of tripSheets) {
    tripSheetsById.set(tripSheet.id, tripSheet)
  }

  const tripSheetIds = tripSheets.map((tripSheet) => tripSheet.id)

  if (tripSheetIds.length === 0) {
    return {
      ok: true,
      tripId: normalizedTripId,
      recipientCount: 0,
      successCount: 0,
      failureCount: 0,
      status: 'failed',
      message: 'No assigned resources were found for this trip.',
    }
  }

  const { data: assignmentData, error: assignmentsError } = await adminClient
    .from('trip_sheet_assignments')
    .select('trip_sheet_id, resource_user_id')
    .in('trip_sheet_id', tripSheetIds)

  if (assignmentsError) {
    return {
      ok: false,
      tripId: normalizedTripId,
      recipientCount: 0,
      successCount: 0,
      failureCount: 0,
      status: 'failed',
      message: assignmentsError.message,
    }
  }

  const assignments = (assignmentData as AssignmentRecord[] | null) ?? []
  const resourceUserIds = Array.from(
    new Set(assignments.map((assignment) => assignment.resource_user_id).filter(Boolean))
  )

  if (resourceUserIds.length === 0) {
    return {
      ok: true,
      tripId: normalizedTripId,
      recipientCount: 0,
      successCount: 0,
      failureCount: 0,
      status: 'failed',
      message: 'No assigned resources were found for this trip.',
    }
  }

  const { data: profileData, error: profilesError } = await adminClient
    .from('profiles')
    .select('id, full_name, email, is_active')
    .in('id', resourceUserIds)

  if (profilesError) {
    return {
      ok: false,
      tripId: normalizedTripId,
      recipientCount: 0,
      successCount: 0,
      failureCount: 0,
      status: 'failed',
      message: profilesError.message,
    }
  }

  const profiles = (profileData as ProfileRecord[] | null) ?? []
  const profilesById = new Map<string, ProfileRecord>()

  for (const recipientProfile of profiles) {
    profilesById.set(recipientProfile.id, recipientProfile)
  }

  const tripSheetsByResourceUserId = new Map<string, TripSheetRecord[]>()
  const tripSheetIdsByResourceUserId = new Map<string, Set<string>>()

  for (const assignment of assignments) {
    const tripSheet = tripSheetsById.get(assignment.trip_sheet_id)

    if (!tripSheet) {
      continue
    }

    const currentTripSheetIds =
      tripSheetIdsByResourceUserId.get(assignment.resource_user_id) ?? new Set<string>()

    if (currentTripSheetIds.has(tripSheet.id)) {
      continue
    }

    currentTripSheetIds.add(tripSheet.id)
    tripSheetIdsByResourceUserId.set(assignment.resource_user_id, currentTripSheetIds)

    const currentTripSheets =
      tripSheetsByResourceUserId.get(assignment.resource_user_id) ?? []

    currentTripSheets.push(tripSheet)
    tripSheetsByResourceUserId.set(assignment.resource_user_id, currentTripSheets)
  }

  const recipientCount = tripSheetsByResourceUserId.size

  if (recipientCount === 0) {
    return {
      ok: true,
      tripId: normalizedTripId,
      recipientCount: 0,
      successCount: 0,
      failureCount: 0,
      status: 'failed',
      message: 'No assigned resources were found for this trip.',
    }
  }

  const tripTitle = trip.title?.trim() || 'Untitled trip'
  const subject = `Trip details: ${tripTitle}`
  const { data: notificationData, error: notificationError } = await adminClient
    .from('trip_notifications')
    .insert({
      trip_id: normalizedTripId,
      sent_by_user_id: user.id,
      recipient_count: recipientCount,
      success_count: 0,
      failure_count: 0,
      status: 'failed',
      subject,
    })
    .select('id')
    .single()

  const notification =
    (notificationData as { id: string } | null) ?? null

  if (notificationError || !notification) {
    return {
      ok: false,
      tripId: normalizedTripId,
      recipientCount,
      successCount: 0,
      failureCount: recipientCount,
      status: 'failed',
      message: notificationError?.message ?? 'Trip notification could not be logged.',
    }
  }

  let successCount = 0
  let failureCount = 0

  for (const [resourceUserId, assignedTripSheets] of tripSheetsByResourceUserId.entries()) {
    const recipientProfile = profilesById.get(resourceUserId) ?? null
    const recipientName = recipientProfile?.full_name?.trim() || 'there'
    const recipientEmail = recipientProfile?.email?.trim() ?? ''
    const isEmailValid = recipientEmail.includes('@')

    if (!recipientProfile || recipientProfile.is_active === false || !isEmailValid) {
      failureCount += 1

      await adminClient.from('trip_notification_recipients').insert({
        trip_notification_id: notification.id,
        resource_user_id: resourceUserId,
        email: recipientEmail,
        delivery_status: 'skipped',
        error_message: !recipientProfile
          ? 'Recipient profile not found.'
          : recipientProfile.is_active === false
            ? 'Recipient profile is inactive.'
            : 'Recipient email is missing or invalid.',
      })

      continue
    }

    try {
      await sendTripNotificationEmail({
        to: recipientEmail,
        resourceName: recipientName,
        tripId: normalizedTripId,
        tripTitle,
        tripStartDate: trip.start_date,
        tripEndDate: trip.end_date,
        destination: getDestinationName(trip.destination),
        tripSheets: assignedTripSheets
          .filter((tripSheet) => tripSheet.start_date)
          .map((tripSheet) => ({
            title: tripSheet.title?.trim() || 'Untitled trip sheet',
            startDate: tripSheet.start_date ?? '',
            startTime: tripSheet.start_time,
            endDate: tripSheet.end_date,
            endTime: tripSheet.end_time,
          })),
      })

      successCount += 1

      await adminClient.from('trip_notification_recipients').insert({
        trip_notification_id: notification.id,
        resource_user_id: resourceUserId,
        email: recipientEmail,
        delivery_status: 'sent',
        error_message: null,
      })
    } catch (error) {
      failureCount += 1

      await adminClient.from('trip_notification_recipients').insert({
        trip_notification_id: notification.id,
        resource_user_id: resourceUserId,
        email: recipientEmail,
        delivery_status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown email send error.',
      })
    }
  }

  const status: TripNotificationResult['status'] =
    successCount === recipientCount
      ? 'success'
      : successCount === 0
        ? 'failed'
        : 'partial_failure'

  await adminClient
    .from('trip_notifications')
    .update({
      success_count: successCount,
      failure_count: failureCount,
      status,
    })
    .eq('id', notification.id)

  return {
    ok: successCount > 0,
    tripId: normalizedTripId,
    recipientCount,
    successCount,
    failureCount,
    status,
    message: getResultMessage({
      recipientCount,
      successCount,
      failureCount,
      status,
    }),
  }
}
