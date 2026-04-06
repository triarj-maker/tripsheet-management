'use client'

import type { EventInput } from '@fullcalendar/core'
import { usePathname, useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'

import WeeklyTripSheetDrawer from './WeeklyTripSheetDrawer'

export type CalendarAvailableResource = {
  id: string
  label: string
}

export type CalendarAssignedResource = {
  assignmentId: string
  resourceUserId: string
  label: string
}

export type MonthCalendarEvent = EventInput & {
  extendedProps: {
    isArchived: boolean
    hasConflict: boolean
    conflictDayIds: string[]
    textColor: string
  }
}

export type WeekCalendarEvent = EventInput & {
  extendedProps: {
    destination: string
    guestName: string
    assignedLabel: string
    isUnassigned: boolean
    isArchived: boolean
    tripSheetTitle: string
    parentTripTitle: string
    startDate: string | null
    startTime: string | null
    endDate: string | null
    endTime: string | null
    hasConflict: boolean
    assignedResources: CalendarAssignedResource[]
    textColor: string
    mutedColor: string
    faintColor: string
    warningColor: string
  }
}

type TripSheetCalendarProps = {
  monthEvents: MonthCalendarEvent[]
  weekEvents: WeekCalendarEvent[]
  availableResources: CalendarAvailableResource[]
  initialViewMode: 'month' | 'week'
  initialDateValue: string
  initialSelectedWeekEventId: string
  title: string
  subtitle: string
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function formatIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`
}

function formatMonthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function getWeekStart(date: Date) {
  const nextDate = new Date(date)
  const dayIndex = (nextDate.getDay() + 6) % 7
  nextDate.setDate(nextDate.getDate() - dayIndex)
  nextDate.setHours(0, 0, 0, 0)
  return nextDate
}

function addMonths(date: Date, months: number) {
  const nextDate = new Date(date)
  nextDate.setDate(1)
  nextDate.setMonth(nextDate.getMonth() + months)
  nextDate.setHours(0, 0, 0, 0)
  return nextDate
}

function getMonthStart(date: Date) {
  const nextDate = new Date(date.getFullYear(), date.getMonth(), 1)
  nextDate.setHours(0, 0, 0, 0)
  return nextDate
}

function getMonthGridStart(date: Date) {
  return getWeekStart(getMonthStart(date))
}

function formatWeekRangeLabel(date: Date) {
  const weekStart = getWeekStart(date)
  const weekEnd = addDays(weekStart, 6)
  const sameYear = weekStart.getFullYear() === weekEnd.getFullYear()
  const sameMonth =
    sameYear && weekStart.getMonth() === weekEnd.getMonth()

  const shortFormatter = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
  })
  const fullFormatter = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  if (sameMonth) {
    return `${weekStart.getDate()}–${fullFormatter.format(weekEnd)}`
  }

  if (sameYear) {
    return `${shortFormatter.format(weekStart)} – ${fullFormatter.format(weekEnd)}`
  }

  return `${fullFormatter.format(weekStart)} – ${fullFormatter.format(weekEnd)}`
}

function formatWeekDayLabel(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
  }).format(date)
}

function formatWeekDayDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function formatWeekDayIso(date: Date) {
  return formatIsoDate(date)
}

function parseInitialCalendarDate(value: string) {
  if (!value) {
    return new Date()
  }

  const [yearText, monthText, dayText] = value.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)

  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return new Date()
  }

  return new Date(year, month - 1, day)
}

function getEventDateRange(event: WeekCalendarEvent) {
  const startDate = event.extendedProps.startDate ?? ''
  const endDate = event.extendedProps.endDate ?? startDate

  return {
    startDate,
    endDate: endDate || startDate,
  }
}

function getMonthEventDateValue(value: EventInput['start'] | EventInput['end']) {
  if (typeof value === 'string') {
    return value.slice(0, 10)
  }

  if (value instanceof Date) {
    return formatIsoDate(value)
  }

  return ''
}

function addDaysToIsoDate(value: string, days: number) {
  const parsedDate = parseInitialCalendarDate(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return ''
  }

  return formatIsoDate(addDays(parsedDate, days))
}

function getMonthEventDateRange(event: MonthCalendarEvent) {
  const startDate = getMonthEventDateValue(event.start)
  const exclusiveEndDate = getMonthEventDateValue(event.end)
  const endDate = exclusiveEndDate
    ? addDaysToIsoDate(exclusiveEndDate, -1)
    : startDate

  return {
    startDate,
    endDate: endDate || startDate,
  }
}

type MonthWeekPlacement = {
  event: MonthCalendarEvent
  columnStart: number
  columnEnd: number
  row: number
}

type MonthOverflowPopoverState = {
  dayIso: string
  dayLabel: string
  items: MonthCalendarEvent[]
  top: number
  left: number
  width: number
}

function getMonthWeekPlacements(events: MonthCalendarEvent[], weekDays: Date[]) {
  if (weekDays.length === 0) {
    return []
  }

  const weekDayIds = weekDays.map((day) => formatWeekDayIso(day))
  const weekStartIso = weekDayIds[0] ?? ''
  const weekEndIso = weekDayIds[6] ?? weekStartIso
  const dayIndexByIso = new Map(weekDayIds.map((dayIso, index) => [dayIso, index]))

  const weekEvents = events
    .map((event) => {
      const { startDate, endDate } = getMonthEventDateRange(event)

      if (!startDate || !endDate) {
        return null
      }

      if (startDate > weekEndIso || endDate < weekStartIso) {
        return null
      }

      const visibleStartDate = startDate < weekStartIso ? weekStartIso : startDate
      const visibleEndDate = endDate > weekEndIso ? weekEndIso : endDate

      return {
        event,
        startDate,
        endDate,
        visibleStartDate,
        visibleEndDate,
        columnStart: (dayIndexByIso.get(visibleStartDate) ?? 0) + 1,
        columnEnd: (dayIndexByIso.get(visibleEndDate) ?? 0) + 1,
      }
    })
    .filter(
      (
        value
      ): value is {
        event: MonthCalendarEvent
        startDate: string
        endDate: string
        visibleStartDate: string
        visibleEndDate: string
        columnStart: number
        columnEnd: number
      } => value !== null
    )
    .sort((left, right) => {
      if (left.startDate !== right.startDate) {
        return left.startDate.localeCompare(right.startDate)
      }

      if (left.endDate !== right.endDate) {
        return right.endDate.localeCompare(left.endDate)
      }

      return String(left.event.title ?? '').localeCompare(String(right.event.title ?? ''))
    })

  const rowSpans: Array<Array<{ start: number; end: number }>> = []

  return weekEvents.map((weekEvent) => {
    let row = rowSpans.findIndex((spans) =>
      spans.every(
        (span) =>
          weekEvent.columnEnd < span.start || weekEvent.columnStart > span.end
      )
    )

    if (row === -1) {
      row = rowSpans.length
      rowSpans.push([])
    }

    rowSpans[row]?.push({
      start: weekEvent.columnStart,
      end: weekEvent.columnEnd,
    })

    return {
      event: weekEvent.event,
      columnStart: weekEvent.columnStart,
      columnEnd: weekEvent.columnEnd,
      row: row + 1,
    } satisfies MonthWeekPlacement
  })
}

function getMonthWeekHiddenCounts(placements: MonthWeekPlacement[], weekDays: Date[]) {
  const dayIds = weekDays.map((day) => formatWeekDayIso(day))
  const hiddenCountByDay = new Map(dayIds.map((dayId) => [dayId, 0]))

  for (const placement of placements) {
    if (placement.row <= 2) {
      continue
    }

    for (let index = placement.columnStart - 1; index < placement.columnEnd; index += 1) {
      const dayId = dayIds[index]

      if (!dayId) {
        continue
      }

      hiddenCountByDay.set(dayId, (hiddenCountByDay.get(dayId) ?? 0) + 1)
    }
  }

  return hiddenCountByDay
}

function getMonthWeekHiddenEventsByDay(
  placements: MonthWeekPlacement[],
  weekDays: Date[]
) {
  const dayIds = weekDays.map((day) => formatWeekDayIso(day))
  const hiddenEventsByDay = new Map(
    dayIds.map((dayId) => [dayId, [] as MonthCalendarEvent[]])
  )

  for (const placement of placements) {
    if (placement.row <= 2) {
      continue
    }

    for (let index = placement.columnStart - 1; index < placement.columnEnd; index += 1) {
      const dayId = dayIds[index]

      if (!dayId) {
        continue
      }

      hiddenEventsByDay.get(dayId)?.push(placement.event)
    }
  }

  return hiddenEventsByDay
}

function doesMonthEventConflictOnDay(event: MonthCalendarEvent, dayIso: string) {
  return event.extendedProps.conflictDayIds.includes(dayIso)
}

function getMonthWeekConflictDays(placements: MonthWeekPlacement[], weekDays: Date[]) {
  const dayIds = weekDays.map((day) => formatWeekDayIso(day))
  const hasConflictByDay = new Map(dayIds.map((dayId) => [dayId, false]))

  for (const placement of placements) {
    for (let index = placement.columnStart - 1; index < placement.columnEnd; index += 1) {
      const dayId = dayIds[index]

      if (!dayId || !doesMonthEventConflictOnDay(placement.event, dayId)) {
        continue
      }

      hasConflictByDay.set(dayId, true)
    }
  }

  return hasConflictByDay
}

const monthLabels = Array.from({ length: 12 }, (_, index) =>
  new Intl.DateTimeFormat('en-US', { month: 'short' }).format(
    new Date(Date.UTC(2026, index, 1))
  )
)

function formatEventTimeValue(value: string | null) {
  if (!value) {
    return null
  }

  const [hours, minutes] = value.split(':').map(Number)

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return value
  }

  const parsedDate = new Date()
  parsedDate.setHours(hours, minutes, 0, 0)

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(parsedDate)
}

function formatWeekCardTimeRange(event: WeekCalendarEvent) {
  const startTime = formatEventTimeValue(event.extendedProps.startTime)
  const endTime = formatEventTimeValue(event.extendedProps.endTime)

  if (startTime && endTime) {
    return `${startTime} → ${endTime}`
  }

  if (startTime) {
    return `Starts ${startTime}`
  }

  if (endTime) {
    return `Ends ${endTime}`
  }

  return 'Time TBD'
}

function isEventWithinWeek(event: WeekCalendarEvent, weekStartIso: string, weekEndIso: string) {
  const { startDate, endDate } = getEventDateRange(event)

  if (!startDate) {
    return false
  }

  return startDate <= weekEndIso && endDate >= weekStartIso
}

type WeekEventPlacement = {
  event: WeekCalendarEvent
  columnStart: number
  columnEnd: number
  row: number
}

function getWeekEventPlacements(events: WeekCalendarEvent[], weekDays: Date[]) {
  if (weekDays.length === 0) {
    return []
  }

  const weekDayIds = weekDays.map((day) => formatWeekDayIso(day))
  const weekStartIso = weekDayIds[0] ?? ''
  const weekEndIso = weekDayIds[6] ?? weekStartIso
  const dayIndexByIso = new Map(weekDayIds.map((dayIso, index) => [dayIso, index]))

  const weekEvents = events
    .filter((event) => isEventWithinWeek(event, weekStartIso, weekEndIso))
    .map((event) => {
      const { startDate, endDate } = getEventDateRange(event)
      const visibleStartDate = startDate < weekStartIso ? weekStartIso : startDate
      const visibleEndDate = endDate > weekEndIso ? weekEndIso : endDate

      return {
        event,
        startDate,
        endDate,
        visibleStartDate,
        visibleEndDate,
        columnStart: (dayIndexByIso.get(visibleStartDate) ?? 0) + 1,
        columnEnd: (dayIndexByIso.get(visibleEndDate) ?? 0) + 1,
        sortTime: event.extendedProps.startTime ?? '00:00',
      }
    })
    .sort((left, right) => {
      if (left.startDate !== right.startDate) {
        return left.startDate.localeCompare(right.startDate)
      }

      if (left.sortTime !== right.sortTime) {
        return left.sortTime.localeCompare(right.sortTime)
      }

      if (left.endDate !== right.endDate) {
        return left.endDate.localeCompare(right.endDate)
      }

      return left.event.extendedProps.tripSheetTitle.localeCompare(
        right.event.extendedProps.tripSheetTitle
      )
    })

  const rowSpans: Array<Array<{ start: number; end: number }>> = []

  return weekEvents.map((weekEvent) => {
    let row = rowSpans.findIndex((spans) =>
      spans.every(
        (span) =>
          weekEvent.columnEnd < span.start || weekEvent.columnStart > span.end
      )
    )

    if (row === -1) {
      row = rowSpans.length
      rowSpans.push([])
    }

    rowSpans[row]?.push({
      start: weekEvent.columnStart,
      end: weekEvent.columnEnd,
    })

    return {
      event: weekEvent.event,
      columnStart: weekEvent.columnStart,
      columnEnd: weekEvent.columnEnd,
      row: row + 1,
    } satisfies WeekEventPlacement
  })
}

export default function TripSheetCalendar({
  monthEvents,
  weekEvents,
  availableResources,
  initialViewMode,
  initialDateValue,
  initialSelectedWeekEventId,
  title,
  subtitle,
}: TripSheetCalendarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const monthTriggerRef = useRef<HTMLButtonElement | null>(null)
  const initialDate = parseInitialCalendarDate(initialDateValue)
  const [viewMode, setViewMode] = useState<'month' | 'week'>(initialViewMode)
  const [currentDate, setCurrentDate] = useState(initialDate)
  const [selectedTripSheetId, setSelectedTripSheetId] = useState(
    initialViewMode === 'week' ? initialSelectedWeekEventId : ''
  )
  const [isDrawerOpen, setIsDrawerOpen] = useState(
    initialViewMode === 'week' && initialSelectedWeekEventId !== ''
  )
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false)
  const [pickerYear, setPickerYear] = useState(initialDate.getFullYear())
  const [monthPickerPosition, setMonthPickerPosition] = useState({
    top: 0,
    left: 0,
    width: 280,
  })
  const [monthOverflowPopover, setMonthOverflowPopover] =
    useState<MonthOverflowPopoverState | null>(null)

  function updateMonthPickerPosition() {
    const trigger = monthTriggerRef.current

    if (!trigger) {
      return
    }

    const rect = trigger.getBoundingClientRect()
    const width = Math.max(rect.width, 280)
    const left = Math.min(
      Math.max(12, rect.right - width),
      window.innerWidth - width - 12
    )
    const top = Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - 280))

    setMonthPickerPosition({ top, left, width })
  }

  useEffect(() => {
    if (!isMonthPickerOpen) {
      return
    }

    window.requestAnimationFrame(updateMonthPickerPosition)

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMonthPickerOpen(false)
      }
    }

    function handleViewportChange() {
      updateMonthPickerPosition()
    }

    window.addEventListener('keydown', handleEscape)
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)

    return () => {
      window.removeEventListener('keydown', handleEscape)
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [isMonthPickerOpen])

  useEffect(() => {
    if (!monthOverflowPopover) {
      return
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMonthOverflowPopover(null)
      }
    }

    function handleViewportChange() {
      setMonthOverflowPopover(null)
    }

    window.addEventListener('keydown', handleEscape)
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)

    return () => {
      window.removeEventListener('keydown', handleEscape)
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [monthOverflowPopover])

  const currentMonthDate = getMonthStart(currentDate)
  const currentMonthLabel = formatMonthLabel(currentMonthDate)
  const currentMonthValue = formatMonthValue(currentMonthDate)
  const currentDisplayedYear = Number(currentMonthValue.slice(0, 4))
  const currentDisplayedMonthIndex = Number(currentMonthValue.slice(5, 7)) - 1
  const monthGridStart = getMonthGridStart(currentMonthDate)
  const monthWeeks = Array.from({ length: 6 }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) =>
      addDays(monthGridStart, weekIndex * 7 + dayIndex)
    )
  )
  const weekStart = getWeekStart(currentDate)
  const weekStartIso = formatWeekDayIso(weekStart)
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  const todayIso = formatWeekDayIso(new Date())
  const weekEventPlacements = getWeekEventPlacements(weekEvents, weekDays)
  const weekRowCount = Math.max(
    4,
    weekEventPlacements.reduce(
      (maxValue, placement) => Math.max(maxValue, placement.row),
      0
    )
  )
  const resolvedSelectedWeekEvent =
    viewMode === 'week' && selectedTripSheetId
      ? weekEvents.find((event) => String(event.id) === selectedTripSheetId) ?? null
      : null
  const resolvedSelectedWeekEventId = resolvedSelectedWeekEvent
    ? String(resolvedSelectedWeekEvent.id)
    : ''
  const weekReturnPath = (() => {
    const params = new URLSearchParams()

    params.set('view', 'week')
    params.set('date', weekStartIso)

    if (resolvedSelectedWeekEventId) {
      params.set('tripSheetId', resolvedSelectedWeekEventId)
    }

    return `${pathname}?${params.toString()}`
  })()

  function handlePrevious() {
    if (viewMode === 'month') {
      setMonthOverflowPopover(null)
      setCurrentDate((currentValue) => addMonths(currentValue, -1))
      return
    }

    setSelectedTripSheetId('')
    setIsDrawerOpen(false)
    setCurrentDate((currentValue) => addDays(currentValue, -7))
  }

  function handleNext() {
    if (viewMode === 'month') {
      setMonthOverflowPopover(null)
      setCurrentDate((currentValue) => addMonths(currentValue, 1))
      return
    }

    setSelectedTripSheetId('')
    setIsDrawerOpen(false)
    setCurrentDate((currentValue) => addDays(currentValue, 7))
  }

  function handleToday() {
    if (viewMode === 'month') {
      setMonthOverflowPopover(null)
      setCurrentDate(new Date())
      return
    }

    setSelectedTripSheetId('')
    setIsDrawerOpen(false)
    setCurrentDate(new Date())
  }

  function handleMonthSelection(monthIndex: number) {
    setCurrentDate(new Date(pickerYear, monthIndex, 1))
    setIsMonthPickerOpen(false)
    setMonthOverflowPopover(null)
  }

  function handleViewModeChange(nextViewMode: 'month' | 'week') {
    if (nextViewMode === viewMode) {
      return
    }

    setIsMonthPickerOpen(false)
    setMonthOverflowPopover(null)
    if (nextViewMode === 'month') {
      setSelectedTripSheetId('')
      setIsDrawerOpen(false)
    }
    setViewMode(nextViewMode)
  }

  function handleMonthDayCellClick(day: Date) {
    setIsMonthPickerOpen(false)
    setMonthOverflowPopover(null)
    setSelectedTripSheetId('')
    setIsDrawerOpen(false)
    setCurrentDate(day)
    setViewMode('week')
  }

  function handleMonthWeekBackgroundClick(
    event: React.MouseEvent<HTMLElement>,
    weekDaysInRow: Date[]
  ) {
    const clickTarget = event.target as HTMLElement | null

    if (clickTarget?.closest('button')) {
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    const relativeX = event.clientX - rect.left
    const columnWidth = rect.width / 7
    const columnIndex = Math.min(
      6,
      Math.max(0, Math.floor(relativeX / Math.max(columnWidth, 1)))
    )
    const selectedDay = weekDaysInRow[columnIndex]

    if (!selectedDay) {
      return
    }

    handleMonthDayCellClick(selectedDay)
  }

  function handleMonthOverflowOpen(
    event: ReactMouseEvent<HTMLButtonElement>,
    day: Date,
    items: MonthCalendarEvent[]
  ) {
    const dayIso = formatWeekDayIso(day)

    if (monthOverflowPopover?.dayIso === dayIso) {
      setMonthOverflowPopover(null)
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    const width = Math.min(320, Math.max(220, rect.width + 80))
    const estimatedHeight = Math.min(320, 48 + items.length * 42)
    const showAbove =
      rect.bottom + 8 + estimatedHeight > window.innerHeight - 12 &&
      rect.top - 8 - estimatedHeight >= 12
    const top = showAbove
      ? Math.max(12, rect.top - estimatedHeight - 8)
      : Math.min(rect.bottom + 8, window.innerHeight - estimatedHeight - 12)
    const left = Math.min(
      Math.max(12, rect.left),
      window.innerWidth - width - 12
    )

    setIsMonthPickerOpen(false)
    setMonthOverflowPopover({
      dayIso,
      dayLabel: `${formatWeekDayLabel(day)}, ${formatWeekDayDate(day)}`,
      items,
      top,
      left,
      width,
    })
  }

  return (
    <div className="trip-sheet-calendar">
      <div className="app-page-header trip-calendar-header">
        <div className="trip-calendar-header-copy">
          <h1 className="app-page-title">{title}</h1>
          <p className="app-page-subtitle">{subtitle}</p>
        </div>

        <div className="trip-calendar-toolbar">
          <div className="trip-calendar-toolbar-row">
            <div className="trip-calendar-view-toggle" role="tablist" aria-label="Calendar view">
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'month'}
                className={`trip-calendar-view-button${
                  viewMode === 'month' ? ' trip-calendar-view-button--active' : ''
                }`}
                onClick={() => handleViewModeChange('month')}
              >
                Month
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'week'}
                className={`trip-calendar-view-button${
                  viewMode === 'week' ? ' trip-calendar-view-button--active' : ''
                }`}
                onClick={() => handleViewModeChange('week')}
              >
                Week
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrevious}
              className="trip-calendar-nav-button"
              aria-label={viewMode === 'month' ? 'Previous month' : 'Previous week'}
            >
              &lt;
            </button>

            {viewMode === 'month' ? (
              <div className="trip-calendar-month-picker">
                <button
                  ref={monthTriggerRef}
                  type="button"
                  onClick={() => {
                    setMonthOverflowPopover(null)
                    setPickerYear(currentDisplayedYear)
                    setIsMonthPickerOpen((currentValue) => !currentValue)
                  }}
                  className="trip-calendar-month-trigger"
                  aria-haspopup="dialog"
                  aria-expanded={isMonthPickerOpen}
                >
                  <span>{currentMonthLabel}</span>
                  <span className="trip-calendar-month-trigger-icon" aria-hidden="true">
                    v
                  </span>
                </button>
              </div>
            ) : (
              <div className="trip-calendar-week-label" aria-live="polite">
                {formatWeekRangeLabel(currentDate)}
              </div>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="trip-calendar-nav-button"
              aria-label={viewMode === 'month' ? 'Next month' : 'Next week'}
            >
              &gt;
            </button>

            <button
              type="button"
              onClick={handleToday}
              className="trip-calendar-today-button"
            >
              Today
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'month' ? (
        <div className="trip-calendar-grid-shell trip-calendar-month-shell">
          <div className="trip-calendar-month-header-row" role="row">
            {weekDays.map((day) => (
              <div key={`month-header-${formatWeekDayIso(day)}`} className="trip-calendar-month-header-cell">
                {formatWeekDayLabel(day)}
              </div>
            ))}
          </div>

          <div className="trip-calendar-month-board">
            {monthWeeks.map((weekDaysInRow, weekIndex) => {
              const placements = getMonthWeekPlacements(monthEvents, weekDaysInRow)
              const visiblePlacements = placements.filter((placement) => placement.row <= 2)
              const hiddenCountByDay = getMonthWeekHiddenCounts(placements, weekDaysInRow)
              const hiddenEventsByDay = getMonthWeekHiddenEventsByDay(
                placements,
                weekDaysInRow
              )
              const hasConflictByDay = getMonthWeekConflictDays(placements, weekDaysInRow)

              return (
                <section
                  key={`month-week-${weekIndex}-${formatWeekDayIso(weekDaysInRow[0] ?? currentMonthDate)}`}
                  className="trip-calendar-month-week"
                  onClick={(event) => handleMonthWeekBackgroundClick(event, weekDaysInRow)}
                >
                  {weekDaysInRow.map((day, dayIndex) => {
                    const dayIso = formatWeekDayIso(day)
                    const isToday = dayIso === todayIso
                    const hasConflict = hasConflictByDay.get(dayIso) ?? false
                    const isCurrentMonth =
                      day.getMonth() === currentMonthDate.getMonth() &&
                      day.getFullYear() === currentMonthDate.getFullYear()

                    return (
                      <div
                        key={`${dayIso}-background`}
                        className={`trip-calendar-month-day-cell${
                          isToday ? ' trip-calendar-month-day-cell--today' : ''
                        }${
                          isCurrentMonth ? '' : ' trip-calendar-month-day-cell--outside'
                        }${
                          dayIndex === 6 ? ' trip-calendar-month-day-cell--last' : ''
                        }`}
                        style={{
                          gridColumn: dayIndex + 1,
                          gridRow: '1 / 5',
                        }}
                      >
                        <div className="trip-calendar-month-day-top">
                          <span
                            className={`trip-calendar-month-day-number${
                              isToday ? ' trip-calendar-month-day-number--today' : ''
                            }`}
                          >
                            {day.getDate()}
                          </span>
                          {hasConflict ? (
                            <span
                              aria-hidden="true"
                              className="trip-calendar-month-day-conflict-dot"
                            />
                          ) : null}
                        </div>
                      </div>
                    )
                  })}

                  {weekDaysInRow.map((day, dayIndex) => {
                    const dayIso = formatWeekDayIso(day)
                    const hiddenCount = hiddenCountByDay.get(dayIso) ?? 0
                    const hiddenItems = hiddenEventsByDay.get(dayIso) ?? []
                    const hiddenHasConflict = hiddenItems.some((item) =>
                      doesMonthEventConflictOnDay(item, dayIso)
                    )

                    if (hiddenCount === 0 || hiddenItems.length === 0) {
                      return null
                    }

                    return (
                      <button
                        key={`${dayIso}-more`}
                        type="button"
                        className="trip-calendar-month-more"
                        style={{
                          gridColumn: dayIndex + 1,
                          gridRow: 4,
                        }}
                        aria-haspopup="dialog"
                        aria-expanded={monthOverflowPopover?.dayIso === dayIso}
                        onClick={(clickEvent) =>
                          handleMonthOverflowOpen(clickEvent, day, hiddenItems)
                        }
                      >
                        +{hiddenCount} more{hiddenHasConflict ? ' ⚠' : ''}
                      </button>
                    )
                  })}

                  {visiblePlacements.map((placement) => {
                    const extendedProps = placement.event.extendedProps as MonthCalendarEvent['extendedProps']

                    return (
                      <button
                        key={`month-${String(placement.event.id)}-${weekIndex}`}
                        type="button"
                        className={`trip-calendar-month-bar${
                          extendedProps.isArchived ? ' trip-calendar-month-bar--archived' : ''
                        }`}
                        style={{
                          gridColumn: `${placement.columnStart} / ${placement.columnEnd + 1}`,
                          gridRow: placement.row + 1,
                          backgroundColor: String(placement.event.backgroundColor || '#f4f8f5'),
                          borderColor: String(placement.event.borderColor || '#cfe0d4'),
                          color: extendedProps.textColor,
                        }}
                        onClick={() => {
                          if (placement.event.url) {
                            router.push(String(placement.event.url))
                          }
                        }}
                      >
                        <span className="trip-calendar-event-title">
                          {placement.event.title}
                        </span>
                      </button>
                    )
                  })}
                </section>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="trip-calendar-week-shell">
          <div className="trip-calendar-week-grid trip-calendar-week-grid--header">
            {weekDays.map((day) => {
              const dayIso = formatWeekDayIso(day)
              const isToday = dayIso === todayIso

              return (
                <section
                  key={dayIso}
                  className={`trip-calendar-week-day${
                    isToday ? ' trip-calendar-week-day--today' : ''
                  }`}
                >
                  <header className="trip-calendar-week-day-header">
                    <p className="trip-calendar-week-day-label">{formatWeekDayLabel(day)}</p>
                    <p className="trip-calendar-week-day-date">{formatWeekDayDate(day)}</p>
                  </header>

                </section>
              )
            })}
          </div>

          <div
            className="trip-calendar-week-board"
            style={{
              gridTemplateRows: `repeat(${weekRowCount}, minmax(5.85rem, auto))`,
            }}
          >
            {Array.from({ length: weekRowCount }).flatMap((_, rowIndex) =>
              weekDays.map((day) => {
                const dayIso = formatWeekDayIso(day)
                const isToday = dayIso === todayIso

                return (
                  <div
                    key={`${dayIso}-${rowIndex}`}
                    className={`trip-calendar-week-cell${
                      isToday ? ' trip-calendar-week-cell--today' : ''
                    }`}
                    style={{
                      gridColumn: weekDays.indexOf(day) + 1,
                      gridRow: rowIndex + 1,
                    }}
                  />
                )
              })
            )}

            {weekEventPlacements.length === 0 ? (
              <div className="trip-calendar-week-empty" style={{ gridColumn: '1 / -1', gridRow: 1 }}>
                No trip sheets this week.
              </div>
            ) : null}

            {weekEventPlacements.map((placement) => {
              const { event, columnStart, columnEnd, row } = placement
              const colors = {
                text: event.extendedProps.textColor,
                muted: event.extendedProps.mutedColor,
                faint: event.extendedProps.faintColor,
                warning: event.extendedProps.warningColor,
              }

              return (
                <div
                  key={`week-${String(event.id)}`}
                  className="trip-calendar-week-card-slot"
                  style={{
                    gridColumn: `${columnStart} / ${columnEnd + 1}`,
                    gridRow: row,
                  }}
                >
                  <button
                    type="button"
                    className={`trip-calendar-week-card${
                      event.extendedProps.isArchived ? ' trip-calendar-week-card--archived' : ''
                    }${
                      event.extendedProps.hasConflict
                        ? ' trip-calendar-week-card--conflict'
                        : ''
                    }`}
                    style={{
                      backgroundColor: String(event.backgroundColor || '#f4f8f5'),
                      borderColor: String(event.borderColor || '#cfe0d4'),
                      color: colors.text,
                    }}
                    onClick={() => {
                      setSelectedTripSheetId(String(event.id))
                      setIsDrawerOpen(true)
                    }}
                  >
                    {event.extendedProps.hasConflict ? (
                      <span
                        aria-hidden="true"
                        className="trip-calendar-week-card-conflict-dot"
                      />
                    ) : null}
                    <div className="trip-calendar-week-card-title">
                      {event.extendedProps.tripSheetTitle}
                    </div>
                    <div
                      className={`trip-calendar-week-card-assignment${
                        event.extendedProps.isUnassigned
                          ? ' trip-calendar-week-card-assignment--unassigned'
                          : ''
                      }`}
                      style={{
                        color: event.extendedProps.isUnassigned
                          ? colors.warning
                          : colors.muted,
                      }}
                    >
                      {event.extendedProps.assignedLabel}
                    </div>
                    <div className="trip-calendar-week-card-time" style={{ color: colors.faint }}>
                      {formatWeekCardTimeRange(event)}
                    </div>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {viewMode === 'month' && isMonthPickerOpen && typeof document !== 'undefined'
        ? createPortal(
            <>
              <button
                type="button"
                aria-label="Close month picker"
                className="trip-calendar-month-backdrop"
                onClick={() => setIsMonthPickerOpen(false)}
              />

              <div
                className="trip-calendar-month-dropdown"
                role="dialog"
                aria-label="Choose month"
                style={{
                  top: `${monthPickerPosition.top}px`,
                  left: `${monthPickerPosition.left}px`,
                  width: `${monthPickerPosition.width}px`,
                }}
              >
                <div className="trip-calendar-month-dropdown-header">
                  <button
                    type="button"
                    className="trip-calendar-month-year-button"
                    aria-label="Previous year"
                    onClick={() => setPickerYear((currentValue) => currentValue - 1)}
                  >
                    &lt;
                  </button>

                  <div className="trip-calendar-month-year-label">{pickerYear}</div>

                  <button
                    type="button"
                    className="trip-calendar-month-year-button"
                    aria-label="Next year"
                    onClick={() => setPickerYear((currentValue) => currentValue + 1)}
                  >
                    &gt;
                  </button>
                </div>

                <div className="trip-calendar-month-grid-panel">
                  <div className="trip-calendar-month-grid">
                    {monthLabels.map((monthLabel, monthIndex) => {
                      const isActive =
                        pickerYear === currentDisplayedYear &&
                        monthIndex === currentDisplayedMonthIndex

                      return (
                        <button
                          key={monthLabel}
                          type="button"
                          className={`trip-calendar-month-option${
                            isActive ? ' trip-calendar-month-option--active' : ''
                          }`}
                          onClick={() => handleMonthSelection(monthIndex)}
                        >
                          {monthLabel}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </>,
            document.body
          )
        : null}

      {viewMode === 'month' && monthOverflowPopover && typeof document !== 'undefined'
        ? createPortal(
            <>
              <div
                aria-hidden="true"
                role="presentation"
                className="trip-calendar-month-backdrop"
                onClick={() => setMonthOverflowPopover(null)}
              />

              <div
                className="trip-calendar-month-overflow-popover"
                role="dialog"
                aria-label={`Hidden trips for ${monthOverflowPopover.dayLabel}`}
                style={{
                  top: `${monthOverflowPopover.top}px`,
                  left: `${monthOverflowPopover.left}px`,
                  width: `${monthOverflowPopover.width}px`,
                }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="trip-calendar-month-overflow-header">
                  <p className="trip-calendar-month-overflow-title">
                    {monthOverflowPopover.dayLabel}
                  </p>
                </div>

                <div className="trip-calendar-month-overflow-list">
                  {monthOverflowPopover.items.map((item) => (
                    <button
                      key={`month-overflow-${monthOverflowPopover.dayIso}-${String(item.id)}`}
                      type="button"
                      className="trip-calendar-month-overflow-item"
                      onClick={() => {
                        setMonthOverflowPopover(null)

                        if (item.url) {
                          router.push(String(item.url))
                        }
                      }}
                    >
                      <span
                        className="trip-calendar-month-overflow-swatch"
                        style={{
                          backgroundColor: String(item.backgroundColor || '#f5f7fa'),
                          borderColor: String(item.borderColor || '#d7dde5'),
                        }}
                        aria-hidden="true"
                      />
                      <span className="trip-calendar-month-overflow-item-title">
                        {item.title}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>,
            document.body
          )
        : null}

      <WeeklyTripSheetDrawer
        key={resolvedSelectedWeekEventId || 'weekly-trip-sheet-drawer'}
        isOpen={viewMode === 'week' && isDrawerOpen && resolvedSelectedWeekEvent !== null}
        onClose={() => {
          setIsDrawerOpen(false)
          setSelectedTripSheetId('')
        }}
        tripSheet={
          resolvedSelectedWeekEvent
            ? {
                id: String(resolvedSelectedWeekEvent.id),
                tripSheetTitle: resolvedSelectedWeekEvent.extendedProps.tripSheetTitle,
                parentTripTitle: resolvedSelectedWeekEvent.extendedProps.parentTripTitle,
                startDate: resolvedSelectedWeekEvent.extendedProps.startDate,
                startTime: resolvedSelectedWeekEvent.extendedProps.startTime,
                endDate: resolvedSelectedWeekEvent.extendedProps.endDate,
                endTime: resolvedSelectedWeekEvent.extendedProps.endTime,
                assignedResources: resolvedSelectedWeekEvent.extendedProps.assignedResources,
              }
            : null
        }
        availableResources={availableResources}
        returnPath={weekReturnPath}
      />
    </div>
  )
}
