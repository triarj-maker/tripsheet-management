'use client'

import { Fragment, useId, useState } from 'react'
import Link from 'next/link'
import type { ResourceScheduleTrip } from '@/lib/resource-assignment-schedule'
import { formatTimeValue, parseDateTimeInAppTimeZoneToComparableTimestamp } from '@/lib/time'

function dateTime(date: string | null, time: string | null = null) {
  const timestamp = parseDateTimeInAppTimeZoneToComparableTimestamp(date, null)
  const label = timestamp === null ? 'Date TBD' : new Intl.DateTimeFormat('en-US', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(timestamp))
  return time ? `${label}, ${formatTimeValue(time)}` : label
}

export default function ResourceScheduleRows({ trips }: { trips: ResourceScheduleTrip[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const prefix = useId()
  return (
    <tbody>
      {trips.map(trip => {
        const open = expanded.has(trip.tripId)
        const detailsId = `${prefix}-${trip.tripId}`
        return (
          <Fragment key={trip.tripId}>
            <tr>
              <td className="px-3 py-3 align-top">
                <div>{dateTime(trip.assignedStartDate)}</div>
                <div className="text-gray-500">to {dateTime(trip.assignedEndDate)}</div>
              </td>
              <td className="break-words px-3 py-3 align-top">
                <div className="font-medium">{trip.customer}</div>
                <div className="text-gray-500">{trip.tripTitle}</div>
              </td>
              <td className="break-words px-3 py-3 align-top">{trip.destination}</td>
              <td className="px-3 py-3 align-top">
                <button type="button" className="ui-button ui-button-secondary"
                  aria-expanded={open} aria-controls={detailsId}
                  aria-label={`${open ? 'Hide' : 'Show'} ${trip.sessionCount} assigned sessions for ${trip.tripTitle}`}
                  onClick={() => setExpanded(previous => {
                    const next = new Set(previous)
                    if (next.has(trip.tripId)) next.delete(trip.tripId)
                    else next.add(trip.tripId)
                    return next
                  })}>
                  {trip.sessionCount} <span aria-hidden="true" className="ml-2">{open ? '−' : '+'}</span>
                </button>
              </td>
            </tr>
            <tr hidden={!open} id={detailsId}>
              <td colSpan={4} className="bg-gray-50 px-3 py-3">
                <p className="mb-2 text-xs text-gray-500">Parent Trip dates: {dateTime(trip.tripStartDate)} to {dateTime(trip.tripEndDate)}. Assigned sessions for this filter:</p>
                <ul className="space-y-3">
                  {trip.sessions.map(session => (
                    <li key={session.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                      <Link href={`/trip-sheets/${session.id}`} className="font-medium text-emerald-800 underline underline-offset-2">{session.title}</Link>
                      <span>{dateTime(session.startDate, session.startTime)} to {dateTime(session.endDate ?? session.startDate, session.endTime)}</span>
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          </Fragment>
        )
      })}
    </tbody>
  )
}
