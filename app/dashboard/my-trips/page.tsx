import AdminNav from '@/app/dashboard/AdminNav'
import AssignedTripCards, {
  type AssignedTripCardTripSheet,
} from '@/app/components/AssignedTripCards'
import { getDestinationName, type DestinationRelation } from '@/lib/trip-sheets'

import { requireAdmin } from '../lib'

type TripSheet = AssignedTripCardTripSheet

type TripSheetRow = {
  id: string
  title: string | null
  destination_id: string | null
  destination_ref: DestinationRelation
  start_date: string | null
  end_date: string | null
  guest_name: string | null
}

function getTodayDateString() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
  })

  return formatter.format(new Date())
}

function getTripSortGroup(tripSheet: TripSheet, today: string) {
  const startDate = tripSheet.start_date ?? ''
  const endDate = tripSheet.end_date ?? startDate

  if (startDate && endDate && startDate <= today && endDate >= today) {
    return 0
  }

  if (startDate && startDate > today) {
    return 1
  }

  return 2
}

function sortAssignedTrips(tripSheets: TripSheet[]) {
  const today = getTodayDateString()

  return [...tripSheets].sort((left, right) => {
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

export default async function AdminMyTripsPage() {
  const { supabase, user } = await requireAdmin()

  const { data: assignmentData, error: assignmentError } = await supabase
    .from('trip_sheet_assignments')
    .select('trip_sheet_id')
    .eq('resource_user_id', user.id)
    .order('assigned_at', { ascending: false })

  const tripSheetIds =
    ((assignmentData as Array<{ trip_sheet_id: string }> | null) ?? []).map(
      (assignment) => assignment.trip_sheet_id
    )

  const { data: tripSheetData, error: tripSheetError } =
    tripSheetIds.length > 0
      ? await supabase
          .from('trip_sheets')
          .select(
            'id, title, destination_id, destination_ref:destinations(name), start_date, end_date, guest_name'
          )
          .in('id', tripSheetIds)
      : { data: [], error: null }

  const tripSheets = sortAssignedTrips(
    ((tripSheetData as TripSheetRow[] | null) ?? []).map((tripSheet) => ({
      ...tripSheet,
      destination: getDestinationName(tripSheet.destination_ref, 'Unknown destination'),
    }))
  )
  const errorMessage = assignmentError?.message || tripSheetError?.message || null

  return (
    <>
      <AdminNav current="my-trips" />

      <div className="app-page-header">
        <div>
          <h1 className="app-page-title">My Trips</h1>
          <p className="app-page-subtitle">
            View the trips currently assigned to you in a compact execution view.
          </p>
        </div>
      </div>

      {errorMessage ? (
        <p className="app-banner-error">
          {errorMessage}
        </p>
      ) : null}

      <AssignedTripCards
        tripSheets={tripSheets}
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        from="my-trips"
      />
    </>
  )
}
