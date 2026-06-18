import {
  formatTripTypeLabel,
  getDestinationName,
  getTripCompanyPartnerName,
  getTripSchoolCustomerName,
  type DestinationRelation,
  type LookupNameRelation,
} from '@/lib/trip-sheets'

export type ClientItineraryTrip = {
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
  company: string | null
}

export type ClientItineraryTripSheet = {
  id: string
  title: string | null
  start_date: string | null
  start_time: string | null
  end_date: string | null
  end_time: string | null
  body_text: string | null
}

export type ClientItineraryPdfLine = {
  text: string
  label?: string
  value?: string
  labelColumnWidth?: number
  size?: number
  bold?: boolean
  lineHeight?: number
  indent?: number
  boxGroup?: string
  muted?: boolean
  rule?: boolean
}

type ItineraryOverviewField = {
  label: string
  value: string
}

type ItinerarySection = {
  dateLabel: string
  tripSheets: ClientItineraryTripSheet[]
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
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

function formatDateTimeRange(tripSheet: ClientItineraryTripSheet) {
  const startDate = formatDate(tripSheet.start_date)
  const endDate = formatDate(tripSheet.end_date)
  const startTime = formatTime(tripSheet.start_time)
  const endTime = formatTime(tripSheet.end_time)

  if (startDate && endDate && startDate === endDate) {
    if (startTime && endTime) {
      return `${startDate} | ${startTime} - ${endTime}`
    }

    return startTime ? `${startDate} | ${startTime}` : startDate
  }

  const start = startDate ? (startTime ? `${startDate}, ${startTime}` : startDate) : null
  const end = endDate ? (endTime ? `${endDate}, ${endTime}` : endDate) : null

  if (!start && !end) {
    return ''
  }

  return end ? `${start ?? ''} - ${end}` : (start ?? '')
}

function renderInlineMarkdownHtml(value: string) {
  let html = ''
  let cursor = 0

  while (cursor < value.length) {
    const start = value.indexOf('**', cursor)

    if (start === -1) {
      html += escapeHtml(value.slice(cursor))
      break
    }

    const end = value.indexOf('**', start + 2)

    if (end === -1) {
      html += escapeHtml(value.slice(cursor))
      break
    }

    html += escapeHtml(value.slice(cursor, start))
    html += `<strong>${escapeHtml(value.slice(start + 2, end))}</strong>`
    cursor = end + 2
  }

  return html
}

function stripInlineMarkdown(value: string) {
  return value.replace(/\*\*(.*?)\*\*/g, '$1').trim()
}

function renderMarkdownHtml(value: string | null) {
  const markdown = value?.trim()

  if (!markdown) {
    return ''
  }

  const lines = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const blocks: string[] = []
  let index = 0

  while (index < lines.length) {
    const trimmedLine = (lines[index] ?? '').trim()

    if (!trimmedLine) {
      index += 1
      continue
    }

    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmedLine)

    if (headingMatch) {
      const level = Math.min(headingMatch[1]!.length + 2, 4)
      blocks.push(`<h${level}>${renderInlineMarkdownHtml(headingMatch[2]!.trim())}</h${level}>`)
      index += 1
      continue
    }

    if (/^[-*+]\s+/.test(trimmedLine)) {
      const items: string[] = []

      while (index < lines.length && /^[-*+]\s+/.test((lines[index] ?? '').trim())) {
        items.push(
          `<li>${renderInlineMarkdownHtml((lines[index] ?? '').trim().replace(/^[-*+]\s+/, ''))}</li>`
        )
        index += 1
      }

      blocks.push(`<ul>${items.join('')}</ul>`)
      continue
    }

    if (/^\d+\.\s+/.test(trimmedLine)) {
      const items: string[] = []

      while (index < lines.length && /^\d+\.\s+/.test((lines[index] ?? '').trim())) {
        items.push(
          `<li>${renderInlineMarkdownHtml((lines[index] ?? '').trim().replace(/^\d+\.\s+/, ''))}</li>`
        )
        index += 1
      }

      blocks.push(`<ol>${items.join('')}</ol>`)
      continue
    }

    const paragraphLines: string[] = []

    while (index < lines.length) {
      const currentLine = (lines[index] ?? '').trim()

      if (!currentLine || /^#{1,6}\s+/.test(currentLine) || /^[-*+]\s+/.test(currentLine) || /^\d+\.\s+/.test(currentLine)) {
        break
      }

      paragraphLines.push(renderInlineMarkdownHtml(currentLine))
      index += 1
    }

    blocks.push(`<p>${paragraphLines.join('<br />')}</p>`)
  }

  return blocks.join('\n')
}

function pushMarkdownPdfLines(lines: ClientItineraryPdfLine[], value: string | null) {
  const markdown = value?.trim()

  if (!markdown) {
    return
  }

  const sourceLines = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  let index = 0

  while (index < sourceLines.length) {
    const trimmedLine = (sourceLines[index] ?? '').trim()

    if (!trimmedLine) {
      lines.push({ text: '', lineHeight: 7 })
      index += 1
      continue
    }

    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmedLine)

    if (headingMatch) {
      lines.push({
        text: stripInlineMarkdown(headingMatch[2] ?? ''),
        bold: true,
        size: headingMatch[1]!.length <= 2 ? 12 : 11,
        lineHeight: 17,
      })
      index += 1
      continue
    }

    if (/^[-*+]\s+/.test(trimmedLine)) {
      while (index < sourceLines.length && /^[-*+]\s+/.test((sourceLines[index] ?? '').trim())) {
        lines.push({
          text: `- ${stripInlineMarkdown((sourceLines[index] ?? '').trim().replace(/^[-*+]\s+/, ''))}`,
          indent: 12,
          lineHeight: 15,
        })
        index += 1
      }
      continue
    }

    if (/^\d+\.\s+/.test(trimmedLine)) {
      while (index < sourceLines.length && /^\d+\.\s+/.test((sourceLines[index] ?? '').trim())) {
        lines.push({
          text: stripInlineMarkdown((sourceLines[index] ?? '').trim()),
          indent: 12,
          lineHeight: 15,
        })
        index += 1
      }
      continue
    }

    lines.push({
      text: stripInlineMarkdown(trimmedLine),
      lineHeight: 15,
    })
    index += 1
  }
}

function buildOverviewFields(trip: ClientItineraryTrip): ItineraryOverviewField[] {
  const destination = getDestinationName(trip.destination_ref, null)
  const dateRange = formatDateRange(trip.start_date, trip.end_date)
  const tripType = formatTripTypeLabel(trip.trip_type)
  const normalizedTripType = (trip.trip_type ?? '').trim().toLowerCase()
  const schoolOrGuest = getTripSchoolCustomerName(trip)
  const companyPartner = getTripCompanyPartnerName(trip)
  const fields: ItineraryOverviewField[] = []

  if (destination) fields.push({ label: 'Destination', value: destination })
  if (dateRange) fields.push({ label: 'Dates', value: dateRange })
  if (tripType !== '-') fields.push({ label: 'Trip Type', value: tripType })
  if (schoolOrGuest) {
    fields.push({
      label: normalizedTripType === 'educational' ? 'School' : 'Guest',
      value: schoolOrGuest,
    })
  }
  if (companyPartner) fields.push({ label: 'Company / Partner', value: companyPartner })

  return fields
}

function groupTripSheetsByDate(tripSheets: ClientItineraryTripSheet[]) {
  const sections = new Map<string, ItinerarySection>()

  for (const tripSheet of tripSheets) {
    const dateLabel = formatDate(tripSheet.start_date) ?? 'Date TBD'
    const section = sections.get(dateLabel) ?? { dateLabel, tripSheets: [] }
    section.tripSheets.push(tripSheet)
    sections.set(dateLabel, section)
  }

  return Array.from(sections.values())
}

export function renderClientItineraryHtml({
  trip,
  tripSheets,
}: {
  trip: ClientItineraryTrip
  tripSheets: ClientItineraryTripSheet[]
}) {
  const title = trip.title?.trim() || 'Untitled trip'
  const destination = getDestinationName(trip.destination_ref, null)
  const dateRange = formatDateRange(trip.start_date, trip.end_date)
  const overviewFields = buildOverviewFields(trip)
  const sections = groupTripSheetsByDate(tripSheets)

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} Client Itinerary</title>
  <style>
    body { margin: 0; color: #1f2937; font-family: Inter, Arial, sans-serif; background: #ffffff; }
    .page { padding: 48px; }
    .hero { padding-bottom: 26px; border-bottom: 1px solid #e5e7eb; }
    .eyebrow { margin: 0 0 10px; color: #6b7280; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
    h1 { margin: 0; color: #111827; font-size: 34px; line-height: 1.12; }
    .subtitle { margin: 12px 0 0; color: #4b5563; font-size: 15px; }
    .overview { margin: 28px 0 34px; padding: 22px 24px; border: 1px solid #d9e1ea; border-radius: 14px; background: #f8fafc; }
    .overview h2 { margin: 0 0 16px; color: #111827; font-size: 13px; letter-spacing: .12em; text-transform: uppercase; }
    .meta-row { display: grid; grid-template-columns: 150px 1fr; gap: 18px; margin: 8px 0; font-size: 13px; line-height: 1.45; }
    .meta-label { color: #6b7280; }
    .meta-value { color: #111827; font-weight: 700; }
    h2.section-title { margin: 0 0 18px; color: #111827; font-size: 22px; }
    .day { margin: 0 0 28px; break-inside: avoid; }
    .day-title { margin: 0 0 14px; color: #111827; font-size: 16px; font-weight: 800; }
    .module { margin: 0 0 20px; padding-bottom: 18px; border-bottom: 1px solid #eef2f7; break-inside: avoid; }
    .module h4 { margin: 0 0 6px; color: #111827; font-size: 15px; }
    .time { margin: 0 0 12px; color: #6b7280; font-size: 12px; font-weight: 700; }
    .body { color: #374151; font-size: 12.5px; line-height: 1.6; }
    .body h3, .body h4 { margin: 14px 0 6px; color: #111827; }
    .body p { margin: 0 0 10px; }
    .body ul, .body ol { margin: 0 0 10px 20px; padding: 0; }
    .body li { margin: 4px 0; }
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <p class="eyebrow">Client Itinerary</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="subtitle">${escapeHtml([destination, dateRange].filter(Boolean).join(' • '))}</p>
    </section>
    <section class="overview">
      <h2>Trip Overview</h2>
      ${overviewFields
        .map(
          (field) => `<div class="meta-row"><div class="meta-label">${escapeHtml(
            field.label
          )}</div><div class="meta-value">${escapeHtml(field.value)}</div></div>`
        )
        .join('\n')}
    </section>
    <section>
      <h2 class="section-title">Detailed Itinerary</h2>
      ${sections
        .map(
          (section) => `<div class="day"><h3 class="day-title">${escapeHtml(section.dateLabel)}</h3>${section.tripSheets
            .map(
              (tripSheet, index) => `<article class="module"><h4>${index + 1}. ${escapeHtml(
                tripSheet.title?.trim() || 'Untitled module'
              )}</h4><p class="time">${escapeHtml(formatDateTimeRange(tripSheet))}</p><div class="body">${renderMarkdownHtml(
                tripSheet.body_text
              )}</div></article>`
            )
            .join('\n')}</div>`
        )
        .join('\n')}
    </section>
  </main>
</body>
</html>`
}

export function renderClientItineraryPdfLines({
  trip,
  tripSheets,
}: {
  trip: ClientItineraryTrip
  tripSheets: ClientItineraryTripSheet[]
}) {
  const title = trip.title?.trim() || 'Untitled trip'
  const destination = getDestinationName(trip.destination_ref, null)
  const dateRange = formatDateRange(trip.start_date, trip.end_date)
  const overviewFields = buildOverviewFields(trip)
  const sections = groupTripSheetsByDate(tripSheets)
  const lines: ClientItineraryPdfLine[] = []

  lines.push({ text: 'CLIENT ITINERARY', size: 10, bold: true, muted: true, lineHeight: 15 })
  lines.push({ text: title, size: 20, bold: true, lineHeight: 28 })

  if (destination || dateRange) {
    lines.push({ text: [destination, dateRange].filter(Boolean).join(' • '), size: 11, muted: true, lineHeight: 18 })
  }

  lines.push({ text: '', lineHeight: 14 })
  lines.push({ text: 'TRIP OVERVIEW', size: 12, bold: true, indent: 16, lineHeight: 20, boxGroup: 'client-overview' })
  lines.push({ text: '', indent: 16, lineHeight: 5, boxGroup: 'client-overview' })

  for (const field of overviewFields) {
    lines.push({
      text: '',
      label: field.label,
      value: field.value,
      labelColumnWidth: 112,
      indent: 16,
      lineHeight: 17,
      boxGroup: 'client-overview',
    })
  }

  lines.push({ text: '', lineHeight: 26 })
  lines.push({ text: 'Detailed Itinerary', size: 15, bold: true, lineHeight: 24 })

  for (const section of sections) {
    lines.push({ text: '', lineHeight: 8 })
    lines.push({ text: section.dateLabel, size: 13, bold: true, lineHeight: 20 })

    for (const [index, tripSheet] of section.tripSheets.entries()) {
      lines.push({ text: `${index + 1}. ${tripSheet.title?.trim() || 'Untitled module'}`, size: 12, bold: true, lineHeight: 18 })
      const schedule = formatDateTimeRange(tripSheet)

      if (schedule) {
        lines.push({ text: schedule, size: 10, muted: true, lineHeight: 15 })
      }

      pushMarkdownPdfLines(lines, tripSheet.body_text)
      lines.push({ text: '', lineHeight: 8, rule: true })
    }
  }

  return lines
}
