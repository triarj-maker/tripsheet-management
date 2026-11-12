import { createSimplePdf } from '@/lib/pdf'
import type { ResourceScheduleTrip, ScheduleFilter } from '@/lib/resource-assignment-schedule'
import { APP_TIME_ZONE, getCurrentDateStringInAppTimeZone, parseDateTimeInAppTimeZoneToComparableTimestamp } from '@/lib/time'

type PdfPages = Parameters<typeof createSimplePdf>[0]
type PdfLine = PdfPages[number]['lines'][number]

// Built-in Helvetica cannot encode Unicode. Keep output byte-safe and make
// unsupported characters visible rather than silently deleting entire names.
export function schedulePdfText(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2010-\u2015]/g, '-').replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"').replace(/\u00b7/g, ' / ')
    .replace(/[^\x20-\x7e]/gu, '?').replace(/\s+/g, ' ').trim()
}

// Conservative per-glyph bounds for built-in Helvetica, including bold headers.
function wrap(value: string, width: number, size = 10) {
  const measure = (text: string) => [...text].reduce((total, character) => total + size * (
    /[MW@%mw]/.test(character) ? 1 : /[ilI .,'!]/.test(character) ? 0.3
      : /[A-Z]/.test(character) ? 0.8 : /[a-z]/.test(character) ? 0.65 : 0.6
  ), 0)
  const lines: string[] = []
  let line = ''
  for (const word of schedulePdfText(value).split(' ')) {
    if (line && measure(`${line} ${word}`) > width) {
      lines.push(line)
      line = ''
    }
    for (const character of word) {
      if (measure(line + character) > width) {
        lines.push(line)
        line = ''
      }
      line += character
    }
    line += ' '
  }
  if (line.trim()) lines.push(line.trim())
  return lines.length ? lines.map(text => text.trim()) : ['-']
}

function dateLabel(date: string | null) {
  const timestamp = parseDateTimeInAppTimeZoneToComparableTimestamp(date, null)
  const label = timestamp === null ? 'Date TBD' : new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(timestamp))
  return label
}

export function resourceSchedulePdfFilename(name: string, generatedAt: Date) {
  const slug = schedulePdfText(name).toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 70).replace(/-+$/, '') || 'resource'
  return `resource-assignments-${slug}-${getCurrentDateStringInAppTimeZone(generatedAt)}.pdf`
}

export function createResourceSchedulePdf({ name, entries, filter, generatedAt }: {
  name: string
  entries: ResourceScheduleTrip[]
  filter: ScheduleFilter
  generatedAt: Date
}) {
  const pages: PdfPages = []
  const columns = [0, 125, 325, 430]
  const widths = [117, 192, 97, 68]
  const maxHeight = 700 // A4: leaves clear space above the footer at y=52.
  let lines: PdfLine[] = []
  let height = 0

  function add(line: PdfLine) {
    lines.push(line)
    height += line.lineHeight ?? 14
  }
  function tableLine(values: string[], bold = false) {
    values.forEach((text, index) => add({
      text, indent: columns[index], size: 10, bold,
      color: bold ? 'accent' : 'body', lineHeight: index === 3 ? 14 : 0,
    }))
  }
  function newPage() {
    if (lines.length) pages.push({ lines })
    lines = []
    height = 0
    add({ text: 'ECHO JOURNEYS', size: 11, bold: true, color: 'accent', lineHeight: 20 })
    add({ text: 'Resource Assignment Schedule', size: 18, bold: true, color: 'heading', lineHeight: 27 })
    const nameLines = wrap(name || 'Unnamed resource', 498, 12)
    for (const [index, text] of nameLines.slice(0, 3).entries()) {
      add({ text: index === 2 && nameLines.length > 3 ? `${text.slice(0, -3)}...` : text, size: 12, bold: true, lineHeight: 17 })
    }
    const generatedDate = new Intl.DateTimeFormat('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', timeZone: APP_TIME_ZONE,
    }).format(generatedAt)
    add({ text: `Generated on ${generatedDate} | ${filter === 'upcoming' ? 'Upcoming (including ongoing)' : filter === 'past' ? 'Past' : 'All'} | ${APP_TIME_ZONE}`, size: 9, color: 'muted', lineHeight: 24 })
    for (const text of wrap('Assigned dates cover scheduled sessions only, not necessarily full-trip coverage.', 498, 9)) {
      add({ text, size: 9, color: 'muted', lineHeight: 13 })
    }
    add({ text: '', lineHeight: 10 })
    tableLine(['Assigned dates', 'School / Trip', 'Destination', 'Sessions'], true)
    add({ text: '', rule: true, lineHeight: 12 })
  }

  newPage()
  if (!entries.length) add({ text: 'No assignments for the selected filter.', size: 11, lineHeight: 20 })
  for (const entry of entries) {
    const schoolTrip = entry.customer === entry.tripTitle || entry.customer === '-'
      ? entry.tripTitle : `${entry.customer} / ${entry.tripTitle}`
    const cells = [
      [...wrap(dateLabel(entry.assignedStartDate), widths[0]),
        ...wrap(`to ${dateLabel(entry.assignedEndDate)}`, widths[0])],
      wrap(schoolTrip, widths[1]), wrap(entry.destination, widths[2]),
      wrap(String(entry.sessionCount), widths[3]),
    ]
    const rowLines = Math.max(...cells.map(cell => cell.length))
    // Keep normal rows together. Exceptionally large rows continue with headers.
    if (height + rowLines * 14 + 12 > maxHeight && rowLines * 14 + 12 <= maxHeight - 200) newPage()
    for (let index = 0; index < rowLines; index++) {
      if (height + 14 > maxHeight) newPage()
      tableLine(cells.map(cell => cell[index] ?? ''))
    }
    add({ text: '', rule: true, ruleColor: 'light', lineHeight: 12 })
  }
  if (lines.length) pages.push({ lines })
  return createSimplePdf(pages, {
    pageSize: 'a4', pageNumbers: true,
    footerLines: [
      'This schedule reflects assignments as of the generation date. Please contact the Echo Journeys team',
      'regarding any changes or scheduling conflicts.',
    ],
  })
}
