import {
  type DestinationRelation,
  getDestinationName,
  getTripParent,
} from '@/lib/trip-sheets'

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
  trip: AssignedTripParent | AssignedTripParent[] | null
}

export type AssignedTripSummary = {
  id: string
  title: string | null
  destination: string | null
  start_date: string | null
  end_date: string | null
  assigned_trip_sheet_count: number
}

function getTodayDateString() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
  })

  return formatter.format(new Date())
}

function getTripSortGroup(trip: AssignedTripSummary, today: string) {
  const startDate = trip.start_date ?? ''
  const endDate = trip.end_date ?? startDate

  if (startDate && endDate && startDate <= today && endDate >= today) {
    return 0
  }

  if (startDate && startDate > today) {
    return 1
  }

  return 2
}

export function sortAssignedTrips(trips: AssignedTripSummary[]) {
  const today = getTodayDateString()

  return [...trips].sort((left, right) => {
    const leftGroup = getTripSortGroup(left, today)
    const rightGroup = getTripSortGroup(right, today)

    if (leftGroup !== rightGroup) {
      return leftGroup - rightGroup
    }

    if (leftGroup === 2) {
      return (
        (right.end_date ?? '').localeCompare(left.end_date ?? '') ||
        (right.start_date ?? '').localeCompare(left.start_date ?? '') ||
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
  const tripsById = new Map<string, AssignedTripSummary>()

  for (const tripSheet of tripSheets) {
    const trip = getTripParent(tripSheet.trip)
    const tripId = trip?.id ?? tripSheet.trip_id ?? null

    if (!tripId) {
      continue
    }

    const existingTrip = tripsById.get(tripId)

    if (existingTrip) {
      existingTrip.assigned_trip_sheet_count += 1
      continue
    }

    tripsById.set(tripId, {
      id: tripId,
      title: trip?.title ?? 'Untitled trip',
      destination:
        getDestinationName(trip?.destination_ref, 'Unknown destination') ??
        'Unknown destination',
      start_date: trip?.start_date ?? null,
      end_date: trip?.end_date ?? null,
      assigned_trip_sheet_count: 1,
    })
  }

  return Array.from(tripsById.values())
}
