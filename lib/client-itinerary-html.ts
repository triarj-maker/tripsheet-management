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

export type ClientItineraryResource = {
  id: string
  full_name: string | null
  phone: string | null
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
  bullet?: boolean
  color?: 'body' | 'heading' | 'accent' | 'muted' | 'light'
  ruleColor?: 'accent' | 'light'
  labelMuted?: boolean
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

  const [startYear, startMonth, startDay] = startDate?.split('-').map(Number) ?? []
  const [endYear, endMonth, endDay] = endDate?.split('-').map(Number) ?? []

  if (startYear && startMonth && startDay && endYear && endMonth && endDay) {
    const endMonthYear = new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(endYear, endMonth - 1, endDay)))

    if (startYear === endYear && startMonth === endMonth) {
      return `${startDay}-${endDay} ${endMonthYear}`
    }
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

function formatActivityTimeRange(tripSheet: ClientItineraryTripSheet) {
  const startTime = formatTime(tripSheet.start_time)
  const endTime = formatTime(tripSheet.end_time)
  const spansMultipleDates =
    tripSheet.start_date &&
    tripSheet.end_date &&
    tripSheet.start_date !== tripSheet.end_date

  if (spansMultipleDates) {
    return formatDateTimeRange(tripSheet)
  }

  if (startTime && endTime) {
    return `${startTime} - ${endTime}`
  }

  return startTime ?? endTime ?? ''
}

function renderInlineMarkdownHtml(value: string) {
  let html = ''
  let cursor = 0

  while (cursor < value.length) {
    const linkMatch = /\[([^\]]+)\]\(([^)]+)\)/g
    linkMatch.lastIndex = cursor
    const nextLink = linkMatch.exec(value)
    const boldStart = value.indexOf('**', cursor)
    const italicStart = value.indexOf('*', cursor)
    const candidates = [
      nextLink ? { type: 'link', start: nextLink.index, match: nextLink } : null,
      boldStart >= 0 ? { type: 'bold', start: boldStart, match: null } : null,
      italicStart >= 0 ? { type: 'italic', start: italicStart, match: null } : null,
    ].filter((candidate): candidate is { type: string; start: number; match: RegExpExecArray | null } => Boolean(candidate))
    const next = candidates.sort((a, b) => a.start - b.start)[0]

    if (!next) {
      html += escapeHtml(value.slice(cursor))
      break
    }

    html += escapeHtml(value.slice(cursor, next.start))

    if (next.type === 'link' && next.match) {
      const linkText = next.match[1] ?? ''
      const href = (next.match[2] ?? '').trim()
      const isSafeHref = /^(https?:\/\/|mailto:)/i.test(href)
      html += isSafeHref
        ? `<a href="${escapeHtml(href)}">${renderInlineMarkdownHtml(linkText)}</a>`
        : renderInlineMarkdownHtml(linkText)
      cursor = next.start + next.match[0].length
      continue
    }

    if (next.type === 'bold') {
      const end = value.indexOf('**', next.start + 2)

      if (end === -1) {
        html += escapeHtml(value.slice(next.start, next.start + 2))
        cursor = next.start + 2
        continue
      }

      html += `<strong>${renderInlineMarkdownHtml(value.slice(next.start + 2, end))}</strong>`
      cursor = end + 2
      continue
    }

    if (next.type === 'italic') {
      const isListMarker = next.start === 0 && /^\*\s+/.test(value)
      const isBoldMarker = value.slice(next.start, next.start + 2) === '**'

      if (isListMarker || isBoldMarker) {
        html += escapeHtml(value.slice(next.start, next.start + 1))
        cursor = next.start + 1
        continue
      }

      const end = value.indexOf('*', next.start + 1)

      if (end === -1) {
        html += escapeHtml(value.slice(next.start, next.start + 1))
        cursor = next.start + 1
        continue
      }

      html += `<em>${renderInlineMarkdownHtml(value.slice(next.start + 1, end))}</em>`
      cursor = end + 1
    }
  }

  return html
}

function stripInlineMarkdown(value: string) {
  return value
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim()
}

function lineIsFullyEmphasized(value: string, marker: '**' | '*') {
  return value.startsWith(marker) && value.endsWith(marker) && value.length > marker.length * 2
}

function cleanDisplayMarkdownLine(value: string) {
  return value
    .trim()
    .replace(/^>\s*/, '')
    .replace(/\s+#{1,6}\s*$/g, '')
    .replace(/^#{1,6}\s*$/, '')
    .trim()
}

function normalizeMarkdownLines(value: string | null) {
  return (value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(cleanDisplayMarkdownLine)
}

function renderClientBodyHtml(value: string | null) {
  const lines = normalizeMarkdownLines(value)

  const blocks: string[] = []
  let index = 0

  while (index < lines.length) {
    const currentLine = lines[index] ?? ''

    if (!currentLine) {
      index += 1
      continue
    }

    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(currentLine)

    if (headingMatch) {
      const level = Math.min(Math.max(headingMatch[1]?.length ?? 2, 1), 4)
      const headingText = cleanDisplayMarkdownLine(headingMatch[2] ?? '')
      if (headingText) {
        blocks.push(`<h5 class="md-heading md-heading-${level}">${renderInlineMarkdownHtml(headingText)}</h5>`)
      }
      index += 1
      continue
    }

    if (/^[-*+]\s+/.test(currentLine)) {
      const items: string[] = []

      while (index < lines.length && /^[-*+]\s+/.test(lines[index] ?? '')) {
        const itemText = cleanDisplayMarkdownLine((lines[index] ?? '').replace(/^[-*+]\s+/, ''))
        if (itemText) {
          items.push(`<li>${renderInlineMarkdownHtml(itemText)}</li>`)
        }
        index += 1
      }

      if (items.length > 0) {
        blocks.push(`<ul>${items.join('')}</ul>`)
      }
      continue
    }

    if (/^\d+\.\s+/.test(currentLine)) {
      const items: string[] = []

      while (index < lines.length && /^\d+\.\s+/.test(lines[index] ?? '')) {
        const itemText = cleanDisplayMarkdownLine((lines[index] ?? '').replace(/^\d+\.\s+/, ''))
        if (itemText) {
          items.push(`<li>${renderInlineMarkdownHtml(itemText)}</li>`)
        }
        index += 1
      }

      if (items.length > 0) {
        blocks.push(`<ol>${items.join('')}</ol>`)
      }
      continue
    }

    const paragraphLines: string[] = []

    while (index < lines.length) {
      const paragraphLine = lines[index] ?? ''

      if (
        !paragraphLine ||
        /^#{1,6}\s+/.test(paragraphLine) ||
        /^[-*+]\s+/.test(paragraphLine) ||
        /^\d+\.\s+/.test(paragraphLine)
      ) {
        break
      }

      paragraphLines.push(renderInlineMarkdownHtml(paragraphLine))
      index += 1
    }

    if (paragraphLines.length > 0) {
      blocks.push(`<p>${paragraphLines.join('<br />')}</p>`)
    }
  }

  return blocks.join('\n')
}

function pushClientBodyPdfLines(lines: ClientItineraryPdfLine[], value: string | null) {
  const bodyLines = normalizeMarkdownLines(value)
  let index = 0

  while (index < bodyLines.length) {
    const currentLine = bodyLines[index] ?? ''

    if (!currentLine) {
      lines.push({ text: '', lineHeight: 5 })
      index += 1
      continue
    }

    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(currentLine)

    if (headingMatch) {
      const level = Math.min(Math.max(headingMatch[1]?.length ?? 2, 1), 4)
      const headingText = cleanDisplayMarkdownLine(headingMatch[2] ?? '')
      if (headingText) {
        lines.push({
          text: stripInlineMarkdown(headingText),
          size: level === 1 ? 12 : level === 2 ? 11 : level === 3 ? 10.5 : 10,
          bold: true,
          lineHeight: level === 1 ? 19 : level === 2 ? 17 : 15,
          color: 'heading',
        })
      }
      index += 1
      continue
    }

    if (/^[-*+]\s+/.test(currentLine)) {
      const itemText = cleanDisplayMarkdownLine(currentLine.replace(/^[-*+]\s+/, ''))
      if (itemText) {
        lines.push({
          text: stripInlineMarkdown(itemText),
          indent: 12,
          lineHeight: 14,
          bullet: true,
          color: 'body',
        })
      }
      index += 1
      continue
    }

    if (/^\d+\.\s+/.test(currentLine)) {
      lines.push({
      text: stripInlineMarkdown(currentLine),
      indent: 12,
      lineHeight: 14,
      color: 'body',
    })
      index += 1
      continue
    }

    lines.push({
      text: stripInlineMarkdown(currentLine),
      lineHeight: 14,
      bold: lineIsFullyEmphasized(currentLine, '**'),
      color: 'body',
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

function formatAssignedResourceDetails(resources: ClientItineraryResource[]) {
  return resources
    .map((resource) => {
      const name = resource.full_name?.trim() || 'Assigned guide'
      const phone = resource.phone?.trim()

      return phone ? `${name} | ${phone}` : name
    })
    .join('; ')
}

export function renderClientItineraryHtml({
  trip,
  tripSheets,
  assignedResourcesByTripSheetId = new Map(),
  includeResourceDetails = false,
}: {
  trip: ClientItineraryTrip
  tripSheets: ClientItineraryTripSheet[]
  assignedResourcesByTripSheetId?: Map<string, ClientItineraryResource[]>
  includeResourceDetails?: boolean
}) {
  const title = trip.title?.trim() || 'Untitled trip'
  const destination = getDestinationName(trip.destination_ref, null)
  const dateRange = formatDateRange(trip.start_date, trip.end_date)
  const journeyLine = destination ? `${destination} Learning Journey` : dateRange
  const overviewFields = buildOverviewFields(trip)
  const sections = groupTripSheetsByDate(tripSheets)

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} Client Itinerary</title>
  <style>
    @page { margin: 34px 42px 42px; }
    body { margin: 0; color: #1f2937; font-family: Georgia, 'Times New Roman', serif; background: #ffffff; }
    .page { padding: 0; }
    .hero { padding: 36px 0 32px; border-bottom: 1px solid #cfd8d3; }
    .prepared, .meta-label, .time { font-family: Inter, Arial, sans-serif; }
    h1 { margin: 0; color: #10231c; font-size: 38px; line-height: 1.08; }
    .subtitle { margin: 16px 0 0; color: #2f4a40; font-size: 17px; font-weight: 700; }
    .dates { margin: 7px 0 0; color: #4b5563; font-size: 14px; }
    .prepared { margin: 22px 0 0; color: #9ca3af; font-size: 10px; }
    .overview { margin: 30px 0 38px; padding: 18px 0; border-top: 1px solid #e3e8e5; border-bottom: 1px solid #e3e8e5; break-inside: avoid; }
    .overview h2 { margin: 0 0 15px; color: #10231c; font-size: 18px; }
    .meta-row { display: grid; grid-template-columns: 140px 1fr; gap: 22px; margin: 7px 0; font-size: 13px; line-height: 1.45; }
    .meta-label { color: #7b8580; font-size: 11px; letter-spacing: .04em; text-transform: uppercase; }
    .meta-value { color: #111827; font-weight: 700; }
    h2.section-title { margin: 0 0 24px; color: #10231c; font-size: 22px; }
    .day { margin: 0 0 34px; break-inside: avoid; page-break-inside: avoid; }
    .day-title { margin: 0 0 18px; color: #10231c; font-size: 18px; font-weight: 800; break-after: avoid; page-break-after: avoid; }
    .module { margin: 0; padding: 15px 0 16px; border-top: 1px solid #edf1ef; background: #ffffff; break-inside: avoid; page-break-inside: avoid; }
    .module:first-of-type { border-top-color: #cfd8d3; }
    .module h4 { margin: 4px 0 9px; color: #111827; font-size: 15px; font-weight: 800; }
    .time { margin: 0 0 7px; color: #5f766d; font-size: 10.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
    .body { color: #374151; font-size: 12.5px; line-height: 1.68; }
    .body .md-heading { margin: 14px 0 6px; color: #10231c; font-family: Inter, Arial, sans-serif; font-weight: 800; letter-spacing: .03em; }
    .body .md-heading:first-child { margin-top: 0; }
    .body .md-heading-1 { font-size: 13px; }
    .body .md-heading-2 { font-size: 12px; }
    .body .md-heading-3, .body .md-heading-4 { font-size: 11px; text-transform: uppercase; }
    .body p { margin: 0 0 8px; }
    .body p:last-child { margin-bottom: 0; }
    .body ul, .body ol { margin: 0 0 9px 18px; padding: 0; }
    .body li { margin: 4px 0; }
    .body a { color: #256f63; text-decoration: none; }
    .footer { margin-top: 38px; color: #c8cdd2; font-family: Inter, Arial, sans-serif; font-size: 7.5px; text-align: center; }
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <h1>${escapeHtml(title)}</h1>
      ${journeyLine ? `<p class="subtitle">${escapeHtml(journeyLine)}</p>` : ''}
      ${dateRange && destination ? `<p class="dates">${escapeHtml(dateRange)}</p>` : ''}
      <p class="prepared">Prepared by Echo Journeys</p>
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
              (tripSheet) => {
                const assignedResources = assignedResourcesByTripSheetId.get(tripSheet.id) ?? []
                const resourceDetails =
                  includeResourceDetails && assignedResources.length > 0
                    ? formatAssignedResourceDetails(assignedResources)
                    : ''

                return `<article class="module"><h4>${escapeHtml(
                  tripSheet.title?.trim() || 'Untitled module'
                )}</h4><p class="time">${escapeHtml(formatActivityTimeRange(tripSheet))}</p>${
                  resourceDetails
                    ? `<p class="time">${escapeHtml(`Guide / Coordinator: ${resourceDetails}`)}</p>`
                    : ''
                }<div class="body">${renderClientBodyHtml(tripSheet.body_text)}</div></article>`
              }
            )
            .join('\n')}</div>`
        )
        .join('\n')}
    </section>
    <footer class="footer">Copyright 2026-27 Travspire Experiences Private Limited</footer>
  </main>
</body>
</html>`
}

export function renderClientItineraryPdfLines({
  trip,
  tripSheets,
  assignedResourcesByTripSheetId = new Map(),
  includeResourceDetails = false,
}: {
  trip: ClientItineraryTrip
  tripSheets: ClientItineraryTripSheet[]
  assignedResourcesByTripSheetId?: Map<string, ClientItineraryResource[]>
  includeResourceDetails?: boolean
}) {
  const title = trip.title?.trim() || 'Untitled trip'
  const destination = getDestinationName(trip.destination_ref, null)
  const dateRange = formatDateRange(trip.start_date, trip.end_date)
  const journeyLine = destination ? `${destination} Learning Journey` : dateRange
  const overviewFields = buildOverviewFields(trip)
  const sections = groupTripSheetsByDate(tripSheets)
  const lines: ClientItineraryPdfLine[] = []

  lines.push({ text: title, size: 25, bold: true, lineHeight: 38, color: 'heading' })

  if (journeyLine) {
    lines.push({ text: journeyLine, size: 13, bold: true, lineHeight: 22, color: 'accent' })
  }

  if (destination && dateRange) {
    lines.push({ text: dateRange, size: 11, lineHeight: 19, color: 'muted' })
  }

  lines.push({ text: 'Prepared by Echo Journeys', size: 8, lineHeight: 26, color: 'light' })
  lines.push({ text: '', lineHeight: 6, rule: true, ruleColor: 'accent' })
  lines.push({ text: '', lineHeight: 10 })
  lines.push({ text: 'Overview', size: 14, bold: true, lineHeight: 24, color: 'heading' })

  for (const field of overviewFields) {
    lines.push({
      text: '',
      label: field.label,
      value: field.value,
      labelColumnWidth: 120,
      lineHeight: 17,
      color: 'body',
      labelMuted: true,
    })
  }

  lines.push({ text: '', lineHeight: 6, rule: true, ruleColor: 'light' })
  lines.push({ text: '', lineHeight: 14 })
  lines.push({ text: 'Detailed Itinerary', size: 16, bold: true, lineHeight: 24, color: 'heading' })

  for (const section of sections) {
    lines.push({ text: '', lineHeight: 8 })
    lines.push({ text: section.dateLabel, size: 14, bold: true, lineHeight: 22, color: 'accent' })
    lines.push({ text: '', lineHeight: 4, rule: true, ruleColor: 'light' })
    lines.push({ text: '', lineHeight: 6 })

    for (const tripSheet of section.tripSheets) {
      const schedule = formatActivityTimeRange(tripSheet)
      const assignedResources = assignedResourcesByTripSheetId.get(tripSheet.id) ?? []

      lines.push({
        text: tripSheet.title?.trim() || 'Untitled module',
        size: 12,
        bold: true,
        lineHeight: schedule ? 17 : 20,
        color: 'heading',
      })

      if (schedule) {
        lines.push({ text: schedule, size: 9, bold: true, lineHeight: 16, color: 'muted' })
      }

      if (includeResourceDetails && assignedResources.length > 0) {
        lines.push({
          text: `Guide / Coordinator: ${formatAssignedResourceDetails(assignedResources)}`,
          size: 9,
          bold: true,
          lineHeight: 16,
          color: 'muted',
        })
      }

      if (schedule || (includeResourceDetails && assignedResources.length > 0)) {
        lines.push({ text: '', lineHeight: 3 })
      }

      pushClientBodyPdfLines(lines, tripSheet.body_text)
      lines.push({ text: '', lineHeight: 6, rule: true, ruleColor: 'light' })
      lines.push({ text: '', lineHeight: 6 })
    }
  }

  return lines
}
