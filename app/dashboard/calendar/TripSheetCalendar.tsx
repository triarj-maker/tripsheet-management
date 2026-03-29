'use client'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import type {
  DatesSetArg,
  EventClickArg,
  EventContentArg,
  EventInput,
} from '@fullcalendar/core'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'

export type CalendarEvent = EventInput & {
  extendedProps: {
    destination: string
    guestName: string
    assignedLabel: string
    isUnassigned: boolean
    isArchived: boolean
  }
}

type TripSheetCalendarProps = {
  events: CalendarEvent[]
  title: string
  subtitle: string
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function formatMonthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const monthLabels = Array.from({ length: 12 }, (_, index) =>
  new Intl.DateTimeFormat('en-US', { month: 'short' }).format(
    new Date(Date.UTC(2026, index, 1))
  )
)

function parseColor(color: string) {
  if (color.startsWith('#')) {
    const normalized =
      color.length === 4
        ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
        : color

    if (normalized.length === 7) {
      return {
        r: Number.parseInt(normalized.slice(1, 3), 16),
        g: Number.parseInt(normalized.slice(3, 5), 16),
        b: Number.parseInt(normalized.slice(5, 7), 16),
      }
    }
  }

  const rgbMatch = color.match(/\d+/g)

  if (rgbMatch && rgbMatch.length >= 3) {
    return {
      r: Number(rgbMatch[0]),
      g: Number(rgbMatch[1]),
      b: Number(rgbMatch[2]),
    }
  }

  return null
}

function getReadableTextColors(backgroundColor: string) {
  const rgb = parseColor(backgroundColor)

  if (!rgb) {
    return {
      text: '#ffffff',
      muted: 'rgba(255, 255, 255, 0.9)',
      faint: 'rgba(255, 255, 255, 0.78)',
    }
  }

  const luminance =
    (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255

  if (luminance > 0.6) {
    return {
      text: '#111827',
      muted: '#374151',
      faint: '#6b7280',
    }
  }

  return {
    text: '#ffffff',
    muted: 'rgba(255, 255, 255, 0.9)',
    faint: 'rgba(255, 255, 255, 0.78)',
  }
}

function renderEventContent(eventInfo: EventContentArg) {
  const extendedProps = eventInfo.event.extendedProps as CalendarEvent['extendedProps']
  const colors = extendedProps.isArchived
    ? {
        text: '#111827',
        muted: '#4b5563',
        faint: '#6b7280',
      }
    : getReadableTextColors(eventInfo.backgroundColor || '#18181b')

  return (
    <div
      className={`trip-calendar-event${
        extendedProps.isArchived ? ' trip-calendar-event--archived' : ''
      }`}
      style={{ color: colors.text }}
    >
      <div className="trip-calendar-event-title">{eventInfo.event.title}</div>
      <div
        className={`trip-calendar-event-assignment${
          extendedProps.isUnassigned ? ' trip-calendar-event-assignment--unassigned' : ''
        }`}
        style={{ color: colors.muted }}
      >
        {extendedProps.assignedLabel}
      </div>
    </div>
  )
}

export default function TripSheetCalendar({
  events,
  title,
  subtitle,
}: TripSheetCalendarProps) {
  const router = useRouter()
  const calendarRef = useRef<FullCalendar | null>(null)
  const monthTriggerRef = useRef<HTMLButtonElement | null>(null)
  const initialDate = new Date()
  const [currentMonthLabel, setCurrentMonthLabel] = useState(
    formatMonthLabel(initialDate)
  )
  const [currentMonthValue, setCurrentMonthValue] = useState(
    formatMonthValue(initialDate)
  )
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false)
  const [pickerYear, setPickerYear] = useState(initialDate.getFullYear())
  const [monthPickerPosition, setMonthPickerPosition] = useState({
    top: 0,
    left: 0,
    width: 280,
  })

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

  function updateCurrentMonth(date: Date) {
    setCurrentMonthLabel(formatMonthLabel(date))
    setCurrentMonthValue(formatMonthValue(date))
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

  function handleEventClick(eventInfo: EventClickArg) {
    if (eventInfo.event.url) {
      eventInfo.jsEvent.preventDefault()
      router.push(eventInfo.event.url)
    }
  }

  function handleDatesSet(dateInfo: DatesSetArg) {
    updateCurrentMonth(dateInfo.view.currentStart)

    if (isMonthPickerOpen) {
      setPickerYear(dateInfo.view.currentStart.getFullYear())
    }
  }

  function handlePreviousMonth() {
    calendarRef.current?.getApi().prev()
  }

  function handleNextMonth() {
    calendarRef.current?.getApi().next()
  }

  function handleToday() {
    calendarRef.current?.getApi().today()
  }

  function handleMonthSelection(monthIndex: number) {
    const nextValue = `${pickerYear}-${String(monthIndex + 1).padStart(2, '0')}-01`
    calendarRef.current?.getApi().gotoDate(nextValue)
    setIsMonthPickerOpen(false)
  }

  const currentDisplayedYear = Number(currentMonthValue.slice(0, 4))
  const currentDisplayedMonthIndex = Number(currentMonthValue.slice(5, 7)) - 1

  return (
    <div className="trip-sheet-calendar">
      <div className="app-page-header trip-calendar-header">
        <div className="trip-calendar-header-copy">
          <h1 className="app-page-title">{title}</h1>
          <p className="app-page-subtitle">{subtitle}</p>
        </div>

        <div className="trip-calendar-toolbar">
          <div className="trip-calendar-toolbar-row">
            <button
              type="button"
              onClick={handlePreviousMonth}
              className="trip-calendar-nav-button"
              aria-label="Previous month"
            >
              &lt;
            </button>

            <div className="trip-calendar-month-picker">
              <button
                ref={monthTriggerRef}
                type="button"
                onClick={() => {
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

            <button
              type="button"
              onClick={handleNextMonth}
              className="trip-calendar-nav-button"
              aria-label="Next month"
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

      <div className="trip-calendar-grid-shell">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin]}
          initialView="dayGridMonth"
          headerToolbar={false}
          firstDay={1}
          height="auto"
          fixedWeekCount
          events={events}
          displayEventTime={false}
          eventDisplay="block"
          dayMaxEvents={2}
          dayHeaderFormat={{ weekday: 'short' }}
          datesSet={handleDatesSet}
          eventContent={renderEventContent}
          eventClick={handleEventClick}
        />
      </div>

      {isMonthPickerOpen && typeof document !== 'undefined'
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
    </div>
  )
}
