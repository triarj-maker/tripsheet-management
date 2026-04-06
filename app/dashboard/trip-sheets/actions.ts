'use server'

import { redirect } from 'next/navigation'

import { appendToastParam } from '@/app/lib/action-feedback'
import {
  isDateRangeOrdered,
  isTripSheetWithinTripRange,
  tripSheetDateRangeMessage,
  tripSheetWithinTripRangeMessage,
} from '@/lib/trip-date-validation'

import {
  insertTripSheetAssignments,
} from './trip-sheet-assignments'
import { requireAdmin } from './lib'

function buildTripSheetsRedirect(error: string) {
  const params = new URLSearchParams({ error })
  return `/dashboard/trips?${params.toString()}`
}

function buildTripDetailPath(tripId: string) {
  return `/dashboard/trips/${tripId}`
}

function buildNewTripSheetRedirect(
  error: string,
  tripId: string,
  duplicateFrom?: string
) {
  const params = new URLSearchParams({ error, tripId })

  if (duplicateFrom) {
    params.set('duplicateFrom', duplicateFrom)
  }

  return `/dashboard/trip-sheets/new?${params.toString()}`
}

function buildEditTripSheetRedirect(id: string, error: string) {
  const params = new URLSearchParams({ error })
  return `/dashboard/trip-sheets/${id}/edit?${params.toString()}`
}

function appendErrorParam(path: string, error: string) {
  const [pathname, queryString = ''] = path.split('?')
  const params = new URLSearchParams(queryString)
  params.set('error', error)

  const nextQuery = params.toString()

  return nextQuery ? `${pathname}?${nextQuery}` : pathname
}

function getReturnPath(formData: FormData, fallback: string) {
  const returnPath = String(formData.get('return_path') ?? '').trim()

  if (returnPath.startsWith('/')) {
    return returnPath
  }

  return fallback
}

export async function createTripSheet(formData: FormData) {
  const { supabase, user } = await requireAdmin()

  const tripId = String(formData.get('trip_id') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim()
  const startDate = String(formData.get('start_date') ?? '').trim()
  const startTime = String(formData.get('start_time') ?? '').trim()
  const endDate = String(formData.get('end_date') ?? '').trim() || startDate
  const endTime = String(formData.get('end_time') ?? '').trim()
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

  if (!tripId || !title || !startDate || !body.trim()) {
    redirect(buildNewTripSheetRedirect('Title, dates, and body are required.', tripId))
  }

  if (!isDateRangeOrdered(startDate, endDate)) {
    redirect(buildNewTripSheetRedirect(tripSheetDateRangeMessage, tripId))
  }

  const { data: trip } = await supabase
    .from('trips')
    .select('id, start_date, end_date')
    .eq('id', tripId)
    .maybeSingle()

  if (!trip) {
    redirect(buildTripSheetsRedirect('Parent trip not found.'))
  }

  if (
    !isTripSheetWithinTripRange({
      tripStartDate: (trip as { start_date: string | null }).start_date ?? '',
      tripEndDate: (trip as { end_date: string | null }).end_date ?? '',
      tripSheetStartDate: startDate,
      tripSheetEndDate: endDate,
    })
  ) {
    redirect(buildNewTripSheetRedirect(tripSheetWithinTripRangeMessage, tripId))
  }

  const { data: tripSheet, error } = await supabase
    .from('trip_sheets')
    .insert({
      trip_id: tripId,
      title,
      start_date: startDate,
      start_time: startTime || null,
      end_date: endDate,
      end_time: endTime || null,
      template_id: templateId || null,
      body_text: body,
      is_archived: false,
      created_by: user.id,
      last_updated_by: user.id,
    })
    .select('id, trip_id')
    .single()

  if (error) {
    redirect(buildNewTripSheetRedirect(error.message, tripId))
  }

  if (!tripSheet) {
    redirect(buildNewTripSheetRedirect('Trip sheet could not be created.', tripId))
  }

  if (resourceUserIds.length > 0) {
    const { error: assignmentError } = await insertTripSheetAssignments({
      supabase,
      tripSheetId: tripSheet.id,
      resourceUserIds,
      assignedBy: user.id,
    })

    if (assignmentError) {
      redirect(
        buildEditTripSheetRedirect(
          tripSheet.id,
          `Trip sheet was created, but assignments could not be saved: ${assignmentError.message}`
        )
      )
    }
  }

  redirect(appendToastParam(buildTripDetailPath(tripId)))
}

export async function updateTripSheet(formData: FormData) {
  const { supabase, user } = await requireAdmin()
  const id = String(formData.get('id') ?? '').trim()
  const tripId = String(formData.get('trip_id') ?? '').trim()

  if (!id) {
    redirect(buildTripSheetsRedirect('Trip sheet not found.'))
  }

  const title = String(formData.get('title') ?? '').trim()
  const startDate = String(formData.get('start_date') ?? '').trim()
  const startTime = String(formData.get('start_time') ?? '').trim()
  const endDate = String(formData.get('end_date') ?? '').trim()
  const endTime = String(formData.get('end_time') ?? '').trim()
  const body = String(formData.get('body') ?? '')

  if (!tripId || !title || !startDate || !endDate || !body.trim()) {
    redirect(
      buildEditTripSheetRedirect(
        id,
        'Title, dates, and body are required.'
      )
    )
  }

  if (!isDateRangeOrdered(startDate, endDate)) {
    redirect(buildEditTripSheetRedirect(id, tripSheetDateRangeMessage))
  }

  const { data: existingTripSheetData, error: existingTripSheetError } = await supabase
    .from('trip_sheets')
    .select('id, start_date, start_time, end_date, end_time')
    .eq('id', id)
    .maybeSingle()

  const existingTripSheet =
    (existingTripSheetData as {
      id: string
      start_date: string | null
      start_time: string | null
      end_date: string | null
      end_time: string | null
    } | null) ?? null

  if (existingTripSheetError || !existingTripSheet) {
    redirect(
      buildEditTripSheetRedirect(
        id,
        existingTripSheetError?.message ?? 'Trip sheet not found.'
      )
    )
  }

  const { data: trip } = await supabase
    .from('trips')
    .select('id, start_date, end_date')
    .eq('id', tripId)
    .maybeSingle()

  if (!trip) {
    redirect(buildTripSheetsRedirect('Parent trip not found.'))
  }

  if (
    !isTripSheetWithinTripRange({
      tripStartDate: (trip as { start_date: string | null }).start_date ?? '',
      tripEndDate: (trip as { end_date: string | null }).end_date ?? '',
      tripSheetStartDate: startDate,
      tripSheetEndDate: endDate,
    })
  ) {
    redirect(buildEditTripSheetRedirect(id, tripSheetWithinTripRangeMessage))
  }

  const { error } = await supabase
    .from('trip_sheets')
    .update({
      title,
      start_date: startDate,
      start_time: startTime || null,
      end_date: endDate,
      end_time: endTime || null,
      body_text: body,
      last_updated_by: user.id,
    })
    .eq('id', id)

  if (error) {
    redirect(buildEditTripSheetRedirect(id, error.message))
  }

  redirect(appendToastParam(buildTripDetailPath(tripId)))
}

export async function deleteTripSheet(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') ?? '').trim()
  const tripId = String(formData.get('trip_id') ?? '').trim()

  if (!id) {
    redirect(buildTripSheetsRedirect('Trip sheet not found.'))
  }

  const { data: tripSheet, error: tripSheetError } = await supabase
    .from('trip_sheets')
    .select('id, trip_id')
    .eq('id', id)
    .maybeSingle()

  if (tripSheetError) {
    redirect(buildEditTripSheetRedirect(id, tripSheetError.message))
  }

  if (!tripSheet) {
    redirect(buildTripSheetsRedirect('Trip sheet not found.'))
  }

  const resolvedTripId = tripId || tripSheet.trip_id || ''

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
    redirect(buildEditTripSheetRedirect(id, deleteError.message))
  }

  redirect(
    appendToastParam(resolvedTripId ? buildTripDetailPath(resolvedTripId) : '/dashboard/trips')
  )
}

export async function assignResourceToTripSheet(formData: FormData) {
  const { supabase, user } = await requireAdmin()
  const tripSheetId = String(formData.get('trip_sheet_id') ?? '').trim()
  const resourceUserId = String(formData.get('resource_user_id') ?? '').trim()
  const returnPath = getReturnPath(
    formData,
    `/dashboard/trip-sheets/${tripSheetId}/edit`
  )

  if (!tripSheetId || !resourceUserId) {
    redirect(appendErrorParam(returnPath, 'Please select a resource to assign.'))
  }

  const { data: existingAssignment } = await supabase
    .from('trip_sheet_assignments')
    .select('id')
    .eq('trip_sheet_id', tripSheetId)
    .eq('resource_user_id', resourceUserId)
    .maybeSingle()

  if (existingAssignment) {
    redirect(appendErrorParam(returnPath, 'Resource is already assigned.'))
  }

  const { error } = await supabase.from('trip_sheet_assignments').insert({
    trip_sheet_id: tripSheetId,
    resource_user_id: resourceUserId,
    assigned_by: user.id,
  })

  if (error) {
    redirect(appendErrorParam(returnPath, error.message))
  }

  redirect(appendToastParam(returnPath))
}

export async function removeResourceFromTripSheet(formData: FormData) {
  const { supabase } = await requireAdmin()
  const tripSheetId = String(formData.get('trip_sheet_id') ?? '').trim()
  const assignmentId = String(formData.get('assignment_id') ?? '').trim()
  const returnPath = getReturnPath(
    formData,
    `/dashboard/trip-sheets/${tripSheetId}/edit`
  )

  if (!tripSheetId || !assignmentId) {
    redirect(appendErrorParam(returnPath, 'Assignment not found.'))
  }

  await supabase
    .from('trip_sheet_assignments')
    .select('trip_sheet_id, resource_user_id')
    .eq('id', assignmentId)
    .eq('trip_sheet_id', tripSheetId)
    .maybeSingle()

  const { error } = await supabase
    .from('trip_sheet_assignments')
    .delete()
    .eq('id', assignmentId)
    .eq('trip_sheet_id', tripSheetId)

  if (error) {
    redirect(appendErrorParam(returnPath, error.message))
  }

  redirect(appendToastParam(returnPath))
}
