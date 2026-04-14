export const APP_TIME_ZONE = 'Asia/Kolkata'
const DAY_IN_MS = 24 * 60 * 60 * 1000

type TimeZoneParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const appDateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

function parseNumericPart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes
) {
  const value = parts.find((part) => part.type === type)?.value ?? ''
  const parsedValue = Number(value)

  return Number.isNaN(parsedValue) ? 0 : parsedValue
}

function parseDateString(value: string | null) {
  if (!value) {
    return null
  }

  const [yearText, monthText, dayText] = value.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)

  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return null
  }

  return { year, month, day }
}

function parseTimeString(value: string | null) {
  if (!value) {
    return null
  }

  const [hoursText, minutesText, secondsText] = value.split(':')
  const hours = Number(hoursText)
  const minutes = Number(minutesText)
  const seconds = secondsText ? Number(secondsText) : 0

  if (Number.isNaN(hours) || Number.isNaN(minutes) || Number.isNaN(seconds)) {
    return null
  }

  return { hours, minutes, seconds }
}

export function getCurrentTimePartsInAppTimeZone(date = new Date()): TimeZoneParts {
  const parts = appDateTimeFormatter.formatToParts(date)

  return {
    year: parseNumericPart(parts, 'year'),
    month: parseNumericPart(parts, 'month'),
    day: parseNumericPart(parts, 'day'),
    hour: parseNumericPart(parts, 'hour'),
    minute: parseNumericPart(parts, 'minute'),
    second: parseNumericPart(parts, 'second'),
  }
}

export function getCurrentDateStringInAppTimeZone(date = new Date()) {
  const { year, month, day } = getCurrentTimePartsInAppTimeZone(date)

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function getCurrentComparableTimestampInAppTimeZone(date = new Date()) {
  const { year, month, day, hour, minute, second } = getCurrentTimePartsInAppTimeZone(date)

  return Date.UTC(year, month - 1, day, hour, minute, second, 0)
}

export function parseDateTimeInAppTimeZoneToComparableTimestamp(
  date: string | null,
  time: string | null,
  fallbackToEndOfDay = false
) {
  const parsedDate = parseDateString(date)

  if (!parsedDate) {
    return null
  }

  const parsedTime = parseTimeString(time)
  const hours = parsedTime?.hours ?? (fallbackToEndOfDay ? 23 : 0)
  const minutes = parsedTime?.minutes ?? (fallbackToEndOfDay ? 59 : 0)
  const seconds = parsedTime?.seconds ?? 0

  return Date.UTC(
    parsedDate.year,
    parsedDate.month - 1,
    parsedDate.day,
    hours,
    minutes,
    seconds,
    0
  )
}

export function addDaysToDateString(value: string, days: number) {
  const parsedDate = parseDateString(value)

  if (!parsedDate) {
    return value
  }

  const nextDate = new Date(Date.UTC(parsedDate.year, parsedDate.month - 1, parsedDate.day))
  nextDate.setUTCDate(nextDate.getUTCDate() + days)

  const year = nextDate.getUTCFullYear()
  const month = String(nextDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(nextDate.getUTCDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function diffDateStringsInDays(fromDate: string, toDate: string) {
  const parsedFromDate = parseDateString(fromDate)
  const parsedToDate = parseDateString(toDate)

  if (!parsedFromDate || !parsedToDate) {
    return null
  }

  const fromTimestamp = Date.UTC(
    parsedFromDate.year,
    parsedFromDate.month - 1,
    parsedFromDate.day
  )
  const toTimestamp = Date.UTC(parsedToDate.year, parsedToDate.month - 1, parsedToDate.day)

  return Math.round((toTimestamp - fromTimestamp) / DAY_IN_MS)
}

export function getRelativeDateLabelInAppTimeZone(value: string | null, now = new Date()) {
  if (!value) {
    return null
  }

  const today = getCurrentDateStringInAppTimeZone(now)
  const diffInDays = diffDateStringsInDays(today, value)

  if (diffInDays === null) {
    return null
  }

  if (diffInDays === 0) {
    return 'Today'
  }

  if (diffInDays === 1) {
    return 'Tomorrow'
  }

  if (diffInDays > 1 && diffInDays <= 6) {
    return `In ${diffInDays} days`
  }

  return null
}

export function getCurrentDateInAppTimeZone(date = new Date()) {
  const currentDate = getCurrentDateStringInAppTimeZone(date)
  const parsedDate = parseDateString(currentDate)

  if (!parsedDate) {
    return new Date(date)
  }

  return new Date(parsedDate.year, parsedDate.month - 1, parsedDate.day)
}

export function formatTimeValue(value: string | null, locale = 'en-US') {
  if (!value) {
    return 'Time TBD'
  }

  const parsedTime = parseTimeString(value)

  if (!parsedTime) {
    return value
  }

  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  }).format(
    new Date(Date.UTC(1970, 0, 1, parsedTime.hours, parsedTime.minutes, parsedTime.seconds, 0))
  )
}
