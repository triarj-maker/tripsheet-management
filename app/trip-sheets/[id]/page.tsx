import { redirect } from 'next/navigation'

import AdminNav from '@/app/dashboard/AdminNav'
import { getCurrentUserProfile, getSignedInHomePath } from '@/app/dashboard/lib'

type TripSheet = {
  id: string
  body_text: string | null
}

type MetadataField = {
  label: string
  value: string
}

type ItineraryDay = {
  day: string
  time: string | null
  activity: string | null
  details: string[]
}

type ParsedTripSheetBody = {
  title: string | null
  metadata: MetadataField[]
  notes: string[]
  itineraryDays: ItineraryDay[]
}

function formatLabel(label: string) {
  switch (label.trim().toUpperCase()) {
    case 'TRIP':
      return 'Trip'
    case 'DATES':
      return 'Dates'
    case 'CUSTOMER':
      return 'Customer'
    case 'CONTACT':
      return 'Contact'
    case 'COMPANY':
      return 'Company'
    case 'NO OF GUESTS':
      return 'No. of guests'
    case 'OTHER DETAILS':
      return 'Other details'
    default:
      return label
  }
}

function isSeparator(line: string) {
  return /^-+$/.test(line.trim())
}

function isDayHeading(line: string) {
  return /^day\b/i.test(line.trim())
}

function splitIntoBlocks(lines: string[]) {
  const blocks: string[][] = []
  let currentBlock: string[] = []

  for (const line of lines) {
    if (!line.trim()) {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock)
        currentBlock = []
      }

      continue
    }

    currentBlock.push(line)
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock)
  }

  return blocks
}

function parseDayBlock(day: string, lines: string[]): ItineraryDay {
  let time: string | null = null
  let activity: string | null = null
  const details: string[] = []

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (!line) {
      continue
    }

    const labeledMatch = line.match(/^(time|activity|details?)\s*:\s*(.*)$/i)

    if (labeledMatch) {
      const [, key, value] = labeledMatch
      const normalizedKey = key.toLowerCase()
      const trimmedValue = value.trim()

      if (normalizedKey === 'time') {
        time = trimmedValue || time
      } else if (normalizedKey === 'activity') {
        activity = trimmedValue || activity
      } else if (trimmedValue) {
        details.push(trimmedValue)
      }

      continue
    }

    const timeAndActivityMatch = line.match(
      /^(\d{1,2}(?::\d{2})?\s*(?:am|pm)?(?:\s*[-–]\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)\s*[-–]\s*(.+)$/i
    )

    if (timeAndActivityMatch && !time && !activity) {
      time = timeAndActivityMatch[1].trim()
      activity = timeAndActivityMatch[2].trim()
      continue
    }

    if (!activity) {
      activity = line
      continue
    }

    details.push(line)
  }

  return {
    day,
    time,
    activity,
    details,
  }
}

function parseTripSheetBody(bodyText: string | null): ParsedTripSheetBody {
  const lines = (bodyText ?? '').split(/\r?\n/).map((line) => line.trimEnd())
  const separatorIndex = lines.findIndex(isSeparator)
  const headerLines =
    separatorIndex >= 0 ? lines.slice(0, separatorIndex) : []
  const contentLines =
    separatorIndex >= 0 ? lines.slice(separatorIndex + 1) : lines

  const metadata: MetadataField[] = []
  let title: string | null = null

  for (const line of headerLines) {
    const match = line.match(/^([^:]+):\s*(.*)$/)

    if (!match) {
      continue
    }

    const [, rawLabel, rawValue] = match
    const normalizedLabel = rawLabel.trim().toUpperCase()
    const value = rawValue.trim()

    if (normalizedLabel === 'TRIP') {
      title = value || null
      continue
    }

    if (!value) {
      continue
    }

    metadata.push({
      label: formatLabel(rawLabel.trim()),
      value,
    })
  }

  const blocks = splitIntoBlocks(contentLines)
  const notes: string[] = []
  const itineraryDays: ItineraryDay[] = []
  let currentDay: { heading: string; lines: string[] } | null = null

  for (const block of blocks) {
    const [firstLine, ...rest] = block

    if (isDayHeading(firstLine)) {
      if (currentDay) {
        itineraryDays.push(parseDayBlock(currentDay.heading, currentDay.lines))
      }

      currentDay = {
        heading: firstLine.trim(),
        lines: rest,
      }
      continue
    }

    if (currentDay) {
      currentDay.lines.push(...block)
      continue
    }

    notes.push(block.join('\n'))
  }

  if (currentDay) {
    itineraryDays.push(parseDayBlock(currentDay.heading, currentDay.lines))
  }

  return {
    title,
    metadata,
    notes,
    itineraryDays,
  }
}

type TripSheetViewPageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function TripSheetViewPage({
  params,
}: TripSheetViewPageProps) {
  const [{ id }, { supabase, user, profile }] = await Promise.all([
    params,
    getCurrentUserProfile(),
  ])

  const role = profile?.role ?? null

  if (role !== 'admin' && role !== 'resource') {
    redirect('/login?error=You%20do%20not%20have%20access%20to%20that%20page.')
  }

  if (role === 'resource') {
    const { data: assignment } = await supabase
      .from('trip_sheet_assignments')
      .select('id')
      .eq('trip_sheet_id', id)
      .eq('resource_user_id', user.id)
      .maybeSingle()

    if (!assignment) {
      redirect('/my-trip-sheets')
    }
  }

  const { data } = await supabase
    .from('trip_sheets')
    .select('id, body_text')
    .eq('id', id)
    .maybeSingle()

  const tripSheet = (data as TripSheet | null) ?? null

  if (!tripSheet) {
    redirect(getSignedInHomePath(role))
  }

  const parsedBody = parseTripSheetBody(tripSheet.body_text)

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-12">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <AdminNav
          current={role === 'resource' ? 'my-trip-sheets' : 'trip-sheets'}
          role={role}
        />

        <div className="space-y-3 rounded-xl border border-zinc-200 p-4">
          {parsedBody.title ? (
            <section className="space-y-2 border-b border-zinc-200 pb-3">
              <p className="text-xs font-medium text-gray-500">Trip</p>
              <h1 className="text-lg font-semibold text-gray-900">
                {parsedBody.title}
              </h1>
            </section>
          ) : null}

          {parsedBody.metadata.length > 0 ? (
            <section className="space-y-3 border-b border-zinc-200 pb-3">
              {parsedBody.metadata.map((item) => (
                <div key={item.label} className="space-y-1">
                  <p className="text-xs font-medium text-gray-500">{item.label}</p>
                  <p className="text-sm font-medium text-gray-900">{item.value}</p>
                </div>
              ))}
            </section>
          ) : null}

          {parsedBody.notes.length > 0 ? (
            <section className="space-y-3 border-b border-zinc-200 pb-3">
              {parsedBody.notes.map((note, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 p-3"
                >
                  <p className="whitespace-pre-wrap text-sm leading-6 text-gray-900">
                    {note}
                  </p>
                </div>
              ))}
            </section>
          ) : null}

          {parsedBody.itineraryDays.length > 0 ? (
            <section className="space-y-3">
              {parsedBody.itineraryDays.map((day) => (
                <article
                  key={day.day}
                  className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3"
                >
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-500">Day</p>
                    <p className="text-sm font-semibold text-gray-900">{day.day}</p>
                  </div>

                  {day.time ? (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-gray-500">Time</p>
                      <p className="text-sm text-gray-900">{day.time}</p>
                    </div>
                  ) : null}

                  {day.activity ? (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-gray-500">Activity</p>
                      <p className="text-sm font-medium text-gray-900">
                        {day.activity}
                      </p>
                    </div>
                  ) : null}

                  {day.details.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-gray-500">Details</p>
                      <div className="space-y-2">
                        {day.details.map((detail, index) => (
                          <p key={index} className="text-xs leading-5 text-gray-700">
                            {detail}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </article>
              ))}
            </section>
          ) : parsedBody.title || parsedBody.metadata.length > 0 || parsedBody.notes.length > 0 ? null : (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <p className="whitespace-pre-wrap text-sm leading-6 text-gray-900">
                {tripSheet.body_text ?? ''}
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
