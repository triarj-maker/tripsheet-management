'use server'

import { redirect } from 'next/navigation'

import { requireAdmin } from './lib'

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

  const { error } = await supabase.from('trip_sheets').insert({
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

  if (error) {
    redirect(buildNewTripSheetRedirect(error.message))
  }

  redirect('/dashboard/trip-sheets')
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

  if (!title || !destination || !startDate || !endDate || !guestName || !body.trim()) {
    redirect(
      buildEditTripSheetRedirect(
        id,
        'Title, destination, dates, guest name, and body are required.'
      )
    )
  }

  const { error } = await supabase
    .from('trip_sheets')
    .update({
      title,
      destination,
      start_date: startDate,
      end_date: endDate,
      guest_name: guestName,
      company: company || null,
      phone_number: phoneNumber || null,
      body_text: body,
      last_updated_by: user.id,
    })
    .eq('id', id)

  if (error) {
    redirect(buildEditTripSheetRedirect(id, error.message))
  }

  redirect('/dashboard/trip-sheets')
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

  redirect('/dashboard/trip-sheets')
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

  redirect(`/dashboard/trip-sheets/${tripSheetId}/edit`)
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

  redirect(`/dashboard/trip-sheets/${tripSheetId}/edit`)
}
