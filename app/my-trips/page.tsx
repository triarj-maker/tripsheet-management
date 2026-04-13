import AdminNav from '@/app/dashboard/AdminNav'
import AssignedTripsCards from '@/app/components/AssignedTripsCards'
import InstallHomeScreenHint from '@/app/components/InstallHomeScreenHint'
import {
  buildAssignedTripSummaries,
  sortAssignedTrips,
  type AssignedTripSheetRow,
} from '@/app/lib/assigned-trips'
import { requireAdminOrResource } from '@/app/dashboard/lib'

export default async function MyTripsPage() {
  const { supabase, user, profile } = await requireAdminOrResource()

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
            'id, trip_id, title, start_date, start_time, end_date, end_time, trip:trips!inner(id, title, start_date, end_date, destination_ref:destinations(name))'
          )
          .eq('is_archived', false)
          .in('id', tripSheetIds)
      : { data: [], error: null }

  const trips = sortAssignedTrips(
    buildAssignedTripSummaries((tripSheetData as AssignedTripSheetRow[] | null) ?? [])
  )
  const errorMessage = assignmentError?.message || tripSheetError?.message || null

  return (
    <main className="app-page">
      <div className="app-shell app-card">
        <AdminNav current="my-trips" role={profile?.role} />

        <div className="app-page-header">
          <div>
            <h1 className="app-page-title">My Trips</h1>
            <p className="app-page-subtitle">
              View the trips where you are assigned to at least one trip sheet.
            </p>
          </div>
        </div>

        <InstallHomeScreenHint role={profile?.role} />

        {errorMessage ? (
          <p className="app-banner-error">
            {errorMessage}
          </p>
        ) : null}

        <AssignedTripsCards
          trips={trips}
          from="my-trips"
          emptyMessage="No ongoing or upcoming trips assigned to you."
        />
      </div>
    </main>
  )
}
