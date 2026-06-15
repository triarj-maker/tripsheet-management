import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildSimplePdfPages, createSimplePdf } from '@/lib/pdf'
import { isAdminRole } from '@/lib/roles'
import {
  formatTripTypeLabel,
  getTripCompanyPartnerName,
  getTripSchoolCustomerName,
  getDestinationName,
  type DestinationRelation,
  type LookupNameRelation,
} from '@/lib/trip-sheets'

type TripRow = {
  id: string
  title: string | null
  trip_type: string | null
  start_date: string | null
  end_date: string | null
  destination_ref: DestinationRelation
  company_id: string | null
  school_id: string | null
  company_ref: LookupNameRelation
  school_ref: LookupNameRelation
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
  label?: string
  value?: string
  labelColumnWidth?: number
  size?: number
  bold?: boolean
  lineHeight?: number
  indent?: number
  box?: boolean
  boxGroup?: string
  muted?: boolean
  rule?: boolean
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

  if (formattedStartDate && formattedEndDate && formattedStartDate === formattedEndDate) {
    if (formattedStartTime && formattedEndTime && formattedStartTime !== formattedEndTime) {
      return `${formattedStartDate} | ${formattedStartTime} - ${formattedEndTime}`
    }

    if (formattedStartTime) {
      return `${formattedStartDate} | ${formattedStartTime}`
    }

    if (formattedEndTime) {
      return `${formattedEndDate} | ${formattedEndTime}`
    }

    return formattedStartDate
  }

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

function pushOverviewField(lines: PdfLine[], label: string, value: string) {
  lines.push({
    text: '',
    label,
    value,
    labelColumnWidth: 112,
    lineHeight: 17,
    indent: 16,
    boxGroup: 'trip-overview',
  })
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

function hasHeadingSyntax(line: string) {
  return /^#{1,6}\s+/.test(line)
}

function hasUnorderedListSyntax(line: string) {
  return /^[-*+]\s+/.test(line)
}

function hasOrderedListSyntax(line: string) {
  return /^\d+\.\s+/.test(line)
}

function stripInlineMarkdown(value: string) {
  let text = ''
  let cursor = 0
  let hasBold = false

  while (cursor < value.length) {
    const start = value.indexOf('**', cursor)

    if (start === -1) {
      text += value.slice(cursor)
      break
    }

    const end = value.indexOf('**', start + 2)

    if (end === -1) {
      text += value.slice(cursor)
      break
    }

    text += value.slice(cursor, start)
    text += value.slice(start + 2, end)
    hasBold = true
    cursor = end + 2
  }

  return {
    text: text.trim(),
    hasBold,
  }
}

function pushMarkdownTextLine(
  lines: PdfLine[],
  value: string,
  options: {
    bold?: boolean
    indent?: number
    lineHeight?: number
    size?: number
  } = {}
) {
  const inline = stripInlineMarkdown(value)

  if (!inline.text) {
    return
  }

  lines.push({
    text: inline.text,
    bold: options.bold || inline.hasBold,
    indent: options.indent,
    lineHeight: options.lineHeight ?? 16,
    size: options.size,
  })
}

function pushMarkdownHeading(lines: PdfLine[], line: string) {
  const match = /^(#{1,6})\s+(.+)$/.exec(line)

  if (!match) {
    return
  }

  const level = match[1]!.length
  const text = match[2]!.trim()
  const size = level === 1 ? 13 : level === 2 ? 12 : 11

  pushBlankLine(lines, 6)
  pushMarkdownTextLine(lines, text, {
    bold: true,
    lineHeight: level <= 2 ? 18 : 16,
    size,
  })
}

function pushMarkdownText(lines: PdfLine[], value: string) {
  const normalizedValue = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const sourceLines = normalizedValue.split('\n')
  let index = 0

  while (index < sourceLines.length) {
    const line = sourceLines[index] ?? ''
    const trimmedLine = line.trim()

    if (!trimmedLine) {
      pushBlankLine(lines, 8)
      index += 1
      continue
    }

    if (hasHeadingSyntax(trimmedLine)) {
      pushMarkdownHeading(lines, trimmedLine)
      index += 1
      continue
    }

    if (hasUnorderedListSyntax(trimmedLine)) {
      while (index < sourceLines.length && hasUnorderedListSyntax(sourceLines[index]!.trim())) {
        const listText = sourceLines[index]!.trim().replace(/^[-*+]\s+/, '')
        pushMarkdownTextLine(lines, `- ${listText}`, {
          indent: 14,
          lineHeight: 16,
        })
        index += 1
      }

      pushBlankLine(lines, 6)
      continue
    }

    if (hasOrderedListSyntax(trimmedLine)) {
      while (index < sourceLines.length && hasOrderedListSyntax(sourceLines[index]!.trim())) {
        const listLine = sourceLines[index]!.trim()
        const listMatch = /^(\d+)\.\s+(.+)$/.exec(listLine)

        if (listMatch) {
          pushMarkdownTextLine(lines, `${listMatch[1]}. ${listMatch[2]}`, {
            indent: 14,
            lineHeight: 16,
          })
        }

        index += 1
      }

      pushBlankLine(lines, 6)
      continue
    }

    pushMarkdownTextLine(lines, trimmedLine)
    index += 1
  }

  while (lines.length > 0 && lines[lines.length - 1]?.text === '') {
    lines.pop()
  }
}

function buildPdfLines({
  trip,
  tripSheets,
  assignedResourcesByTripSheetId,
  includeResourceDetails,
}: {
  trip: TripRow
  tripSheets: TripSheetRow[]
  assignedResourcesByTripSheetId: Map<string, ResourceProfile[]>
  includeResourceDetails: boolean
}) {
  const destinationName = getDestinationName(trip.destination_ref, null)
  const tripDateRange = formatDateRange(trip.start_date, trip.end_date)
  const tripTypeLabel = formatTripTypeLabel(trip.trip_type)
  const normalizedTripType = (trip.trip_type ?? '').trim().toLowerCase()
  const schoolCustomerName = getTripSchoolCustomerName(trip)
  const companyPartnerName = getTripCompanyPartnerName(trip)
  const lines: PdfLine[] = []

  lines.push({
    text: 'TRIP OVERVIEW',
    size: 12,
    bold: true,
    lineHeight: 20,
    indent: 16,
    boxGroup: 'trip-overview',
  })
  lines.push({
    text: '',
    lineHeight: 5,
    indent: 16,
    boxGroup: 'trip-overview',
  })
  pushOverviewField(lines, 'Trip Name', trip.title?.trim() || 'Untitled trip')
  if (destinationName) {
    pushOverviewField(lines, 'Destination', destinationName)
  }
  if (tripDateRange) {
    pushOverviewField(lines, 'Dates', tripDateRange)
  }
  if (tripTypeLabel !== '-') {
    pushOverviewField(lines, 'Trip Type', tripTypeLabel)
  }
  if (schoolCustomerName) {
    pushOverviewField(
      lines,
      normalizedTripType === 'educational' ? 'School' : 'Guest',
      schoolCustomerName
    )
  }
  if (companyPartnerName) {
    pushOverviewField(lines, 'Company / Partner', companyPartnerName)
  }

  if (tripSheets.length > 0) {
    pushBlankLine(lines, 20)
    lines.push({ text: 'Detailed Itinerary', size: 14, bold: true, lineHeight: 22 })
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

    pushBlankLine(lines, 16)
    if (index > 0) {
      lines.push({ text: '', lineHeight: 8, rule: true })
      pushBlankLine(lines, 6)
    }

    lines.push({
      text: `${index + 1}. ${tripSheet.title?.trim() || 'Untitled trip sheet'}`,
      size: 13,
      bold: true,
      lineHeight: 20,
    })

    if (schedule) {
      lines.push({ text: schedule, size: 10, lineHeight: 15, muted: true })
    }

    if (includeResourceDetails && primaryAssignedResource) {
      const resolvedName = primaryAssignedResource.full_name?.trim() || 'Assigned guide'
      const phone = primaryAssignedResource.phone?.trim()
      const assignmentText = phone ? `${resolvedName} | ${phone}` : resolvedName
      lines.push({
        text: `Guide / Coordinator: ${assignmentText}`,
        size: 10,
        lineHeight: 15,
        muted: true,
      })
    }

    if (tripSheet.body_text?.trim()) {
      pushBlankLine(lines, 8)
      pushMarkdownText(lines, tripSheet.body_text.trim())
    }

    if (tripSheet.transportation_info?.trim()) {
      pushBlankLine(lines, 10)
      lines.push({ text: 'Transportation Details', bold: true, lineHeight: 16 })
      pushParagraphText(lines, tripSheet.transportation_info.trim())
    }
  }

  return lines
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const url = new URL(request.url)
  const includeResourceDetails = url.searchParams.get('includeResources') === 'true'
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

  if (
    !currentProfile ||
    currentProfile.is_active === false ||
    !isAdminRole(currentProfile.role)
  ) {
    return new NextResponse('Forbidden.', { status: 403 })
  }

  const adminClient = createAdminClient()
  const { data: tripData, error: tripError } = await adminClient
    .from('trips')
    .select(
      'id, title, trip_type, start_date, end_date, destination_ref:destinations(name), company_id, school_id, company_ref:companies(name), school_ref:schools(name), guest_name, phone_number, company'
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
    includeResourceDetails,
  })
  const pdfBuffer = createSimplePdf(buildSimplePdfPages(pdfLines), {
    footerText: 'Copyright 2026-27 Travspire Experiences Private Limited',
  })
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
