'use client'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import type { EventClickArg, EventContentArg, EventInput } from '@fullcalendar/core'
import { useRouter } from 'next/navigation'

type CalendarEvent = EventInput & {
  extendedProps: {
    destination: string
    guestName: string
    assignedLabel: string
    isUnassigned: boolean
  }
}

type TripSheetCalendarProps = {
  events: CalendarEvent[]
}

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
      muted: 'rgba(255, 255, 255, 0.84)',
    }
  }

  const luminance =
    (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255

  if (luminance > 0.6) {
    return {
      text: '#111827',
      muted: '#374151',
    }
  }

  return {
    text: '#ffffff',
    muted: 'rgba(255, 255, 255, 0.84)',
  }
}

function renderEventContent(eventInfo: EventContentArg) {
  const extendedProps = eventInfo.event.extendedProps as CalendarEvent['extendedProps']
  const colors = getReadableTextColors(eventInfo.backgroundColor || '#18181b')
  const details = [extendedProps.destination, extendedProps.guestName].join(' · ')

  return (
    <div className="trip-calendar-event" style={{ color: colors.text }}>
      <div className="trip-calendar-event-title">{eventInfo.event.title}</div>
      <div className="trip-calendar-event-context" style={{ color: colors.muted }}>
        {details}
      </div>
      {extendedProps.isUnassigned ? (
        <span className="trip-calendar-event-status">Unassigned</span>
      ) : (
        <div className="trip-calendar-event-assignment" style={{ color: colors.muted }}>
          {extendedProps.assignedLabel}
        </div>
      )}
    </div>
  )
}

export default function TripSheetCalendar({ events }: TripSheetCalendarProps) {
  const router = useRouter()

  function handleEventClick(eventInfo: EventClickArg) {
    if (eventInfo.event.url) {
      eventInfo.jsEvent.preventDefault()
      router.push(eventInfo.event.url)
    }
  }

  return (
    <div className="trip-sheet-calendar">
      <FullCalendar
        plugins={[dayGridPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: '',
        }}
        height="auto"
        events={events}
        displayEventTime={false}
        eventDisplay="block"
        dayMaxEventRows={3}
        eventContent={renderEventContent}
        eventClick={handleEventClick}
      />
    </div>
  )
}
