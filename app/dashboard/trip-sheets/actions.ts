'use server'

import { redirect } from 'next/navigation'

import { appendToastParam } from '@/app/lib/action-feedback'
import { sendAssignmentEmail } from '@/lib/email'

import { requireAdmin } from './lib'
import {
  guestOrCompanyRequiredMessage,
  hasGuestOrCompany,
} from './validation'

function buildNewTripSheetRedirect(error: string) {
  const params = new URLSearchParams({ error })
  return `/dashboard/trip-sheets/new?${params.toString()}`
}

function buildTripSheetsRedirect(error: string) {
  const params = new URLSearchParams({ error })
  return `/dashboard/trip-sheets?${params.toString()}`
}

function buildEditTripSheetRedirect(id: string, error: string) {
  const params = new URLSearchParams({ error })
  return `/dashboard/trip-sheets/${id}/edit?${params.toString()}`
}

async function notifyAssignmentIfNeeded({
  supabase,
  tripSheetId,
  resourceUserId,
}: {
  supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase']
  tripSheetId: string
  resourceUserId: string
}) {
  // 1. Check if notification already exists
  const { data: existingNotification } = await supabase
    .from('trip_sheet_notifications')
    .select('id')
    .eq('trip_sheet_id', tripSheetId)
    .eq('resource_user_id', resourceUserId)
    .eq('notification_type', 'assignment')
    .maybeSingle()

  if (existingNotification) {
    return
  }

  // 2. Get resource details
  const { data: resource, error: resourceError } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('id', resourceUserId)
    .maybeSingle()

  if (resourceError || !resource || !resource.email) {
    await supabase.from('trip_sheet_notifications').insert({
      trip_sheet_id: tripSheetId,
      resource_user_id: resourceUserId,
      notification_type: 'assignment',
      email: resource?.email ?? '',
      status: 'failed',
      error_message: resourceError?.message ?? 'Assigned resource email not found.',
    })
    return
  }

  // 3. Get trip details
  const { data: tripSheet, error: tripSheetError } = await supabase
    .from('trip_sheets')
    .select('id, title, start_date, end_date, guest_name, company')
    .eq('id', tripSheetId)
    .maybeSingle()

  if (tripSheetError || !tripSheet) {
    await supabase.from('trip_sheet_notifications').insert({
      trip_sheet_id: tripSheetId,
      resource_user_id: resourceUserId,
      notification_type: 'assignment',
      email: resource.email,
      status: 'failed',
      error_message: tripSheetError?.message ?? 'Trip sheet not found for notification.',
    })
    return
  }

  // 4. Send email and log result
  try {
    await sendAssignmentEmail({
      to: resource.email,
      resourceName: resource.full_name,
      tripTitle: tripSheet.title,
      startDate: tripSheet.start_date,
      endDate: tripSheet.end_date,
      customer: tripSheet.guest_name || tripSheet.company,
      tripId: tripSheet.id,
    })

    await supabase.from('trip_sheet_notifications').insert({
      trip_sheet_id: tripSheet.id,
      resource_user_id: resource.id,
      notification_type: 'assignment',
      email: resource.email,
      status: 'sent',
    })
  } catch (err: unknown) {
    await supabase.from('trip_sheet_notifications').insert({
      trip_sheet_id: tripSheet.id,
      resource_user_id: resource.id,
      notification_type: 'assignment',
      email: resource.email,
      status: 'failed',
      error_message:
        err instanceof Error ? err.message : 'Unknown email sending error.',
    })
  }
}

export async function createTripSheet(formData: FormData) {
  const { supabase, user } = await requireAdmin()

  const title = String(formData.get('title') ?? '').trim()
  const destination = String(formData.get('destination') ?? '').trim()
  const startDate = String(formData.get('start_date') ?? '').trim()
  const endDate = String(formData.get('end_date') ?? '').trim()
  const guestName = String(formData.get('guest_name') ?? '').trim()
  const company = String(formData.get('company') ?? '').trim()
  const phoneNumber = String(formData.get('phone_number') ?? '').trim()
  const templateId = String(formData.get('template_id') ?? '').trim()
  const body = String(formData.get('body') ?? '')
  const resourceUserIds = Array.from(
    new Set(
      formData
        .getAll('resource_user_ids')
        .map((value) => String(value).trim())
        .filter(Boolean)
    )
  )

  if (
    !title ||
    !destination ||
    !startDate ||
    !endDate ||
    !templateId ||
    !body.trim()
  ) {
    redirect(
      buildNewTripSheetRedirect(
        'Title, destination, dates, template, and body are required.'
      )
    )
  }

  if (!hasGuestOrCompany(guestName, company)) {
    redirect(buildNewTripSheetRedirect(guestOrCompanyRequiredMessage))
  }

  const { data: tripSheet, error } = await supabase
    .from('trip_sheets')
    .insert({
      title,
      destination,
      start_date: startDate,
      end_date: endDate,
      guest_name: guestName || null,
      company: company || null,
      phone_number: phoneNumber || null,
      template_id: templateId,
      body_text: body,
      is_archived: false,
      created_by: user.id,
      last_updated_by: user.id,
    })
    .select('id, title, start_date, end_date, guest_name, company')
    .single()

  if (error) {
    redirect(buildNewTripSheetRedirect(error.message))
  }

  if (!tripSheet) {
    redirect(buildNewTripSheetRedirect('Trip sheet could not be created.'))
  }

  if (resourceUserIds.length > 0) {
    const { error: assignmentError } = await supabase
      .from('trip_sheet_assignments')
      .insert(
        resourceUserIds.map((resourceUserId) => ({
          trip_sheet_id: tripSheet.id,
          resource_user_id: resourceUserId,
          assigned_by: user.id,
        }))
      )

    if (assignmentError) {
      redirect(
        buildEditTripSheetRedirect(
          tripSheet.id,
          `Trip sheet was created, but assignments could not be saved: ${assignmentError.message}`
        )
      )
    }

    for (const resourceUserId of resourceUserIds) {
      await notifyAssignmentIfNeeded({
        supabase,
        tripSheetId: tripSheet.id,
        resourceUserId,
      })
    }
  }

  redirect(appendToastParam('/dashboard/trip-sheets'))
}

export async function updateTripSheet(formData: FormData) {
  const { supabase, user } = await requireAdmin()
  const id = String(formData.get('id') ?? '').trim()

  if (!id) {
    redirect(buildTripSheetsRedirect('Trip sheet not found.'))
  }

  const title = String(formData.get('title') ?? '').trim()
  const destination = String(formData.get('destination') ?? '').trim()
  const startDate = String(formData.get('start_date') ?? '').trim()
  const endDate = String(formData.get('end_date') ?? '').trim()
  const guestName = String(formData.get('guest_name') ?? '').trim()
  const company = String(formData.get('company') ?? '').trim()
  const phoneNumber = String(formData.get('phone_number') ?? '').trim()
  const body = String(formData.get('body') ?? '')

  if (!title || !destination || !startDate || !endDate || !body.trim()) {
    redirect(
      buildEditTripSheetRedirect(
        id,
        'Title, destination, dates, and body are required.'
      )
    )
  }

  if (!hasGuestOrCompany(guestName, company)) {
    redirect(buildEditTripSheetRedirect(id, guestOrCompanyRequiredMessage))
  }

  const { error } = await supabase
    .from('trip_sheets')
    .update({
      title,
      destination,
      start_date: startDate,
      end_date: endDate,
      guest_name: guestName || null,
      company: company || null,
      phone_number: phoneNumber || null,
      body_text: body,
      last_updated_by: user.id,
    })
    .eq('id', id)

  if (error) {
    redirect(buildEditTripSheetRedirect(id, error.message))
  }

  redirect(appendToastParam('/dashboard/trip-sheets'))
}

export async function archiveTripSheet(formData: FormData) {
  const { supabase, user } = await requireAdmin()
  const id = String(formData.get('id') ?? '').trim()

  if (!id) {
    redirect(buildTripSheetsRedirect('Trip sheet not found.'))
  }

  const { error } = await supabase
    .from('trip_sheets')
    .update({
      is_archived: true,
      last_updated_by: user.id,
    })
    .eq('id', id)

  if (error) {
    redirect(buildEditTripSheetRedirect(id, error.message))
  }

  redirect(appendToastParam('/dashboard/trip-sheets'))
}

export async function unarchiveTripSheet(formData: FormData) {
  const { supabase, user } = await requireAdmin()
  const id = String(formData.get('id') ?? '').trim()

  if (!id) {
    redirect(buildTripSheetsRedirect('Trip sheet not found.'))
  }

  const { error } = await supabase
    .from('trip_sheets')
    .update({
      is_archived: false,
      last_updated_by: user.id,
    })
    .eq('id', id)

  if (error) {
    redirect(buildTripSheetsRedirect(error.message))
  }

  redirect(appendToastParam('/dashboard/trip-sheets?showArchived=true'))
}

export async function deleteArchivedTripSheet(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') ?? '').trim()

  if (!id) {
    redirect(buildTripSheetsRedirect('Trip sheet not found.'))
  }

  const { data: tripSheet, error: tripSheetError } = await supabase
    .from('trip_sheets')
    .select('id, is_archived')
    .eq('id', id)
    .maybeSingle()

  if (tripSheetError) {
    redirect(buildTripSheetsRedirect(tripSheetError.message))
  }

  if (!tripSheet) {
    redirect(buildTripSheetsRedirect('Trip sheet not found.'))
  }

  if (!tripSheet.is_archived) {
    redirect(buildTripSheetsRedirect('Only archived trip sheets can be deleted.'))
  }

  const { error: assignmentsError } = await supabase
    .from('trip_sheet_assignments')
    .delete()
    .eq('trip_sheet_id', id)

  if (assignmentsError) {
    redirect(buildTripSheetsRedirect(assignmentsError.message))
  }

  const { error: deleteError } = await supabase
    .from('trip_sheets')
    .delete()
    .eq('id', id)

  if (deleteError) {
    redirect(buildTripSheetsRedirect(deleteError.message))
  }

  redirect(appendToastParam('/dashboard/trip-sheets?showArchived=true'))
}

export async function assignResourceToTripSheet(formData: FormData) {
  const { supabase, user } = await requireAdmin()
  const tripSheetId = String(formData.get('trip_sheet_id') ?? '').trim()
  const resourceUserId = String(formData.get('resource_user_id') ?? '').trim()

  if (!tripSheetId || !resourceUserId) {
    redirect(
      buildEditTripSheetRedirect(
        tripSheetId,
        'Please select a resource to assign.'
      )
    )
  }

  const { data: existingAssignment } = await supabase
    .from('trip_sheet_assignments')
    .select('id')
    .eq('trip_sheet_id', tripSheetId)
    .eq('resource_user_id', resourceUserId)
    .maybeSingle()

  if (existingAssignment) {
    redirect(buildEditTripSheetRedirect(tripSheetId, 'Resource is already assigned.'))
  }

  const { error } = await supabase.from('trip_sheet_assignments').insert({
    trip_sheet_id: tripSheetId,
    resource_user_id: resourceUserId,
    assigned_by: user.id,
  })

  if (error) {
    redirect(buildEditTripSheetRedirect(tripSheetId, error.message))
  }

  await notifyAssignmentIfNeeded({
    supabase,
    tripSheetId,
    resourceUserId,
  })

  redirect(appendToastParam(`/dashboard/trip-sheets/${tripSheetId}/edit`))
}

export async function removeResourceFromTripSheet(formData: FormData) {
  const { supabase } = await requireAdmin()
  const tripSheetId = String(formData.get('trip_sheet_id') ?? '').trim()
  const assignmentId = String(formData.get('assignment_id') ?? '').trim()

  if (!tripSheetId || !assignmentId) {
    redirect(buildTripSheetsRedirect('Assignment not found.'))
  }

  const { error } = await supabase
    .from('trip_sheet_assignments')
    .delete()
    .eq('id', assignmentId)
    .eq('trip_sheet_id', tripSheetId)

  if (error) {
    redirect(buildEditTripSheetRedirect(tripSheetId, error.message))
  }

  redirect(appendToastParam(`/dashboard/trip-sheets/${tripSheetId}/edit`))
}
