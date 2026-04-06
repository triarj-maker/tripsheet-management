import Link from 'next/link'
import { redirect } from 'next/navigation'

import AdminNav from '@/app/dashboard/AdminNav'
import { getCurrentUserProfile, getSignedInHomePath } from '@/app/dashboard/lib'
import {
  formatTripTypeLabel,
  getDestinationName,
  type DestinationRelation,
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

function formatDateTime(dateValue: string | null, timeValue: string | null) {
  const formattedDate = formatDate(dateValue)

  if (formattedDate === '-') {
    return '-'
  }

  const formattedTime = formatTime(timeValue)

  return formattedTime ? `${formattedDate}, ${formattedTime}` : formattedDate
}

function formatTripSheetSchedule(tripSheet: TripSheetRow) {
  const start = formatDateTime(tripSheet.start_date, tripSheet.start_time)
  const end = formatDateTime(tripSheet.end_date, tripSheet.end_time)

  if (start === '-' && end === '-') {
    return '-'
  }

  if (end === '-') {
    return start
  }

  if (
    (tripSheet.start_date ?? '') === (tripSheet.end_date ?? '') &&
    (tripSheet.start_time ?? '') === (tripSheet.end_time ?? '')
  ) {
    return start
  }

  return `${start} → ${end}`
}

function sortTripSheetsChronologically(tripSheets: TripSheetRow[]) {
  return [...tripSheets].sort((left, right) => {
    const dateComparison = (left.start_date ?? '').localeCompare(right.start_date ?? '')

    if (dateComparison !== 0) {
      return dateComparison
    }

    return (left.start_time ?? '00:00').localeCompare(right.start_time ?? '00:00')
  })
}

function formatCustomerSummary(trip: Pick<TripRow, 'guest_name' | 'company'>) {
  const guestName = trip.guest_name?.trim() ?? ''
  const company = trip.company?.trim() ?? ''

  if (guestName && company) {
    return `${guestName} · ${company}`
  }

  if (guestName) {
    return guestName
  }

  if (company) {
    return company
  }

  return '-'
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

  if (role !== 'admin' && role !== 'resource') {
    redirect('/login?error=You%20do%20not%20have%20access%20to%20that%20page.')
  }

  const { data: tripData } = await supabase
    .from('trips')
    .select(
      'id, title, trip_type, start_date, end_date, destination_ref:destinations(name), guest_name, company, phone_number, adult_count, kid_count'
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

  const currentNav =
    query.from === 'my-trip-sheets'
      ? 'my-trip-sheets'
      : query.from === 'my-trips'
        ? 'my-trips'
        : role === 'resource'
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
      : role === 'resource'
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
                <dd className="mt-1 text-sm text-gray-900">{formatCustomerSummary(trip)}</dd>
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
              <h2 className="text-lg font-semibold text-gray-900">All Trip Sheets in This Trip</h2>
              <p className="mt-1 text-sm text-gray-600">
                Full trip timeline, with your assigned trip sheets clearly highlighted.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {allTripSheets.map((tripSheet) => {
                const isAssignedToCurrentUser = assignedTripSheetIds.has(tripSheet.id)
                const cardClass = [
                  'app-section-card block space-y-3 transition',
                  isAssignedToCurrentUser
                    ? 'border-emerald-300 bg-emerald-50 ring-1 ring-emerald-100 shadow-sm'
                    : 'border-zinc-200 bg-zinc-50/40',
                  isAssignedToCurrentUser
                    ? 'hover:border-emerald-400 hover:bg-emerald-100/70'
                    : 'hover:bg-zinc-50',
                ]
                  .filter(Boolean)
                  .join(' ')

                return (
                  <Link
                    key={tripSheet.id}
                    href={`/trip-sheets/${tripSheet.id}?from=${fromParam}`}
                    className={cardClass}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p
                          className={[
                            'text-lg font-bold leading-7',
                            isAssignedToCurrentUser ? 'text-gray-900' : 'text-gray-800',
                          ].join(' ')}
                        >
                          {formatValue(tripSheet.title)}
                        </p>
                        <p
                          className={[
                            'text-sm',
                            isAssignedToCurrentUser ? 'text-gray-700' : 'text-gray-600',
                          ].join(' ')}
                        >
                          {formatTripSheetSchedule(tripSheet)}
                        </p>
                      </div>

                      <span
                        className={[
                          'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
                          isAssignedToCurrentUser
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-zinc-100 text-gray-600',
                        ].join(' ')}
                      >
                        {isAssignedToCurrentUser ? 'Assigned to you' : 'Other trip sheet'}
                      </span>
                    </div>

                    <span
                      className={[
                        'text-sm font-medium',
                        isAssignedToCurrentUser ? 'text-gray-700' : 'text-gray-600',
                      ].join(' ')}
                    >
                      View Trip Sheet
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
