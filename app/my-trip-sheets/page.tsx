import AdminNav from '@/app/dashboard/AdminNav'
import { logout } from '@/app/auth/actions'
import AssignedTripsCards from '@/app/components/AssignedTripsCards'
import { requireResource } from '@/app/dashboard/lib'
import {
  buildAssignedTripSummaries,
  sortAssignedTrips,
  type AssignedTripSheetRow,
} from '@/app/lib/assigned-trips'

export default async function MyTripSheetsPage() {
  const { supabase, user } = await requireResource()

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
    <main className="app-page">
      <div className="app-shell app-card">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
          <AdminNav current="my-trip-sheets" role="resource" />

          <form action={logout}>
            <button
              type="submit"
              className="ui-button ui-button-secondary w-full md:w-auto"
            >
              Logout
            </button>
          </form>
        </div>

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
          from="my-trip-sheets"
        />
      </div>
    </main>
  )
}
