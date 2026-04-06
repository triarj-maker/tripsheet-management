import Link from 'next/link'
import { redirect } from 'next/navigation'

import AdminNav from '@/app/dashboard/AdminNav'
import { getCurrentUserProfile, getSignedInHomePath } from '@/app/dashboard/lib'
import {
  formatTripTypeLabel,
  getDestinationName,
  getTripParent,
  type DestinationRelation,
} from '@/lib/trip-sheets'

type TripSheet = {
  id: string
  title: string | null
  start_date: string | null
  start_time: string | null
  end_date: string | null
  end_time: string | null
  body_text: string | null
  trip_id: string | null
  trip: TripParentRelation
}

type TripParentRecord = {
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

type TripSheetViewPageProps = {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    from?: string
  }>
}

type TripParentRelation = TripParentRecord | TripParentRecord[] | null | undefined

function formatValue(value: string | null) {
  return value ?? '-'
}

function formatCount(value: number | null) {
  return String(value ?? 0)
}

function formatDate(value: string | null, includeYear = true) {
  if (!value) {
    return '-'
  }

  const [year, month, day] = value.split('-').map(Number)

  if (!year || !month || !day) {
    return value
  }

  return `${day} ${new Intl.DateTimeFormat('en-US', {
    month: 'short',
    ...(includeYear ? { year: 'numeric' as const } : {}),
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

function formatDateTime(value: string | null, time: string | null) {
  const formattedDate = formatDate(value)

  if (formattedDate === '-') {
    return '-'
  }

  const formattedTime = formatTime(time)

  return formattedTime ? `${formattedDate}, ${formattedTime}` : formattedDate
}

function formatCustomerSummary(trip: Pick<TripParentRecord, 'guest_name' | 'company'>) {
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

export default async function TripSheetViewPage({
  params,
  searchParams,
}: TripSheetViewPageProps) {
  const [{ id }, query, { supabase, user, profile }] = await Promise.all([
    params,
    searchParams,
    getCurrentUserProfile(),
  ])

  const role = profile?.role ?? null

  if (role !== 'admin' && role !== 'resource') {
    redirect('/login?error=You%20do%20not%20have%20access%20to%20that%20page.')
  }

  const { data } = await supabase
    .from('trip_sheets')
    .select(
      'id, title, start_date, start_time, end_date, end_time, body_text, trip_id, trip:trips(id, title, trip_type, start_date, end_date, destination_ref:destinations(name), guest_name, company, phone_number, adult_count, kid_count)'
    )
    .eq('id', id)
    .maybeSingle()

  const tripSheet = (data as TripSheet | null) ?? null

  if (!tripSheet) {
    redirect(getSignedInHomePath(role))
  }

  const trip = getTripParent(tripSheet.trip)

  if (!trip) {
    redirect(getSignedInHomePath(role))
  }

  if (role === 'resource') {
    const { data: tripSheetRowsInTrip, error: tripSheetRowsError } = await supabase
      .from('trip_sheets')
      .select('id')
      .eq('trip_id', trip.id)

    if (tripSheetRowsError) {
      redirect('/my-trip-sheets')
    }

    const tripSheetIdsInTrip = (
      (tripSheetRowsInTrip as Array<{ id: string }> | null) ?? []
    ).map((tripSheetRow) => tripSheetRow.id)

    if (tripSheetIdsInTrip.length === 0) {
      redirect('/my-trip-sheets')
    }

    const { data: assignmentInTrip, error: assignmentError } = await supabase
      .from('trip_sheet_assignments')
      .select('id')
      .eq('resource_user_id', user.id)
      .in('trip_sheet_id', tripSheetIdsInTrip)
      .maybeSingle()

    if (assignmentError || !assignmentInTrip) {
      redirect('/my-trip-sheets')
    }
  }

  const currentNav =
    query.from === 'my-trip-sheets'
      ? 'my-trip-sheets'
      : query.from === 'my-trips'
        ? 'my-trips'
        : role === 'resource'
          ? 'my-trip-sheets'
          : 'trips'
  const backHref =
    query.from === 'my-trips' || query.from === 'my-trip-sheets'
      ? `/trips/${trip.id}?from=${query.from}`
      : role === 'admin'
        ? `/dashboard/trips/${trip.id}`
        : '/my-trip-sheets'
  const backLabel =
    query.from === 'my-trips' || query.from === 'my-trip-sheets'
      ? 'Back to Trip'
      : role === 'admin'
        ? 'Back to Trip'
        : 'Back to My Trip Sheets'
  const destinationName = getDestinationName(trip.destination_ref, 'Unknown destination')

  return (
    <main className="app-page">
      <div className="app-shell app-card">
        <AdminNav
          current={currentNav}
          role={role}
        />

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
                Review the parent trip context, then use the trip sheet body for execution.
              </p>
            </div>
          </div>

          <section className="app-section-card space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Trip Summary</h2>
              <p className="mt-1 text-sm text-gray-600">
                Parent trip details for field-ready context.
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-3 xl:grid-cols-4">
              <div className="min-w-0 space-y-0.5">
                <dt className="text-[11px] font-medium text-gray-500">Customer</dt>
                <dd className="break-words text-sm font-medium leading-5 text-gray-900">
                  {formatCustomerSummary(trip)}
                </dd>
              </div>
              <div className="min-w-0 space-y-0.5">
                <dt className="text-[11px] font-medium text-gray-500">Trip Type</dt>
                <dd className="text-sm font-medium leading-5 text-gray-900">
                  {formatTripTypeLabel(trip.trip_type)}
                </dd>
              </div>
              <div className="min-w-0 space-y-0.5">
                <dt className="text-[11px] font-medium text-gray-500">Start Date</dt>
                <dd className="text-sm font-medium leading-5 text-gray-900">
                  <span className="sm:hidden">{formatDate(trip.start_date, false)}</span>
                  <span className="hidden sm:inline">{formatDate(trip.start_date)}</span>
                </dd>
              </div>
              <div className="min-w-0 space-y-0.5">
                <dt className="text-[11px] font-medium text-gray-500">End Date</dt>
                <dd className="text-sm font-medium leading-5 text-gray-900">
                  <span className="sm:hidden">{formatDate(trip.end_date, false)}</span>
                  <span className="hidden sm:inline">{formatDate(trip.end_date)}</span>
                </dd>
              </div>
              <div className="min-w-0 space-y-0.5">
                <dt className="text-[11px] font-medium text-gray-500">Destination</dt>
                <dd className="break-words text-sm font-medium leading-5 text-gray-900">
                  {destinationName}
                </dd>
              </div>
              <div className="min-w-0 space-y-0.5">
                <dt className="text-[11px] font-medium text-gray-500">Adult Numbers</dt>
                <dd className="text-sm font-medium leading-5 text-gray-900">
                  {formatCount(trip.adult_count)}
                </dd>
              </div>
              <div className="min-w-0 space-y-0.5">
                <dt className="text-[11px] font-medium text-gray-500">Kid Numbers</dt>
                <dd className="text-sm font-medium leading-5 text-gray-900">
                  {formatCount(trip.kid_count)}
                </dd>
              </div>
              <div className="min-w-0 space-y-0.5">
                <dt className="text-[11px] font-medium text-gray-500">Phone</dt>
                <dd className="break-words text-sm font-medium leading-5 text-gray-900">
                  {formatValue(trip.phone_number)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="app-section-card space-y-4 p-3 sm:p-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Trip Sheet Body</h2>
              <p className="mt-1 text-sm text-gray-600">
                Execution content only. Formatting is preserved exactly as entered.
              </p>
            </div>

            <div className="space-y-2 border-b border-zinc-200 pb-3">
              <h3 className="text-xl font-semibold leading-tight text-gray-900">
                {tripSheet.title ?? 'Untitled trip sheet'}
              </h3>

              <div className="space-y-1 text-sm text-gray-700">
                <p>Start: {formatDateTime(tripSheet.start_date, tripSheet.start_time)}</p>
                <p>End: {formatDateTime(tripSheet.end_date, tripSheet.end_time)}</p>
              </div>
            </div>

            <div className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-900">
              {tripSheet.body_text ?? ''}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
