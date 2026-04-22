'use server'

import { redirect } from 'next/navigation'

import { appendToastParam } from '@/app/lib/action-feedback'
import {
  getNextTripColorByIndex,
  normalizeTripColorInput,
} from '@/lib/trip-colors'
import {
  isDateRangeOrdered,
  isTripSheetWithinTripRange,
  tripDateRangeMessage,
  tripDateRequiredMessage,
  tripSheetDateRangeMessage,
  tripSheetDateRequiredMessage,
  tripSheetWithinTripRangeMessage,
} from '@/lib/trip-date-validation'
import { normalizeTripTypeInput } from '@/lib/trip-sheets'
import { createAdminClient } from '@/lib/supabase/admin'

import { insertTripSheetAssignments } from '../trip-sheets/trip-sheet-assignments'
import {
  guestOrCompanyRequiredMessage,
  hasGuestOrCompany,
} from '../trip-sheets/validation'
import { requireAdmin } from '../lib'

type DestinationRecord = {
  id: string
  name: string | null
}

type TripRecordForWrite = {
  id: string
  title: string | null
  trip_type: string | null
  destination_id: string | null
  trip_color: string | null
  adult_count: number | null
  kid_count: number | null
  start_date: string | null
  end_date: string | null
  is_archived: boolean | null
  guest_name: string | null
  company: string | null
  phone_number: string | null
}

type SourceTripCloneRecord = {
  id: string
  start_date: string | null
}

type SourceTripSheetCloneRecord = {
  title: string | null
  start_date: string | null
  start_time: string | null
  end_date: string | null
  end_time: string | null
  body_text: string | null
  template_id: string | null
}

function shiftTripSheetDatesFromTripStart({
  sourceTripStartDate,
  targetTripStartDate,
  targetTripEndDate,
  tripSheetStartDate,
  tripSheetEndDate,
  missingDatesMessage,
  shiftFailureMessage,
  outOfRangeMessage,
}: {
  sourceTripStartDate: string
  targetTripStartDate: string
  targetTripEndDate: string
  tripSheetStartDate: string | null
  tripSheetEndDate: string | null
  missingDatesMessage: string
  shiftFailureMessage: string
  outOfRangeMessage?: string
}) {
  if (!tripSheetStartDate || !tripSheetEndDate) {
    return {
      error: missingDatesMessage,
    }
  }

  const startOffset = getDateOffsetInDays(sourceTripStartDate, tripSheetStartDate)
  const endOffset = getDateOffsetInDays(sourceTripStartDate, tripSheetEndDate)

  if (startOffset === null || endOffset === null) {
    return {
      error: missingDatesMessage,
    }
  }

  const shiftedStartDate = addDaysToDateString(targetTripStartDate, startOffset)
  const shiftedEndDate = addDaysToDateString(targetTripStartDate, endOffset)

  if (!shiftedStartDate || !shiftedEndDate) {
    return {
      error: shiftFailureMessage,
    }
  }

  if (!isDateRangeOrdered(shiftedStartDate, shiftedEndDate)) {
    return {
      error: tripSheetDateRangeMessage,
    }
  }

  if (
    outOfRangeMessage &&
    !isTripSheetWithinTripRange({
      tripStartDate: targetTripStartDate,
      tripEndDate: targetTripEndDate,
      tripSheetStartDate: shiftedStartDate,
      tripSheetEndDate: shiftedEndDate,
    })
  ) {
    return {
      error: outOfRangeMessage,
    }
  }

  return {
    startDate: shiftedStartDate,
    endDate: shiftedEndDate,
  }
}

function parseCountInput(value: FormDataEntryValue | null) {
  const normalizedValue = String(value ?? '').trim()

  if (!normalizedValue) {
    return 0
  }

  const parsedValue = Number.parseInt(normalizedValue, 10)

  if (Number.isNaN(parsedValue) || parsedValue < 0) {
    return 0
  }

  return parsedValue
}

async function getDestinationForWrite(
  supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'],
  destinationId: string
) {
  if (!destinationId) {
    return {
      destination: null,
      error: 'Destination is required.',
    }
  }

  let data: DestinationRecord | null = null
  let errorMessage: string | null = null

  const { data: sessionData, error: sessionError } = await supabase
    .from('destinations')
    .select('id, name')
    .eq('id', destinationId)
    .maybeSingle()

  data = (sessionData as DestinationRecord | null) ?? null
  errorMessage = sessionError?.message ?? null

  if (!data) {
    try {
      const adminClient = createAdminClient()
      const { data: adminData, error: adminError } = await adminClient
        .from('destinations')
        .select('id, name')
        .eq('id', destinationId)
        .maybeSingle()

      data = (adminData as DestinationRecord | null) ?? null
      errorMessage = adminError?.message ?? errorMessage
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : errorMessage
    }
  }

  if (errorMessage && !data) {
    return {
      destination: null,
      error: errorMessage,
    }
  }

  if (!data) {
    return {
      destination: null,
      error: 'Selected destination was not found.',
    }
  }

  return {
    destination: data,
    error: null,
  }
}

async function getExistingTripForWrite(
  supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'],
  tripId: string
) {
  if (!tripId) {
    return {
      trip: null,
      error: 'Trip not found.',
    }
  }

  let data: TripRecordForWrite | null = null
  let errorMessage: string | null = null

  const selectClause =
    'id, title, trip_type, destination_id, trip_color, adult_count, kid_count, start_date, end_date, is_archived, guest_name, company, phone_number'

  const { data: sessionData, error: sessionError } = await supabase
    .from('trips')
    .select(selectClause)
    .eq('id', tripId)
    .maybeSingle()

  data = (sessionData as TripRecordForWrite | null) ?? null
  errorMessage = sessionError?.message ?? null

  if (!data || !data.start_date || !data.end_date) {
    try {
      const adminClient = createAdminClient()
      const { data: adminData, error: adminError } = await adminClient
        .from('trips')
        .select(selectClause)
        .eq('id', tripId)
        .maybeSingle()

      data = (adminData as TripRecordForWrite | null) ?? null
      errorMessage = adminError?.message ?? errorMessage
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : errorMessage
    }
  }

  if (errorMessage && !data) {
    return {
      trip: null,
      error: errorMessage,
    }
  }

  if (!data) {
    return {
      trip: null,
      error: 'Trip not found.',
    }
  }

  return {
    trip: data,
    error: null,
  }
}

function buildTripsRedirect(error: string) {
  const params = new URLSearchParams({ error })
  return `/dashboard/trips?${params.toString()}`
}

function buildNewTripRedirect(error: string, options?: { cloneFrom?: string }) {
  const params = new URLSearchParams({ error })

  if (options?.cloneFrom) {
    params.set('cloneFrom', options.cloneFrom)
  }

  return `/dashboard/trips/new?${params.toString()}`
}

function buildEditTripRedirect(id: string, error: string) {
  const params = new URLSearchParams({ error })
  return `/dashboard/trips/${id}/edit?${params.toString()}`
}

function buildTripDetailRedirect(id: string, error: string) {
  const params = new URLSearchParams({ error })
  return `/dashboard/trips/${id}?${params.toString()}`
}

function getReturnPath(formData: FormData, fallback: string) {
  const returnPath = String(formData.get('return_path') ?? '').trim()

  if (returnPath.startsWith('/')) {
    return returnPath
  }

  return fallback
}

function appendErrorParam(path: string, error: string) {
  const [pathname, queryString = ''] = path.split('?')
  const params = new URLSearchParams(queryString)
  params.set('error', error)

  const nextQuery = params.toString()

  return nextQuery ? `${pathname}?${nextQuery}` : pathname
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)

  if (!year || !month || !day) {
    return null
  }

  return new Date(Date.UTC(year, month - 1, day))
}

function getDateOffsetInDays(baseDate: string, nextDate: string) {
  const parsedBaseDate = parseIsoDate(baseDate)
  const parsedNextDate = parseIsoDate(nextDate)

  if (!parsedBaseDate || !parsedNextDate) {
    return null
  }

  return Math.round(
    (parsedNextDate.getTime() - parsedBaseDate.getTime()) / 86400000
  )
}

function addDaysToDateString(value: string, offsetInDays: number) {
  const parsedDate = parseIsoDate(value)

  if (!parsedDate) {
    return null
  }

  parsedDate.setUTCDate(parsedDate.getUTCDate() + offsetInDays)

  const year = parsedDate.getUTCFullYear()
  const month = String(parsedDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(parsedDate.getUTCDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

async function getNextAutoAssignedTripColor(
  supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase']
) {
  const { count } = await supabase
    .from('trips')
    .select('id', { count: 'exact', head: true })

  return getNextTripColorByIndex(count ?? 0)
}

export async function createTrip(formData: FormData) {
  const { supabase, user } = await requireAdmin()

  const title = String(formData.get('title') ?? '').trim()
  const tripType = normalizeTripTypeInput(String(formData.get('trip_type') ?? ''))
  const destinationId = String(formData.get('destination_id') ?? '').trim()
  const selectedTripColor = normalizeTripColorInput(String(formData.get('trip_color') ?? ''))
  const cloneSourceTripId = String(formData.get('clone_source_trip_id') ?? '').trim()
  const adultCount = parseCountInput(formData.get('adult_count'))
  const kidCount = parseCountInput(formData.get('kid_count'))
  const tripStartDate = String(formData.get('trip_start_date') ?? '').trim()
  const tripEndDate = String(formData.get('trip_end_date') ?? '').trim()
  const guestName = String(formData.get('guest_name') ?? '').trim()
  const company = String(formData.get('company') ?? '').trim()
  const phoneNumber = String(formData.get('phone_number') ?? '').trim()
  const tripSheetTitle = String(formData.get('trip_sheet_title') ?? '').trim()
  const startDate = String(formData.get('start_date') ?? '').trim()
  const startTime = String(formData.get('start_time') ?? '').trim()
  const endDate = String(formData.get('end_date') ?? '').trim() || startDate
  const endTime = String(formData.get('end_time') ?? '').trim()
  const templateId = String(formData.get('template_id') ?? '').trim()
  const bodyText = String(formData.get('body_text') ?? '')
  const resourceUserIds = Array.from(
    new Set(
      formData
        .getAll('resource_user_ids')
        .map((value) => String(value).trim())
        .filter(Boolean)
    )
  )
  const cloneRedirectOptions = cloneSourceTripId
    ? { cloneFrom: cloneSourceTripId }
    : undefined

  if (!title || !tripType || !destinationId) {
    redirect(
      buildNewTripRedirect(
        cloneSourceTripId
          ? 'Trip details are required before cloning.'
          : 'Trip details, first trip sheet details, and body text are required.',
        cloneRedirectOptions
      )
    )
  }

  if (!tripStartDate || !tripEndDate) {
    redirect(buildNewTripRedirect(tripDateRequiredMessage, cloneRedirectOptions))
  }

  if (!isDateRangeOrdered(tripStartDate, tripEndDate)) {
    redirect(buildNewTripRedirect(tripDateRangeMessage, cloneRedirectOptions))
  }

  if (!cloneSourceTripId) {
    if (!tripSheetTitle || !startDate || !bodyText.trim()) {
      redirect(
        buildNewTripRedirect(
          'Trip details, first trip sheet details, and body text are required.'
        )
      )
    }

    if (!startDate) {
      redirect(buildNewTripRedirect(tripSheetDateRequiredMessage))
    }

    if (!isDateRangeOrdered(startDate, endDate)) {
      redirect(buildNewTripRedirect(tripSheetDateRangeMessage))
    }

    if (
      !isTripSheetWithinTripRange({
        tripStartDate,
        tripEndDate,
        tripSheetStartDate: startDate,
        tripSheetEndDate: endDate,
      })
    ) {
      redirect(buildNewTripRedirect(tripSheetWithinTripRangeMessage))
    }
  }

  if (!hasGuestOrCompany(guestName, company)) {
    redirect(buildNewTripRedirect(guestOrCompanyRequiredMessage, cloneRedirectOptions))
  }

  const destinationResult = await getDestinationForWrite(supabase, destinationId)

  if (destinationResult.error || !destinationResult.destination) {
    redirect(
      buildNewTripRedirect(
        destinationResult.error ?? 'Destination is required.',
        cloneRedirectOptions
      )
    )
  }

  const tripColor = selectedTripColor ?? (await getNextAutoAssignedTripColor(supabase))

  const { data, error } = await supabase
    .from('trips')
    .insert({
      title,
      trip_type: tripType,
      destination_id: destinationResult.destination.id,
      trip_color: tripColor,
      adult_count: adultCount,
      kid_count: kidCount,
      start_date: tripStartDate,
      end_date: tripEndDate,
      guest_name: guestName || null,
      company: company || null,
      phone_number: phoneNumber || null,
      created_by: user.id,
      last_updated_by: user.id,
    })
    .select('id')
    .single()

  if (error || !data) {
    redirect(
      buildNewTripRedirect(error?.message ?? 'Trip could not be created.', cloneRedirectOptions)
    )
  }

  if (cloneSourceTripId) {
    const { data: sourceTripData, error: sourceTripError } = await supabase
      .from('trips')
      .select('id, start_date')
      .eq('id', cloneSourceTripId)
      .maybeSingle()

    const sourceTrip = (sourceTripData as SourceTripCloneRecord | null) ?? null

    if (sourceTripError || !sourceTrip?.start_date) {
      await supabase.from('trips').delete().eq('id', data.id)
      redirect(
        buildNewTripRedirect(
          sourceTripError?.message ?? 'Source trip to clone was not found.',
          cloneRedirectOptions
        )
      )
    }

    const { data: sourceTripSheetData, error: sourceTripSheetsError } = await supabase
      .from('trip_sheets')
      .select(
        'title, start_date, start_time, end_date, end_time, body_text, template_id'
      )
      .eq('trip_id', cloneSourceTripId)
      .order('start_date', { ascending: true })
      .order('start_time', { ascending: true, nullsFirst: true })

    const sourceTripSheets =
      (sourceTripSheetData as SourceTripSheetCloneRecord[] | null) ?? []

    if (sourceTripSheetsError) {
      await supabase.from('trips').delete().eq('id', data.id)
      redirect(buildNewTripRedirect(sourceTripSheetsError.message, cloneRedirectOptions))
    }

    const clonedTripSheets = sourceTripSheets.map((tripSheet) => {
      const shiftedDates = shiftTripSheetDatesFromTripStart({
        sourceTripStartDate: sourceTrip.start_date ?? '',
        targetTripStartDate: tripStartDate,
        targetTripEndDate: tripEndDate,
        tripSheetStartDate: tripSheet.start_date,
        tripSheetEndDate: tripSheet.end_date,
        missingDatesMessage:
          'A source trip sheet is missing valid dates and could not be cloned.',
        shiftFailureMessage: 'Trip sheet dates could not be shifted for the cloned trip.',
        outOfRangeMessage:
          'Cloned trip sheet dates fall outside the new trip date range. Adjust the trip dates and try again.',
      })

      if ('error' in shiftedDates) {
        return shiftedDates
      }

      return {
        title: tripSheet.title?.trim() || 'Untitled trip sheet',
        start_date: shiftedDates.startDate,
        start_time: tripSheet.start_time || null,
        end_date: shiftedDates.endDate,
        end_time: tripSheet.end_time || null,
        template_id: tripSheet.template_id || null,
        body_text: tripSheet.body_text ?? '',
        is_archived: false,
        trip_id: data.id,
        created_by: user.id,
        last_updated_by: user.id,
      }
    })

    const cloneValidationError = clonedTripSheets.find(
      (
        value
      ): value is {
        error: string
      } => 'error' in value
    )

    if (cloneValidationError) {
      await supabase.from('trips').delete().eq('id', data.id)
      redirect(buildNewTripRedirect(cloneValidationError.error, cloneRedirectOptions))
    }

    if (clonedTripSheets.length > 0) {
      const { error: clonedTripSheetsError } = await supabase
        .from('trip_sheets')
        .insert(clonedTripSheets)

      if (clonedTripSheetsError) {
        await supabase.from('trips').delete().eq('id', data.id)
        redirect(buildNewTripRedirect(clonedTripSheetsError.message, cloneRedirectOptions))
      }
    }

    redirect(appendToastParam(`/dashboard/trips/${data.id}`))
  }

  const { data: tripSheet, error: tripSheetError } = await supabase
    .from('trip_sheets')
    .insert({
      trip_id: data.id,
      title: tripSheetTitle,
      start_date: startDate,
      start_time: startTime || null,
      end_date: endDate,
      end_time: endTime || null,
      template_id: templateId || null,
      body_text: bodyText,
      is_archived: false,
      created_by: user.id,
      last_updated_by: user.id,
    })
    .select('id')
    .single()

  if (tripSheetError || !tripSheet) {
    await supabase.from('trips').delete().eq('id', data.id)
    redirect(
      buildNewTripRedirect(tripSheetError?.message ?? 'First trip sheet could not be created.')
    )
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
        buildTripDetailRedirect(
          data.id,
          `Trip was created, but assignments could not be saved: ${assignmentError.message}`
        )
      )
    }
  }

  redirect(appendToastParam(`/dashboard/trips/${data.id}`))
}

export async function updateTrip(formData: FormData) {
  const { supabase, user } = await requireAdmin()

  const id = String(formData.get('id') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim()
  const tripType = normalizeTripTypeInput(String(formData.get('trip_type') ?? ''))
  const destinationId = String(formData.get('destination_id') ?? '').trim()
  const selectedTripColor = normalizeTripColorInput(String(formData.get('trip_color') ?? ''))
  const adultCount = parseCountInput(formData.get('adult_count'))
  const kidCount = parseCountInput(formData.get('kid_count'))
  const tripStartDate = String(formData.get('start_date') ?? '').trim()
  const tripEndDate = String(formData.get('end_date') ?? '').trim()
  const guestName = String(formData.get('guest_name') ?? '').trim()
  const company = String(formData.get('company') ?? '').trim()
  const phoneNumber = String(formData.get('phone_number') ?? '').trim()
  const archiveState = String(formData.get('archive_state') ?? '').trim()

  if (!id) {
    redirect(buildTripsRedirect('Trip not found.'))
  }

  if (!title || !tripType || !destinationId) {
    redirect(buildEditTripRedirect(id, 'Title, trip type, and destination are required.'))
  }

  if (!tripStartDate || !tripEndDate) {
    redirect(buildEditTripRedirect(id, tripDateRequiredMessage))
  }

  if (!isDateRangeOrdered(tripStartDate, tripEndDate)) {
    redirect(buildEditTripRedirect(id, tripDateRangeMessage))
  }

  if (!hasGuestOrCompany(guestName, company)) {
    redirect(buildEditTripRedirect(id, guestOrCompanyRequiredMessage))
  }

  const destinationResult = await getDestinationForWrite(supabase, destinationId)

  if (destinationResult.error || !destinationResult.destination) {
    redirect(buildEditTripRedirect(id, destinationResult.error ?? 'Destination is required.'))
  }

  const existingTripResult = await getExistingTripForWrite(supabase, id)

  if (existingTripResult.error || !existingTripResult.trip) {
    redirect(
      buildEditTripRedirect(id, existingTripResult.error ?? 'Trip not found.')
    )
  }

  const existingTrip = existingTripResult.trip
  const originalTripStartDate = String(existingTrip.start_date ?? '').trim()
  const originalTripEndDate = String(existingTrip.end_date ?? '').trim()

  if (!originalTripStartDate || !originalTripEndDate) {
    redirect(
      buildEditTripRedirect(id, 'Parent trip not found or has no valid date range')
    )
  }

  const didTripDateChange =
    originalTripStartDate !== tripStartDate ||
    originalTripEndDate !== tripEndDate

  const tripColor =
    selectedTripColor ??
    normalizeTripColorInput(existingTrip.trip_color) ??
    (await getNextAutoAssignedTripColor(supabase))

  const rollbackParentTripUpdate = async () => {
    await supabase
      .from('trips')
      .update({
        title: existingTrip.title,
        trip_type: existingTrip.trip_type,
        destination_id: existingTrip.destination_id,
        trip_color: existingTrip.trip_color,
        adult_count: existingTrip.adult_count,
        kid_count: existingTrip.kid_count,
        start_date: existingTrip.start_date,
        end_date: existingTrip.end_date,
        is_archived: existingTrip.is_archived,
        guest_name: existingTrip.guest_name,
        company: existingTrip.company,
        phone_number: existingTrip.phone_number,
        last_updated_by: user.id,
      })
      .eq('id', id)
  }

  const { error } = await supabase
    .from('trips')
    .update({
      title,
      trip_type: tripType,
      destination_id: destinationResult.destination.id,
      trip_color: tripColor,
      adult_count: adultCount,
      kid_count: kidCount,
      start_date: tripStartDate,
      end_date: tripEndDate,
      is_archived: archiveState === 'archived',
      guest_name: guestName || null,
      company: company || null,
      phone_number: phoneNumber || null,
      last_updated_by: user.id,
    })
    .eq('id', id)

  if (error) {
    redirect(buildEditTripRedirect(id, error.message))
  }

  let outOfRangeShiftedChildTripSheets: Array<{
    id: string
    start_date: string | null
    end_date: string | null
  }> = []

  if (didTripDateChange) {
    const { data: childTripSheetData, error: childTripSheetsError } = await supabase
      .from('trip_sheets')
      .select('id, start_date, end_date')
      .eq('trip_id', id)

    if (childTripSheetsError) {
      await rollbackParentTripUpdate()
      redirect(buildEditTripRedirect(id, childTripSheetsError.message))
    }

    const childTripSheets =
      ((childTripSheetData as Array<{
        id: string
        start_date: string | null
        end_date: string | null
      }> | null) ?? [])

    const shiftedChildTripSheets = childTripSheets.map((tripSheet) => {
      const shiftedDates = shiftTripSheetDatesFromTripStart({
        sourceTripStartDate: originalTripStartDate,
        targetTripStartDate: tripStartDate,
        targetTripEndDate: tripEndDate,
        tripSheetStartDate: tripSheet.start_date,
        tripSheetEndDate: tripSheet.end_date,
        missingDatesMessage:
          'A child trip sheet is missing valid dates and could not be shifted.',
        shiftFailureMessage:
          'Child trip sheet dates could not be shifted for the updated trip dates.',
      })

      if ('error' in shiftedDates) {
        return {
          id: tripSheet.id,
          error: shiftedDates.error,
        }
      }

      return {
        id: tripSheet.id,
        start_date: shiftedDates.startDate,
        end_date: shiftedDates.endDate,
      }
    })

    const shiftedChildTripSheetError = shiftedChildTripSheets.find(
      (
        tripSheet
      ): tripSheet is {
        id: string
        error: string
      } => 'error' in tripSheet
    )

    if (shiftedChildTripSheetError) {
      await rollbackParentTripUpdate()
      redirect(buildEditTripRedirect(id, shiftedChildTripSheetError.error))
    }

    const validShiftedChildTripSheets = shiftedChildTripSheets.filter(
      (
        tripSheet
      ): tripSheet is {
        id: string
        start_date: string
        end_date: string
      } =>
        typeof tripSheet.start_date === 'string' &&
        typeof tripSheet.end_date === 'string'
    )

    outOfRangeShiftedChildTripSheets = validShiftedChildTripSheets.filter((tripSheet) => {
      if (!tripSheet.start_date || !tripSheet.end_date) {
        return false
      }

      return !isTripSheetWithinTripRange({
        tripStartDate,
        tripEndDate,
        tripSheetStartDate: tripSheet.start_date,
        tripSheetEndDate: tripSheet.end_date,
      })
    })

    if (validShiftedChildTripSheets.length > 0) {
      const updatedChildTripSheets: Array<{
        id: string
        start_date: string | null
        end_date: string | null
      }> = []
      const childTripSheetById = new Map(
        childTripSheets.map((tripSheet) => [tripSheet.id, tripSheet])
      )

      for (const tripSheet of validShiftedChildTripSheets) {
        const { error: shiftedTripSheetError } = await supabase
          .from('trip_sheets')
          .update({
            start_date: tripSheet.start_date,
            end_date: tripSheet.end_date,
            last_updated_by: user.id,
          })
          .eq('id', tripSheet.id)
          .eq('trip_id', id)

        if (shiftedTripSheetError) {
          for (const updatedTripSheet of updatedChildTripSheets) {
            await supabase
              .from('trip_sheets')
              .update({
                start_date: updatedTripSheet.start_date,
                end_date: updatedTripSheet.end_date,
                last_updated_by: user.id,
              })
              .eq('id', updatedTripSheet.id)
              .eq('trip_id', id)
          }

          await rollbackParentTripUpdate()
          redirect(
            buildEditTripRedirect(
              id,
              `Child trip sheet dates could not be updated: ${shiftedTripSheetError.message}`
            )
          )
        }

        const originalTripSheet = childTripSheetById.get(tripSheet.id)

        updatedChildTripSheets.push({
          id: tripSheet.id,
          start_date: originalTripSheet?.start_date ?? null,
          end_date: originalTripSheet?.end_date ?? null,
        })
      }
    }
  }

  if (archiveState === 'active' || archiveState === 'archived') {
    const { error: archiveError } = await supabase
      .from('trip_sheets')
      .update({
        is_archived: archiveState === 'archived',
        last_updated_by: user.id,
      })
      .eq('trip_id', id)

    if (archiveError) {
      redirect(buildEditTripRedirect(id, archiveError.message))
    }
  }

  const tripUpdateToastMessage =
    outOfRangeShiftedChildTripSheets.length > 0
      ? `Trip saved. ${outOfRangeShiftedChildTripSheets.length} child trip sheet${
          outOfRangeShiftedChildTripSheets.length === 1 ? '' : 's'
        } now fall outside the trip date range.`
      : undefined

  redirect(appendToastParam(`/dashboard/trips/${id}`, tripUpdateToastMessage))
}

export async function archiveTripFromList(formData: FormData) {
  const { supabase, user } = await requireAdmin()
  const id = String(formData.get('id') ?? '').trim()
  const returnPath = getReturnPath(formData, '/dashboard/trips')

  if (!id) {
    redirect(buildTripsRedirect('Trip not found.'))
  }

  const { error: tripError } = await supabase
    .from('trips')
    .update({
      is_archived: true,
      last_updated_by: user.id,
    })
    .eq('id', id)

  if (tripError) {
    redirect(buildTripsRedirect(tripError.message))
  }

  const { error } = await supabase
    .from('trip_sheets')
    .update({
      is_archived: true,
      last_updated_by: user.id,
    })
    .eq('trip_id', id)

  if (error) {
    await supabase
      .from('trips')
      .update({
        is_archived: false,
        last_updated_by: user.id,
      })
      .eq('id', id)

    redirect(buildTripsRedirect(error.message))
  }

  redirect(appendToastParam(returnPath))
}

export async function restoreTripFromList(formData: FormData) {
  const { supabase, user } = await requireAdmin()
  const id = String(formData.get('id') ?? '').trim()
  const returnPath = getReturnPath(formData, '/dashboard/trips?showArchived=true')

  if (!id) {
    redirect(buildTripsRedirect('Trip not found.'))
  }

  const { error: tripError } = await supabase
    .from('trips')
    .update({
      is_archived: false,
      last_updated_by: user.id,
    })
    .eq('id', id)

  if (tripError) {
    redirect(buildTripsRedirect(tripError.message))
  }

  const { error } = await supabase
    .from('trip_sheets')
    .update({
      is_archived: false,
      last_updated_by: user.id,
    })
    .eq('trip_id', id)

  if (error) {
    await supabase
      .from('trips')
      .update({
        is_archived: true,
        last_updated_by: user.id,
      })
      .eq('id', id)

    redirect(buildTripsRedirect(error.message))
  }

  redirect(appendToastParam(returnPath))
}

export async function deleteTripFromList(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') ?? '').trim()
  const returnPath = getReturnPath(formData, '/dashboard/trips?showArchived=true')

  if (!id) {
    redirect(buildTripsRedirect('Trip not found.'))
  }

  const { data: tripSheetData, error: tripSheetsError } = await supabase
    .from('trip_sheets')
    .select('id')
    .eq('trip_id', id)

  if (tripSheetsError) {
    redirect(buildTripsRedirect(tripSheetsError.message))
  }

  const tripSheetIds =
    ((tripSheetData as Array<{ id: string | null }> | null) ?? [])
      .map((tripSheet) => tripSheet.id ?? '')
      .filter(Boolean)

  if (tripSheetIds.length > 0) {
    const { error: assignmentsError } = await supabase
      .from('trip_sheet_assignments')
      .delete()
      .in('trip_sheet_id', tripSheetIds)

    if (assignmentsError) {
      redirect(buildTripsRedirect(assignmentsError.message))
    }
  }

  const { error: tripSheetsDeleteError } = await supabase
    .from('trip_sheets')
    .delete()
    .eq('trip_id', id)

  if (tripSheetsDeleteError) {
    redirect(buildTripsRedirect(tripSheetsDeleteError.message))
  }

  const { error: tripDeleteError } = await supabase
    .from('trips')
    .delete()
    .eq('id', id)

  if (tripDeleteError) {
    redirect(buildTripsRedirect(tripDeleteError.message))
  }

  redirect(appendToastParam(returnPath))
}

export async function bulkAssignTripSheets(formData: FormData) {
  const { supabase, user } = await requireAdmin()
  const tripId = String(formData.get('trip_id') ?? '').trim()
  const resourceUserId = String(formData.get('resource_user_id') ?? '').trim()
  const bulkAction = String(formData.get('bulk_action') ?? '').trim()
  const shouldReplaceExisting = formData.get('replace_existing') === 'true'
  const returnPath = getReturnPath(formData, tripId ? `/dashboard/trips/${tripId}` : '/dashboard/trips')

  if (!tripId) {
    redirect(buildTripsRedirect('Trip not found.'))
  }

  if (bulkAction !== 'clear_selected' && !resourceUserId) {
    redirect(appendErrorParam(returnPath, 'Select a resource before assigning.'))
  }

  let targetTripSheetIds = Array.from(
    new Set(
      formData
        .getAll('selected_trip_sheet_ids')
        .map((value) => String(value).trim())
        .filter(Boolean)
    )
  )

  if (bulkAction === 'all_unassigned') {
    const { data: tripSheetData, error: tripSheetsError } = await supabase
      .from('trip_sheets')
      .select('id')
      .eq('trip_id', tripId)

    if (tripSheetsError) {
      redirect(appendErrorParam(returnPath, tripSheetsError.message))
    }

    const allTripSheetIds =
      ((tripSheetData as Array<{ id: string }> | null) ?? []).map((tripSheet) => tripSheet.id)

    if (allTripSheetIds.length === 0) {
      redirect(appendErrorParam(returnPath, 'No trip sheets are available to assign.'))
    }

    const { data: assignmentData, error: assignmentsError } = await supabase
      .from('trip_sheet_assignments')
      .select('trip_sheet_id')
      .in('trip_sheet_id', allTripSheetIds)

    if (assignmentsError) {
      redirect(appendErrorParam(returnPath, assignmentsError.message))
    }

    const assignedTripSheetIds = new Set(
      ((assignmentData as Array<{ trip_sheet_id: string }> | null) ?? []).map(
        (assignment) => assignment.trip_sheet_id
      )
    )

    targetTripSheetIds = allTripSheetIds.filter(
      (tripSheetId) => !assignedTripSheetIds.has(tripSheetId)
    )
  } else if (bulkAction !== 'selected' && bulkAction !== 'clear_selected') {
    redirect(appendErrorParam(returnPath, 'Choose a bulk assignment action.'))
  }

  if (targetTripSheetIds.length === 0) {
    redirect(appendErrorParam(returnPath, 'No trip sheets were selected for assignment.'))
  }

  const { data: validTripSheetData, error: validTripSheetsError } = await supabase
    .from('trip_sheets')
    .select('id')
    .eq('trip_id', tripId)
    .in('id', targetTripSheetIds)

  if (validTripSheetsError) {
    redirect(appendErrorParam(returnPath, validTripSheetsError.message))
  }

  const validTripSheetIds =
    ((validTripSheetData as Array<{ id: string }> | null) ?? []).map((tripSheet) => tripSheet.id)

  if (validTripSheetIds.length === 0) {
    redirect(appendErrorParam(returnPath, 'No matching trip sheets were found for this trip.'))
  }

  if (bulkAction === 'clear_selected') {
    const { error: deleteError } = await supabase
      .from('trip_sheet_assignments')
      .delete()
      .in('trip_sheet_id', validTripSheetIds)

    if (deleteError) {
      redirect(appendErrorParam(returnPath, deleteError.message))
    }

    redirect(
      appendToastParam(
        returnPath,
        `Cleared assignments from ${validTripSheetIds.length} trip sheet${
          validTripSheetIds.length === 1 ? '' : 's'
        }.`
      )
    )
  }

  const { data: resourceData, error: resourceError } = await supabase
    .from('profiles')
    .select('id, role, is_active')
    .eq('id', resourceUserId)
    .in('role', ['resource', 'admin'])
    .eq('is_active', true)
    .maybeSingle()

  if (resourceError || !resourceData) {
    redirect(
      appendErrorParam(
        returnPath,
        resourceError?.message ?? 'Selected resource is not active or assignable.'
      )
    )
  }

  const { data: existingAssignmentData, error: existingAssignmentsError } = await supabase
    .from('trip_sheet_assignments')
    .select('id, trip_sheet_id, resource_user_id')
    .in('trip_sheet_id', validTripSheetIds)

  if (existingAssignmentsError) {
    redirect(appendErrorParam(returnPath, existingAssignmentsError.message))
  }

  const existingAssignments =
    (existingAssignmentData as Array<{
      id: string
      trip_sheet_id: string
      resource_user_id: string
    }> | null) ?? []
  const existingTargetAssignmentIds = new Set(
    existingAssignments
      .filter((assignment) => assignment.resource_user_id === resourceUserId)
      .map((assignment) => assignment.trip_sheet_id)
  )
  const tripSheetIdsToInsert = validTripSheetIds.filter(
    (tripSheetId) => !existingTargetAssignmentIds.has(tripSheetId)
  )

  if (shouldReplaceExisting) {
    const assignmentIdsToRemove = existingAssignments
      .filter((assignment) => assignment.resource_user_id !== resourceUserId)
      .map((assignment) => assignment.id)

    if (assignmentIdsToRemove.length > 0) {
      const { error: deleteError } = await supabase
        .from('trip_sheet_assignments')
        .delete()
        .in('id', assignmentIdsToRemove)

      if (deleteError) {
        redirect(appendErrorParam(returnPath, deleteError.message))
      }
    }
  }

  if (tripSheetIdsToInsert.length > 0) {
    const { error: insertError } = await supabase.from('trip_sheet_assignments').insert(
      tripSheetIdsToInsert.map((tripSheetId) => ({
        trip_sheet_id: tripSheetId,
        resource_user_id: resourceUserId,
        assigned_by: user.id,
      }))
    )

    if (insertError) {
      redirect(appendErrorParam(returnPath, insertError.message))
    }
  }

  const changedCount = shouldReplaceExisting
    ? validTripSheetIds.length
    : tripSheetIdsToInsert.length

  redirect(
    appendToastParam(
      returnPath,
      changedCount > 0
        ? `Assigned resource to ${changedCount} trip sheet${changedCount === 1 ? '' : 's'}.`
        : 'No assignment changes were needed.'
    )
  )
}
