import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildSimplePdfPages, createSimplePdf } from '@/lib/pdf'
import {
  formatTripTypeLabel,
  getDestinationName,
  type DestinationRelation,
} from '@/lib/trip-sheets'

type TripRow = {
  id: string
  title: string | null
  trip_type: string | null
  start_date: string | null
  end_date: string | null
  destination_ref: DestinationRelation
  guest_name: string | null
  phone_number: string | null
  company: string | null
}

type TripSheetRow = {
  id: string
  title: string | null
  start_date: string | null
  start_time: string | null
  end_date: string | null
  end_time: string | null
  body_text: string | null
  transportation_info: string | null
}

type AssignmentRow = {
  trip_sheet_id: string
  resource_user_id: string
}

type ResourceProfile = {
  id: string
  full_name: string | null
  phone: string | null
}

type PdfLine = {
  text: string
  size?: number
  bold?: boolean
  lineHeight?: number
}

function formatDate(value: string | null) {
  if (!value) {
    return null
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

function formatDateRange(startDate: string | null, endDate: string | null) {
  const formattedStart = formatDate(startDate)
  const formattedEnd = formatDate(endDate)

  if (!formattedStart && !formattedEnd) {
    return null
  }

  if (!formattedEnd || formattedStart === formattedEnd) {
    return formattedStart ?? formattedEnd
  }

  return `${formattedStart} - ${formattedEnd}`
}

function formatDateTimeRange(
  startDate: string | null,
  startTime: string | null,
  endDate: string | null,
  endTime: string | null
) {
  const formattedStartDate = formatDate(startDate)
  const formattedEndDate = formatDate(endDate)
  const formattedStartTime = formatTime(startTime)
  const formattedEndTime = formatTime(endTime)

  const start = formattedStartDate
    ? formattedStartTime
      ? `${formattedStartDate}, ${formattedStartTime}`
      : formattedStartDate
    : null
  const end = formattedEndDate
    ? formattedEndTime
      ? `${formattedEndDate}, ${formattedEndTime}`
      : formattedEndDate
    : null

  if (!start && !end) {
    return null
  }

  if (!end || start === end) {
    return start ?? end
  }

  return `${start} - ${end}`
}

function sanitizeFileName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'trip'
}

function pushBlankLine(lines: PdfLine[], height = 14) {
  lines.push({ text: '', lineHeight: height })
}

function pushParagraphText(lines: PdfLine[], value: string, options?: { bullet?: boolean }) {
  for (const rawParagraph of value.split(/\r?\n\r?\n/)) {
    const paragraph = rawParagraph.trim()

    if (!paragraph) {
      continue
    }

    const paragraphLines = paragraph.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)

    for (const line of paragraphLines) {
      const normalizedLine = line.replace(/^[-*]\s+/, '').trim()
      const headingMatch = normalizedLine.match(
        /^(Inclusions|Exclusions|Notes|Important Notes|Pickup Details|Drop-off Details|Meeting Point|Includes|Excludes)\s*:?\s*(.*)$/i
      )

      if (headingMatch) {
        lines.push({
          text: headingMatch[1]!,
          bold: true,
          lineHeight: 16,
        })

        if (headingMatch[2]?.trim()) {
          lines.push({
            text: headingMatch[2].trim(),
            lineHeight: 16,
          })
        }

        continue
      }

      lines.push({
        text: options?.bullet ? `- ${normalizedLine}` : normalizedLine,
        lineHeight: 16,
      })
    }

    pushBlankLine(lines, 10)
  }

  if (lines.length > 0 && lines[lines.length - 1]?.text === '') {
    return
  }
}

function getTripSubtitle(tripType: string | null | undefined) {
  if ((tripType ?? '').trim().toLowerCase() === 'private') {
    return 'Private Tour Itinerary'
  }

  return 'Trip Itinerary'
}

function buildPdfLines({
  trip,
  tripSheets,
  assignedResourcesByTripSheetId,
}: {
  trip: TripRow
  tripSheets: TripSheetRow[]
  assignedResourcesByTripSheetId: Map<string, ResourceProfile[]>
}) {
  const destinationName = getDestinationName(trip.destination_ref, null)
  const tripDateRange = formatDateRange(trip.start_date, trip.end_date)
  const lines: PdfLine[] = []

  lines.push({
    text: trip.title?.trim() || 'Untitled trip',
    size: 17,
    bold: true,
    lineHeight: 26,
  })
  lines.push({
    text: getTripSubtitle(trip.trip_type),
    size: 11,
    lineHeight: 18,
  })

  if (destinationName) {
    lines.push({
      text: destinationName,
      size: 12,
      bold: true,
      lineHeight: 18,
    })
  }

  if (tripDateRange) {
    lines.push({
      text: tripDateRange,
      size: 11,
      lineHeight: 18,
    })
  }

  pushBlankLine(lines, 18)
  lines.push({ text: 'Trip Overview', size: 13, bold: true, lineHeight: 20 })

  if (destinationName) {
    lines.push({ text: `Destination: ${destinationName}`, lineHeight: 16 })
  }

  const tripTypeLabel = formatTripTypeLabel(trip.trip_type)

  if (tripTypeLabel !== '-') {
    lines.push({ text: `Trip Type: ${tripTypeLabel}`, lineHeight: 16 })
  }

  if (tripDateRange) {
    lines.push({ text: `Dates: ${tripDateRange}`, lineHeight: 16 })
  }

  if (trip.guest_name?.trim()) {
    lines.push({ text: `Guest Name: ${trip.guest_name.trim()}`, lineHeight: 16 })
  }

  if (trip.phone_number?.trim()) {
    lines.push({ text: `Phone Number: ${trip.phone_number.trim()}`, lineHeight: 16 })
  }

  if (trip.company?.trim()) {
    lines.push({ text: `Company: ${trip.company.trim()}`, lineHeight: 16 })
  }

  if (tripSheets.length > 0) {
    pushBlankLine(lines, 18)
    lines.push({ text: 'Itinerary / Trip Plan', size: 13, bold: true, lineHeight: 20 })
  }

  for (const [index, tripSheet] of tripSheets.entries()) {
    const schedule = formatDateTimeRange(
      tripSheet.start_date,
      tripSheet.start_time,
      tripSheet.end_date,
      tripSheet.end_time
    )
    const assignedResources = assignedResourcesByTripSheetId.get(tripSheet.id) ?? []
    const primaryAssignedResource = assignedResources[0] ?? null

    pushBlankLine(lines, 18)
    lines.push({
      text: '----------------------------------------',
      lineHeight: 12,
    })
    pushBlankLine(lines, 8)
    lines.push({
      text: `${index + 1}. ${tripSheet.title?.trim() || 'Untitled trip sheet'}`,
      size: 12,
      bold: true,
      lineHeight: 18,
    })

    if (schedule) {
      lines.push({ text: `Schedule: ${schedule}`, lineHeight: 16 })
    }

    if (tripSheet.transportation_info?.trim()) {
      pushBlankLine(lines, 10)
      lines.push({ text: 'Transportation Details', bold: true, lineHeight: 16 })
      pushParagraphText(lines, tripSheet.transportation_info.trim())
    }

    if (primaryAssignedResource) {
      pushBlankLine(lines, 10)
      lines.push({ text: 'Assigned Guide / Coordinator', bold: true, lineHeight: 16 })

      const resolvedName = primaryAssignedResource.full_name?.trim() || 'Assigned guide'
      lines.push({ text: `Name: ${resolvedName}`, lineHeight: 16 })

      if (primaryAssignedResource.phone?.trim()) {
        lines.push({
          text: `Phone: ${primaryAssignedResource.phone.trim()}`,
          lineHeight: 16,
        })
      }
    }

    if (tripSheet.body_text?.trim()) {
      pushBlankLine(lines, 10)
      lines.push({ text: 'Trip Plan', bold: true, lineHeight: 16 })
      pushParagraphText(lines, tripSheet.body_text.trim())
    }
  }

  return lines
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const tripId = id.trim()

  if (!tripId) {
    return new NextResponse('Trip not found.', { status: 404 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new NextResponse('Unauthorized.', { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, is_active')
    .eq('id', user.id)
    .maybeSingle()

  const currentProfile =
    (profile as { id: string; role: string | null; is_active: boolean | null } | null) ?? null

  if (!currentProfile || currentProfile.is_active === false || currentProfile.role !== 'admin') {
    return new NextResponse('Forbidden.', { status: 403 })
  }

  const adminClient = createAdminClient()
  const { data: tripData, error: tripError } = await adminClient
    .from('trips')
    .select(
      'id, title, trip_type, start_date, end_date, destination_ref:destinations(name), guest_name, phone_number, company'
    )
    .eq('id', tripId)
    .maybeSingle()

  const trip = (tripData as TripRow | null) ?? null

  if (tripError || !trip) {
    return new NextResponse(tripError?.message ?? 'Trip not found.', { status: 404 })
  }

  const { data: tripSheetData, error: tripSheetsError } = await adminClient
    .from('trip_sheets')
    .select(
      'id, title, start_date, start_time, end_date, end_time, transportation_info, body_text'
    )
    .eq('trip_id', tripId)
    .order('start_date', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: true })
    .order('end_date', { ascending: true, nullsFirst: true })
    .order('end_time', { ascending: true, nullsFirst: true })

  if (tripSheetsError) {
    return new NextResponse(tripSheetsError.message, { status: 500 })
  }

  const tripSheets = (tripSheetData as TripSheetRow[] | null) ?? []
  const tripSheetIds = tripSheets.map((tripSheet) => tripSheet.id)
  const { data: assignmentData, error: assignmentsError } =
    tripSheetIds.length > 0
      ? await adminClient
          .from('trip_sheet_assignments')
          .select('trip_sheet_id, resource_user_id')
          .in('trip_sheet_id', tripSheetIds)
      : { data: [], error: null }

  if (assignmentsError) {
    return new NextResponse(assignmentsError.message, { status: 500 })
  }

  const assignments = (assignmentData as AssignmentRow[] | null) ?? []
  const resourceUserIds = Array.from(
    new Set(assignments.map((assignment) => assignment.resource_user_id).filter(Boolean))
  )
  const { data: resourceData, error: resourcesError } =
    resourceUserIds.length > 0
      ? await adminClient
          .from('profiles')
          .select('id, full_name, phone')
          .in('id', resourceUserIds)
      : { data: [], error: null }

  if (resourcesError) {
    return new NextResponse(resourcesError.message, { status: 500 })
  }

  const resources = (resourceData as ResourceProfile[] | null) ?? []
  const resourcesById = new Map(resources.map((resource) => [resource.id, resource]))
  const assignedResourcesByTripSheetId = new Map<string, ResourceProfile[]>()
  const seenResourceIdsByTripSheetId = new Map<string, Set<string>>()

  for (const assignment of assignments) {
    const resource = resourcesById.get(assignment.resource_user_id)

    if (!resource) {
      continue
    }

    const seenResourceIds =
      seenResourceIdsByTripSheetId.get(assignment.trip_sheet_id) ?? new Set<string>()

    if (seenResourceIds.has(assignment.resource_user_id)) {
      continue
    }

    const currentResources = assignedResourcesByTripSheetId.get(assignment.trip_sheet_id) ?? []
    currentResources.push(resource)
    assignedResourcesByTripSheetId.set(assignment.trip_sheet_id, currentResources)
    seenResourceIds.add(assignment.resource_user_id)
    seenResourceIdsByTripSheetId.set(assignment.trip_sheet_id, seenResourceIds)
  }

  const pdfLines = buildPdfLines({
    trip,
    tripSheets,
    assignedResourcesByTripSheetId,
  })
  const pdfBuffer = createSimplePdf(buildSimplePdfPages(pdfLines))
  const fileName = `${sanitizeFileName(trip.title ?? 'trip')}.pdf`

  return new NextResponse(pdfBuffer as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}
