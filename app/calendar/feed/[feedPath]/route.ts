import { NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import { APP_TIME_ZONE, addDaysToDateString } from '@/lib/time'
import { getDestinationName, getTripParent, type DestinationRelation } from '@/lib/trip-sheets'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type TripParentRecord = {
  id: string
  title: string | null
  is_archived: boolean | null
  destination_ref: DestinationRelation
  guest_name: string | null
  phone_number: string | null
}

type TripSheetRow = {
  id: string
  title: string | null
  start_date: string | null
  start_time: string | null
  end_date: string | null
  end_time: string | null
  body_text: string | null
  is_archived: boolean | null
  trip: TripParentRecord | TripParentRecord[] | null
}

const ICS_LINE_BREAK = '\r\n'
const ICS_MAX_OCTETS = 75
const IST_OFFSET_MINUTES = 5 * 60 + 30

function sanitizeIcsText(value: string) {
  return value
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[\u00A0\u1680\u180E\u2000-\u200D\u202F\u205F\u2060\u3000\uFEFF]/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function escapeIcsText(value: string) {
  return sanitizeIcsText(value)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function foldIcsLine(line: string) {
  if (Buffer.byteLength(line, 'utf8') <= ICS_MAX_OCTETS) {
    return line
  }

  const chunks: string[] = []
  let currentChunk = ''
  let currentOctets = 0

  for (const character of line) {
    const characterOctets = Buffer.byteLength(character, 'utf8')
    const maxOctets = chunks.length === 0 ? ICS_MAX_OCTETS : ICS_MAX_OCTETS - 1

    if (currentChunk && currentOctets + characterOctets > maxOctets) {
      chunks.push(chunks.length === 0 ? currentChunk : ` ${currentChunk}`)
      currentChunk = character
      currentOctets = characterOctets
      continue
    }

    currentChunk += character
    currentOctets += characterOctets
  }

  if (currentChunk) {
    chunks.push(chunks.length === 0 ? currentChunk : ` ${currentChunk}`)
  }

  return chunks.join(ICS_LINE_BREAK)
}

function formatUtcTimestamp(date: Date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  const seconds = String(date.getUTCSeconds()).padStart(2, '0')

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`
}

function formatLocalizedDateTime(date: string, time: string) {
  const normalizedTime = time.length === 5 ? `${time}:00` : time

  return `${date.replace(/-/g, '')}T${normalizedTime.replace(/:/g, '')}`
}

function formatTimedDateTimeAsUtc(date: string, time: string) {
  const [yearText, monthText, dayText] = date.split('-')
  const [hoursText, minutesText, secondsText] = (time.length === 5 ? `${time}:00` : time).split(':')

  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hours = Number(hoursText)
  const minutes = Number(minutesText)
  const seconds = Number(secondsText)

  if (
    [year, month, day, hours, minutes, seconds].some((value) => Number.isNaN(value))
  ) {
    return formatLocalizedDateTime(date, time)
  }

  const utcTimestamp =
    Date.UTC(year, month - 1, day, hours, minutes, seconds, 0) - IST_OFFSET_MINUTES * 60 * 1000

  return formatUtcTimestamp(new Date(utcTimestamp))
}

function formatDateValue(date: string) {
  return date.replace(/-/g, '')
}

function buildDateLines(tripSheet: Pick<TripSheetRow, 'start_date' | 'start_time' | 'end_date' | 'end_time'>) {
  const startDate = tripSheet.start_date
  const endDate = tripSheet.end_date ?? tripSheet.start_date
  const startTime = tripSheet.start_time
  const endTime = tripSheet.end_time

  if (!startDate || !endDate) {
    return []
  }

  if (startTime && endTime) {
    return [
      `DTSTART:${formatTimedDateTimeAsUtc(startDate, startTime)}`,
      `DTEND:${formatTimedDateTimeAsUtc(endDate, endTime)}`,
    ]
  }

  return [
    `DTSTART;VALUE=DATE:${formatDateValue(startDate)}`,
    `DTEND;VALUE=DATE:${formatDateValue(addDaysToDateString(endDate, 1))}`,
  ]
}

function buildDescription({
  customer,
  phone,
  destination,
  bodyText,
}: {
  customer: string
  phone: string
  destination: string
  bodyText: string
}) {
  const lines = [`Customer: ${customer}`, `Phone: ${phone}`, `Destination: ${destination}`]

  if (bodyText.trim()) {
    lines.push('', bodyText.trim())
  }

  return lines.join('\n')
}

function serializeIcs(lines: string[]) {
  return lines.map(foldIcsLine).join(ICS_LINE_BREAK)
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ feedPath: string }> }
) {
  const { feedPath } = await params

  if (!feedPath.endsWith('.ics')) {
    return NextResponse.json({ error: 'Feed not found.' }, { status: 404 })
  }

  const userId = feedPath.slice(0, -4).trim()

  if (!userId) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 })
  }

  const supabase = createAdminClient()

  const { data: assignmentData, error: assignmentError } = await supabase
    .from('trip_sheet_assignments')
    .select('trip_sheet_id')
    .eq('resource_user_id', userId)

  if (assignmentError) {
    return NextResponse.json({ error: assignmentError.message }, { status: 500 })
  }

  const tripSheetIds =
    ((assignmentData as Array<{ trip_sheet_id: string }> | null) ?? []).map(
      (assignment) => assignment.trip_sheet_id
    )

  const { data: tripSheetData, error: tripSheetError } =
    tripSheetIds.length > 0
      ? await supabase
          .from('trip_sheets')
          .select(
            'id, title, start_date, start_time, end_date, end_time, body_text, is_archived, trip:trips!inner(id, title, is_archived, destination_ref:destinations(name), guest_name, phone_number)'
          )
          .eq('is_archived', false)
          .eq('trip.is_archived', false)
          .in('id', tripSheetIds)
          .order('start_date', { ascending: true })
          .order('start_time', { ascending: true, nullsFirst: true })
      : { data: [], error: null }

  if (tripSheetError) {
    return NextResponse.json({ error: tripSheetError.message }, { status: 500 })
  }

  const nowStamp = formatUtcTimestamp(new Date())
  const eventLines = ((tripSheetData as TripSheetRow[] | null) ?? [])
    .map((tripSheet) => {
      const trip = getTripParent(tripSheet.trip)

      if (!trip || !tripSheet.start_date || !(tripSheet.end_date ?? tripSheet.start_date)) {
        return null
      }

      const summary = `${tripSheet.title?.trim() || 'Untitled trip sheet'} - ${
        trip.title?.trim() || 'Untitled trip'
      }`
      const destination =
        getDestinationName(trip.destination_ref, 'Unknown destination') ?? 'Unknown destination'
      const description = buildDescription({
        customer: trip.guest_name?.trim() || '-',
        phone: trip.phone_number?.trim() || '-',
        destination,
        bodyText: tripSheet.body_text ?? '',
      })

      const lines = [
        'BEGIN:VEVENT',
        `UID:${tripSheet.id}@trip-sheet`,
        `DTSTAMP:${nowStamp}`,
        ...buildDateLines(tripSheet),
        `SUMMARY:${escapeIcsText(summary)}`,
        `DESCRIPTION:${escapeIcsText(description)}`,
        `LOCATION:${escapeIcsText(destination)}`,
        'END:VEVENT',
      ]

      return lines
    })
    .filter((event): event is string[] => event !== null)
    .flat()

  const body = serializeIcs([
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Trip Sheet//Resource Calendar Feed//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Trip Sheets',
    `X-WR-TIMEZONE:${APP_TIME_ZONE}`,
    ...eventLines,
    'END:VCALENDAR',
    '',
  ])

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'Content-Disposition': `inline; filename="${userId}.ics"`,
    },
  })
}
