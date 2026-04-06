import AdminNav from '@/app/dashboard/AdminNav'
import AssignedTripsCards from '@/app/components/AssignedTripsCards'
import {
  buildAssignedTripSummaries,
  sortAssignedTrips,
  type AssignedTripSheetRow,
} from '@/app/lib/assigned-trips'

import { requireAdmin } from '../lib'

export default async function AdminMyTripsPage() {
  const { supabase, user } = await requireAdmin()

  const { data: assignmentData, error: assignmentError } = await supabase
    .from('trip_sheet_assignments')
    .select('trip_sheet_id')
    .eq('resource_user_id', user.id)
    .order('created_at', { ascending: false })

  const tripSheetIds =
    ((assignmentData as Array<{ trip_sheet_id: string }> | null) ?? []).map(
      (assignment) => assignment.trip_sheet_id
    )

  const { data: tripSheetData, error: tripSheetError } =
    tripSheetIds.length > 0
      ? await supabase
          .from('trip_sheets')
          .select(
            'id, trip_id, trip:trips(id, title, start_date, end_date, destination_ref:destinations(name))'
          )
          .in('id', tripSheetIds)
      : { data: [], error: null }

  const trips = sortAssignedTrips(
    buildAssignedTripSummaries((tripSheetData as AssignedTripSheetRow[] | null) ?? [])
  )
  const errorMessage = assignmentError?.message || tripSheetError?.message || null

  return (
    <>
      <AdminNav current="my-trips" />

      <div className="app-page-header">
        <div>
          <h1 className="app-page-title">My Trips</h1>
          <p className="app-page-subtitle">
            View the trips where you are assigned to at least one trip sheet.
          </p>
        </div>
      </div>

      {errorMessage ? (
        <p className="app-banner-error">
          {errorMessage}
        </p>
      ) : null}

      <AssignedTripsCards
        trips={trips}
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        from="my-trips"
      />
    </>
  )
}
