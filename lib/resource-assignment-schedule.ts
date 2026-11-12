import {
  getCurrentComparableTimestampInAppTimeZone,
  parseDateTimeInAppTimeZoneToComparableTimestamp,
} from '@/lib/time'

export type ScheduleFilter = 'upcoming' | 'past' | 'all'

export type ResourceScheduleEntry = {
  id: string
  title: string
  startDate: string | null
  startTime: string | null
  endDate: string | null
  endTime: string | null
  tripId: string
  tripStartDate: string | null
  tripEndDate: string | null
  tripTitle: string
  customer: string
  destination: string
}

export function parseScheduleFilter(value: string | string[] | undefined): ScheduleFilter {
  return value === 'past' || value === 'all' ? value : 'upcoming'
}

export function selectScheduleEntries(
  entries: ResourceScheduleEntry[],
  filter: ScheduleFilter,
  now = getCurrentComparableTimestampInAppTimeZone()
) {
  const start = (entry: ResourceScheduleEntry) =>
    parseDateTimeInAppTimeZoneToComparableTimestamp(entry.startDate, entry.startTime)
  const end = (entry: ResourceScheduleEntry) => {
    const timestamp = parseDateTimeInAppTimeZoneToComparableTimestamp(entry.endDate ?? entry.startDate, entry.endTime, true)
    // The shared helper's end-of-day fallback is 23:59:00; include its final minute.
    return timestamp === null ? null : timestamp + (entry.endTime ? 0 : 59_999)
  }
  const ongoing = (entry: ResourceScheduleEntry) =>
    start(entry) !== null && start(entry)! <= now && end(entry) !== null && end(entry)! >= now

  return entries.filter(entry => {
    const endTimestamp = end(entry)
    // Undated assignments remain visible under Upcoming and All until scheduled.
    return filter === 'all' || (filter === 'past'
      ? endTimestamp !== null && endTimestamp < now
      : endTimestamp === null || endTimestamp >= now)
  }).sort((left, right) => {
    if (filter === 'upcoming' && ongoing(left) !== ongoing(right)) {
      return ongoing(left) ? -1 : 1
    }
    const order = filter === 'past'
      ? (end(right) ?? 0) - (end(left) ?? 0)
      : (start(left) ?? Number.MAX_SAFE_INTEGER) - (start(right) ?? Number.MAX_SAFE_INTEGER)
    return order || left.title.localeCompare(right.title) || left.id.localeCompare(right.id)
  })
}

export type ResourceScheduleTrip = {
  tripId: string
  tripTitle: string
  tripStartDate: string | null
  tripEndDate: string | null
  customer: string
  destination: string
  assignedStartDate: string | null
  assignedEndDate: string | null
  sessionCount: number
  sessions: ResourceScheduleEntry[]
}

// Filter sessions first: a Trip can appear in both Past and Upcoming, each with
// only its eligible sessions. Map insertion order preserves the session ordering
// (ongoing first, latest completion for Past, earliest start for All).
export function selectScheduleTrips(
  entries: ResourceScheduleEntry[],
  filter: ScheduleFilter,
  now = getCurrentComparableTimestampInAppTimeZone()
): ResourceScheduleTrip[] {
  const groups = new Map<string, ResourceScheduleTrip>()
  for (const entry of selectScheduleEntries(entries, filter, now)) {
    let group = groups.get(entry.tripId)
    if (!group) {
      group = {
        tripId: entry.tripId, tripTitle: entry.tripTitle,
        tripStartDate: entry.tripStartDate, tripEndDate: entry.tripEndDate,
        customer: entry.customer, destination: entry.destination,
        assignedStartDate: null, assignedEndDate: null, sessionCount: 0, sessions: [],
      }
      groups.set(entry.tripId, group)
    }
    if (group.sessions.some(session => session.id === entry.id)) continue
    group.sessions.push(entry)
    group.sessionCount += 1
    if (entry.startDate && (!group.assignedStartDate || entry.startDate < group.assignedStartDate)) {
      group.assignedStartDate = entry.startDate
    }
    const endDate = entry.endDate ?? entry.startDate
    if (endDate && (!group.assignedEndDate || endDate > group.assignedEndDate)) {
      group.assignedEndDate = endDate
    }
  }
  return [...groups.values()]
}
