import Link from 'next/link'

import AdminNav from '@/app/dashboard/AdminNav'
import { logout } from '@/app/auth/actions'
import AssignedTripCards from '@/app/components/AssignedTripCards'
import { requireResource } from '@/app/dashboard/lib'
import { getDestinationName, type DestinationRelation } from '@/lib/trip-sheets'

type TripSheetRow = {
  id: string
  title: string | null
  destination_id: string | null
  destination_ref: DestinationRelation
  start_date: string | null
  end_date: string | null
  guest_name: string | null
  updated_at: string | null
}

function formatValue(value: string | null) {
  return value ?? '-'
}

export default async function MyTripSheetsPage() {
  const { supabase, user } = await requireResource()

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
            'id, title, destination_id, destination_ref:destinations(name), start_date, end_date, guest_name, updated_at'
          )
          .in('id', tripSheetIds)
          .order('start_date', { ascending: true })
      : { data: [], error: null }

  const tripSheets = ((tripSheetData as TripSheetRow[] | null) ?? []).map((tripSheet) => ({
    ...tripSheet,
    destination: getDestinationName(tripSheet.destination_ref, 'Unknown destination'),
  }))
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
            <h1 className="app-page-title">My Trip Sheets</h1>
            <p className="app-page-subtitle">
              View the trip sheets currently assigned to you.
            </p>
          </div>
        </div>

        {errorMessage ? (
          <p className="app-banner-error">
            {errorMessage}
          </p>
        ) : null}

        <AssignedTripCards tripSheets={tripSheets} className="space-y-4 md:hidden" />

        <div className="app-table-wrap hidden md:block">
          <table className="app-table min-w-full table-fixed">
            <thead>
              <tr>
                <th className="w-[30%] px-5 py-3 font-medium text-gray-700">Trip</th>
                <th className="w-[15%] px-5 py-3 font-medium text-gray-700">Destination</th>
                <th className="w-[12%] px-5 py-3 font-medium text-gray-700">Start</th>
                <th className="w-[12%] px-5 py-3 font-medium text-gray-700">End</th>
                <th className="w-[20%] px-5 py-3 font-medium text-gray-700">Customer</th>
                <th className="w-[11%] px-5 py-3 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tripSheets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-5 text-gray-700">
                    No trip sheets assigned yet.
                  </td>
                </tr>
              ) : (
                tripSheets.map((tripSheet) => (
                  <tr key={tripSheet.id} className="align-top">
                    <td className="px-5 py-4 text-gray-900">
                      <div className="max-w-full space-y-1">
                        <p className="text-[15px] font-semibold leading-6 whitespace-normal break-words text-gray-900">
                          {formatValue(tripSheet.title)}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-900">
                      {formatValue(tripSheet.destination)}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-gray-900">
                      {formatValue(tripSheet.start_date)}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-gray-900">
                      {formatValue(tripSheet.end_date)}
                    </td>
                    <td className="px-5 py-4 text-gray-900">
                      {formatValue(tripSheet.guest_name)}
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        href={`/trip-sheets/${tripSheet.id}`}
                        className="ui-button ui-button-neutral"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
