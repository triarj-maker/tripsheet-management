import {
  type DestinationRelation,
  getDestinationName,
  getTripParent,
} from '@/lib/trip-sheets'
import {
  getCurrentComparableTimestampInAppTimeZone,
  getCurrentDateStringInAppTimeZone,
  parseDateTimeInAppTimeZoneToComparableTimestamp,
} from '@/lib/time'

type AssignedTripParent = {
  id: string
  title: string | null
  start_date: string | null
  end_date: string | null
  destination_ref: DestinationRelation
}

export type AssignedTripSheetRow = {
  id: string
  trip_id: string | null
  title: string | null
  start_date: string | null
  start_time: string | null
  end_date: string | null
  end_time: string | null
  trip: AssignedTripParent | AssignedTripParent[] | null
}

export type AssignedTripNextActivity = {
  trip_sheet_id: string
  trip_sheet_title: string
  start_date: string | null
  start_time: string | null
  end_date: string | null
  end_time: string | null
  state: 'ongoing' | 'upcoming'
}

export type AssignedTripSummary = {
  id: string
  title: string | null
  destination: string | null
  start_date: string | null
  end_date: string | null
  assigned_trip_sheet_count: number
  status: 'ongoing' | 'upcoming'
  next_activity: AssignedTripNextActivity | null
}

function getTripStatus(
  startDate: string | null,
  endDate: string | null,
  today: string
): AssignedTripSummary['status'] | null {
  const resolvedStartDate = startDate ?? ''
  const resolvedEndDate = endDate ?? resolvedStartDate

  if (resolvedStartDate && resolvedEndDate && resolvedStartDate <= today && resolvedEndDate >= today) {
    return 'ongoing'
  }

  if (resolvedStartDate && resolvedStartDate > today) {
    return 'upcoming'
  }

  return null
}

function getNextActivity(
  tripSheets: AssignedTripSheetRow[],
  tripStatus: AssignedTripSummary['status']
) {
  const now = getCurrentComparableTimestampInAppTimeZone()
  const ongoingActivities = tripSheets
    .filter((tripSheet) => {
      const startTimestamp = parseDateTimeInAppTimeZoneToComparableTimestamp(
        tripSheet.start_date,
        tripSheet.start_time
      )
      const endTimestamp = parseDateTimeInAppTimeZoneToComparableTimestamp(
        tripSheet.end_date ?? tripSheet.start_date,
        tripSheet.end_time,
        true
      )

      if (startTimestamp === null || endTimestamp === null) {
        return false
      }

      return startTimestamp <= now && now <= endTimestamp
    })
    .sort((left, right) => {
      const leftStart =
        parseDateTimeInAppTimeZoneToComparableTimestamp(left.start_date, left.start_time) ??
        Number.MAX_SAFE_INTEGER
      const rightStart =
        parseDateTimeInAppTimeZoneToComparableTimestamp(right.start_date, right.start_time) ??
        Number.MAX_SAFE_INTEGER

      return leftStart - rightStart
    })

  const upcomingActivities = tripSheets
    .filter((tripSheet) => {
      const startTimestamp = parseDateTimeInAppTimeZoneToComparableTimestamp(
        tripSheet.start_date,
        tripSheet.start_time
      )

      if (startTimestamp === null) {
        return false
      }

      return startTimestamp > now
    })
    .sort((left, right) => {
      const leftStart =
        parseDateTimeInAppTimeZoneToComparableTimestamp(left.start_date, left.start_time) ??
        Number.MAX_SAFE_INTEGER
      const rightStart =
        parseDateTimeInAppTimeZoneToComparableTimestamp(right.start_date, right.start_time) ??
        Number.MAX_SAFE_INTEGER

      return leftStart - rightStart
    })

  const selectedTripSheet =
    tripStatus === 'ongoing'
      ? ongoingActivities[0] ?? upcomingActivities[0] ?? null
      : upcomingActivities[0] ?? null

  if (!selectedTripSheet) {
    return null
  }

  const selectedStartTimestamp = parseDateTimeInAppTimeZoneToComparableTimestamp(
    selectedTripSheet.start_date,
    selectedTripSheet.start_time
  )
  const selectedEndTimestamp = parseDateTimeInAppTimeZoneToComparableTimestamp(
    selectedTripSheet.end_date ?? selectedTripSheet.start_date,
    selectedTripSheet.end_time,
    true
  )

  return {
    trip_sheet_id: selectedTripSheet.id,
    trip_sheet_title: selectedTripSheet.title?.trim() || 'Untitled trip sheet',
    start_date: selectedTripSheet.start_date,
    start_time: selectedTripSheet.start_time,
    end_date: selectedTripSheet.end_date,
    end_time: selectedTripSheet.end_time,
    state:
      selectedStartTimestamp !== null &&
      selectedEndTimestamp !== null &&
      selectedStartTimestamp <= now &&
      now <= selectedEndTimestamp
        ? 'ongoing'
        : 'upcoming',
  } satisfies AssignedTripNextActivity
}

export function sortAssignedTrips(trips: AssignedTripSummary[]) {
  return [...trips].sort((left, right) => {
    if (left.status !== right.status) {
      return left.status === 'ongoing' ? -1 : 1
    }

    if (left.status === 'ongoing') {
      return (
        (right.start_date ?? '').localeCompare(left.start_date ?? '') ||
        (right.end_date ?? '').localeCompare(left.end_date ?? '') ||
        (left.title ?? '').localeCompare(right.title ?? '')
      )
    }

    return (
      (left.start_date ?? '').localeCompare(right.start_date ?? '') ||
      (left.end_date ?? '').localeCompare(right.end_date ?? '') ||
      (left.title ?? '').localeCompare(right.title ?? '')
    )
  })
}

export function buildAssignedTripSummaries(tripSheets: AssignedTripSheetRow[]) {
  const tripsById = new Map<
    string,
    {
      summary: Omit<AssignedTripSummary, 'status' | 'next_activity'>
      tripSheets: AssignedTripSheetRow[]
    }
  >()
  const today = getCurrentDateStringInAppTimeZone()

  for (const tripSheet of tripSheets) {
    const trip = getTripParent(tripSheet.trip)
    const tripId = trip?.id ?? tripSheet.trip_id ?? null

    if (!tripId) {
      continue
    }

    const existingTrip = tripsById.get(tripId)

    if (existingTrip) {
      existingTrip.summary.assigned_trip_sheet_count += 1
      existingTrip.tripSheets.push(tripSheet)
      continue
    }

    tripsById.set(tripId, {
      summary: {
        id: tripId,
        title: trip?.title ?? 'Untitled trip',
        destination:
          getDestinationName(trip?.destination_ref, 'Unknown destination') ??
          'Unknown destination',
        start_date: trip?.start_date ?? null,
        end_date: trip?.end_date ?? null,
        assigned_trip_sheet_count: 1,
      },
      tripSheets: [tripSheet],
    })
  }

  return Array.from(tripsById.values())
    .map(({ summary, tripSheets: relatedTripSheets }) => {
      const status = getTripStatus(summary.start_date, summary.end_date, today)

      if (!status) {
        return null
      }

      return {
        ...summary,
        status,
        next_activity: getNextActivity(relatedTripSheets, status),
      } satisfies AssignedTripSummary
    })
    .filter((trip): trip is AssignedTripSummary => trip !== null)
}
