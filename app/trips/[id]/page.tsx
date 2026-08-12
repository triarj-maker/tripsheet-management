import Link from 'next/link'
import { redirect } from 'next/navigation'

import AdminNav from '@/app/dashboard/AdminNav'
import { getCurrentUserProfile, getSignedInHomePath } from '@/app/dashboard/lib'
import { canAccessAssignedWork, isOperationalRole } from '@/lib/roles'
import {
  formatTripCustomerSummary,
  formatTripTypeLabel,
  getDestinationName,
  type DestinationRelation,
  type LookupNameRelation,
} from '@/lib/trip-sheets'

type TripViewPageProps = {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    from?: string
  }>
}

type TripRow = {
  id: string
  title: string | null
  trip_type: string | null
  start_date: string | null
  end_date: string | null
  destination_ref: DestinationRelation
  company_id: string | null
  school_id: string | null
  company_ref: LookupNameRelation
  school_ref: LookupNameRelation
  guest_name: string | null
  company: string | null
  phone_number: string | null
  adult_count: number | null
  kid_count: number | null
}

type TripSheetRow = {
  id: string
  trip_id: string | null
  title: string | null
  start_date: string | null
  start_time: string | null
  end_date: string | null
  end_time: string | null
}

type AssignmentRow = {
  trip_sheet_id: string
}

function formatValue(value: string | null) {
  return value ?? '-'
}

function formatCount(value: number | null) {
  return String(value ?? 0)
}

function formatDate(value: string | null) {
  if (!value) {
    return '-'
  }

  const [year, month, day] = value.split('-').map(Number)

  if (!year || !month || !day) {
    return value
  }

  return `${day} ${new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))}`
}

function formatTime(value: string | null) {
  if (!value) {
    return null
  }

  const [hours, minutes] = value.split(':').map(Number)

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return value
  }

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(1970, 0, 1, hours, minutes)))
}

function sortTripSheetsChronologically(tripSheets: TripSheetRow[]) {
  return tripSheets
    .map((tripSheet, originalIndex) => ({ tripSheet, originalIndex }))
    .sort((leftEntry, rightEntry) => {
      const left = leftEntry.tripSheet
      const right = rightEntry.tripSheet
      const dateComparison = (left.start_date ?? '9999-12-31').localeCompare(
        right.start_date ?? '9999-12-31'
      )

      if (dateComparison !== 0) {
        return dateComparison
      }

      const timeComparison = (left.start_time ?? '99:99').localeCompare(
        right.start_time ?? '99:99'
      )

      return timeComparison || leftEntry.originalIndex - rightEntry.originalIndex
    })
    .map(({ tripSheet }) => tripSheet)
}

function groupTripSheetsByStartDate(tripSheets: TripSheetRow[]) {
  const groups = new Map<string | null, TripSheetRow[]>()

  for (const tripSheet of tripSheets) {
    const date = tripSheet.start_date
    const existingGroup = groups.get(date)

    if (existingGroup) {
      existingGroup.push(tripSheet)
    } else {
      groups.set(date, [tripSheet])
    }
  }

  return Array.from(groups, ([date, modules]) => ({ date, modules }))
}

function formatModuleTimeRange(tripSheet: TripSheetRow) {
  const startTime = formatTime(tripSheet.start_time)
  const endTime = formatTime(tripSheet.end_time)

  if (!startTime && !endTime) {
    return 'Time not set'
  }

  if (!startTime) {
    return `Ends ${endTime}`
  }

  if (!endTime || startTime === endTime) {
    return startTime
  }

  return `${startTime} – ${endTime}`
}

export default async function AssignedTripViewPage({
  params,
  searchParams,
}: TripViewPageProps) {
  const [{ id }, query, { supabase, user, profile }] = await Promise.all([
    params,
    searchParams,
    getCurrentUserProfile(),
  ])

  const role = profile?.role ?? null

  if (!canAccessAssignedWork(role)) {
    redirect('/login?error=You%20do%20not%20have%20access%20to%20that%20page.')
  }

  const { data: tripData } = await supabase
    .from('trips')
    .select(
      'id, title, trip_type, start_date, end_date, destination_ref:destinations(name), company_id, school_id, company_ref:companies(name), school_ref:schools(name), guest_name, company, phone_number, adult_count, kid_count'
    )
    .eq('id', id)
    .maybeSingle()

  const trip = (tripData as TripRow | null) ?? null

  if (!trip) {
    redirect(getSignedInHomePath(role))
  }

  const { data: tripSheetData, error: tripSheetsError } = await supabase
    .from('trip_sheets')
    .select('id, trip_id, title, start_date, start_time, end_date, end_time')
    .eq('trip_id', id)
    .order('start_date', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: true })

  if (tripSheetsError) {
    redirect(getSignedInHomePath(role))
  }

  const allTripSheets = sortTripSheetsChronologically(
    (tripSheetData as TripSheetRow[] | null) ?? []
  )
  const allTripSheetIds = allTripSheets.map((tripSheet) => tripSheet.id)

  const { data: assignmentData, error: assignmentError } =
    allTripSheetIds.length > 0
      ? await supabase
          .from('trip_sheet_assignments')
          .select('trip_sheet_id')
          .eq('resource_user_id', user.id)
          .in('trip_sheet_id', allTripSheetIds)
          .order('created_at', { ascending: false })
      : { data: [], error: null }

  if (assignmentError) {
    redirect(getSignedInHomePath(role))
  }

  const assignedTripSheetIds = new Set(
    ((assignmentData as AssignmentRow[] | null) ?? []).map(
      (assignment) => assignment.trip_sheet_id
    )
  )
  const assignedTripSheets = allTripSheets.filter((tripSheet) =>
    assignedTripSheetIds.has(tripSheet.id)
  )

  if (assignedTripSheets.length === 0) {
    redirect(getSignedInHomePath(role))
  }
  const tripSheetDateGroups = groupTripSheetsByStartDate(allTripSheets)

  const currentNav =
    query.from === 'my-trip-sheets'
      ? 'my-trip-sheets'
      : query.from === 'my-trips'
        ? 'my-trips'
        : isOperationalRole(role)
          ? 'my-trip-sheets'
          : 'my-trips'
  const backHref =
    query.from === 'my-trip-sheets'
      ? '/my-trip-sheets'
      : '/my-trips'
  const backLabel =
    query.from === 'my-trip-sheets' ? 'Back to My Trip Sheets' : 'Back to My Trips'
  const destinationName = getDestinationName(trip.destination_ref, 'Unknown destination')
  const fromParam =
    query.from === 'my-trip-sheets' || query.from === 'my-trips'
      ? query.from
      : isOperationalRole(role)
        ? 'my-trip-sheets'
        : 'my-trips'

  return (
    <main className="app-page">
      <div className="app-shell app-card">
        <AdminNav current={currentNav} role={role} />

        <div className="space-y-4">
          <div>
            <Link
              href={backHref}
              className="inline-flex items-center text-sm font-medium text-gray-700 transition hover:text-gray-900"
            >
              ← {backLabel}
            </Link>
          </div>

          <div className="app-page-header !mb-0">
            <div>
              <h1 className="app-page-title">{trip.title ?? 'Untitled trip'}</h1>
              <p className="app-page-subtitle">
                Review the trip context and open the trip sheets assigned to you.
              </p>
            </div>
          </div>

          <section className="app-section-card space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Trip Summary</h2>
              <p className="mt-1 text-sm text-gray-600">
                Parent trip details for your assigned execution units.
              </p>
            </div>

            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-xs font-medium text-gray-500">Customer</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatTripCustomerSummary(trip)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">Trip Type</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {formatTripTypeLabel(trip.trip_type)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">Start Date</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatDate(trip.start_date)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">End Date</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatDate(trip.end_date)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">Destination</dt>
                <dd className="mt-1 text-sm text-gray-900">{destinationName}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">Phone</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatValue(trip.phone_number)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">Adult Numbers</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatCount(trip.adult_count)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">Kid Numbers</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatCount(trip.kid_count)}</dd>
              </div>
            </dl>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Trip Timeline</h2>
              <p className="mt-1 text-sm text-gray-600">
                Full trip flow, organised by day and time.
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-full border border-emerald-300 bg-emerald-100"
                />
                <span>Assigned to you</span>
              </div>
            </div>

            {tripSheetDateGroups.length === 0 ? (
              <div className="app-section-card text-sm text-gray-600">
                No modules have been added to this trip yet.
              </div>
            ) : null}

            <div className="space-y-5 md:hidden">
              {tripSheetDateGroups.map(({ date, modules }) => (
                <section key={date ?? 'date-not-set'} className="space-y-2">
                  <h3 className="border-b border-gray-200 pb-1.5 text-base font-semibold text-gray-900">
                    {date ? formatDate(date) : 'Date not set'}
                  </h3>
                  <div className="space-y-2">
                    {modules.map((tripSheet) => {
                      const isAssignedToCurrentUser = assignedTripSheetIds.has(tripSheet.id)

                      return (
                        <Link
                          key={tripSheet.id}
                          href={`/trip-sheets/${tripSheet.id}?from=${fromParam}`}
                          className={[
                            'block rounded-lg border px-3 py-2.5 transition',
                            isAssignedToCurrentUser
                              ? 'border-emerald-300 bg-emerald-50 shadow-sm hover:bg-emerald-100/70'
                              : 'border-zinc-200 bg-zinc-50/50 hover:bg-zinc-100/70',
                          ].join(' ')}
                        >
                          <p className="text-xs font-medium text-gray-500">
                            {formatModuleTimeRange(tripSheet)}
                          </p>
                          <p className="mt-0.5 break-words text-base font-semibold leading-5 text-gray-900">
                            {formatValue(tripSheet.title)}
                          </p>
                          <span className="mt-1 block py-1 text-sm font-medium text-gray-700">
                            View Details
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>

            <div className="hidden overflow-x-auto pb-2 md:block">
              <div className="grid w-max grid-flow-col auto-cols-[minmax(16rem,20rem)] gap-4">
                {tripSheetDateGroups.map(({ date, modules }) => (
                  <section key={date ?? 'date-not-set'} className="space-y-3">
                    <h3 className="border-b border-gray-300 pb-2 text-base font-semibold text-gray-900">
                      {date ? formatDate(date) : 'Date not set'}
                    </h3>
                    <div className="space-y-3">
                      {modules.map((tripSheet) => {
                        const isAssignedToCurrentUser = assignedTripSheetIds.has(tripSheet.id)
                        const cardClass = [
                          'block rounded-xl border p-4 transition',
                          isAssignedToCurrentUser
                            ? 'border-emerald-300 bg-emerald-50 ring-1 ring-emerald-100 shadow-sm'
                            : 'border-zinc-200 bg-zinc-50/40',
                          isAssignedToCurrentUser
                            ? 'hover:border-emerald-400 hover:bg-emerald-100/70'
                            : 'hover:bg-zinc-50',
                        ].join(' ')

                        return (
                          <Link
                            key={tripSheet.id}
                            href={`/trip-sheets/${tripSheet.id}?from=${fromParam}`}
                            className={cardClass}
                          >
                            <div>
                              <p className="text-xs font-medium text-gray-500">
                                {formatModuleTimeRange(tripSheet)}
                              </p>
                              <p
                                className={[
                                  'mt-1 break-words text-base font-semibold leading-6',
                                  isAssignedToCurrentUser ? 'text-gray-900' : 'text-gray-800',
                                ].join(' ')}
                              >
                                {formatValue(tripSheet.title)}
                              </p>
                            </div>

                            <span
                              className={[
                                'mt-3 block text-sm font-medium',
                                isAssignedToCurrentUser ? 'text-gray-700' : 'text-gray-600',
                              ].join(' ')}
                            >
                              View Details
                            </span>
                          </Link>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
