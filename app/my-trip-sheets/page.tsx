import Link from 'next/link'

import AdminNav from '@/app/dashboard/AdminNav'
import { logout } from '@/app/auth/actions'
import { requireResource } from '@/app/dashboard/lib'

type TripSheet = {
  id: string
  title: string | null
  destination: string | null
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
          .select('id, title, destination, start_date, end_date, guest_name, updated_at')
          .in('id', tripSheetIds)
          .order('start_date', { ascending: true })
      : { data: [], error: null }

  const tripSheets = (tripSheetData as TripSheet[] | null) ?? []
  const errorMessage = assignmentError?.message || tripSheetError?.message || null

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-12">
      <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-4 shadow-sm sm:p-5 md:max-w-5xl md:p-8">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
          <AdminNav current="my-trip-sheets" role="resource" />

          <form action={logout}>
            <button
              type="submit"
              className="w-full rounded border border-zinc-300 px-4 py-2.5 text-base font-medium text-gray-900 md:w-auto md:py-2 md:text-sm"
            >
              Logout
            </button>
          </form>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">My Trip Sheets</h1>
        </div>

        {errorMessage ? (
          <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        <div className="space-y-4 md:hidden">
          {tripSheets.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-base text-gray-700">
              No trip sheets assigned yet.
            </div>
          ) : (
            tripSheets.map((tripSheet) => (
              <article
                key={tripSheet.id}
                className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4"
              >
                <div className="space-y-2">
                  <p className="text-lg font-bold leading-7 text-gray-900">
                    {formatValue(tripSheet.title)}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">Destination</p>
                    <p className="text-base text-gray-900">
                      {formatValue(tripSheet.destination)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">Start</p>
                    <p className="text-base text-gray-900">
                      {formatValue(tripSheet.start_date)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">End</p>
                    <p className="text-base text-gray-900">
                      {formatValue(tripSheet.end_date)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">Customer</p>
                    <p className="text-base text-gray-900">
                      {formatValue(tripSheet.guest_name)}
                    </p>
                  </div>
                </div>

                <Link
                  href={`/trip-sheets/${tripSheet.id}`}
                  className="block w-full rounded border border-zinc-300 bg-white px-4 py-2.5 text-center text-base text-gray-900"
                >
                  View
                </Link>
              </article>
            ))
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full table-fixed border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
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
                  <tr
                    key={tripSheet.id}
                    className="border-b border-zinc-100 align-top transition-colors hover:bg-zinc-50"
                  >
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
                        className="rounded border border-zinc-300 bg-white px-3 py-1 text-sm text-gray-900"
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
