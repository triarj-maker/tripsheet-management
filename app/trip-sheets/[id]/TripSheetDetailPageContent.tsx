import Link from 'next/link'
import { redirect } from 'next/navigation'

import MarkdownBody from '@/app/components/MarkdownBody'
import AdminNav from '@/app/dashboard/AdminNav'
import { getCurrentUserProfile, getSignedInHomePath } from '@/app/dashboard/lib'
import {
  canAccessAssignedWork,
  isAdminRole,
  isOperationalRole,
} from '@/lib/roles'
import {
  formatTripCustomerSummary,
  formatTripTypeLabel,
  getDestinationName,
  getTripParent,
  type DestinationRelation,
  type LookupNameRelation,
} from '@/lib/trip-sheets'

type TripSheet = {
  id: string
  title: string | null
  start_date: string | null
  start_time: string | null
  end_date: string | null
  end_time: string | null
  body_text: string | null
  transportation_info: string | null
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

type TripParentRelation = TripParentRecord | TripParentRecord[] | null | undefined

type TripSheetCard = {
  id: string
  title: string
  category: string
  card_url: string
  sort_order: number | null
}

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

function getVisibleCardCategory(role: string | null) {
  if (role === 'facilitator' || role === 'expert') {
    return role
  }

  return null
}

function formatCardCategoryLabel(category: string | null) {
  if (category === 'expert') {
    return 'Expert'
  }

  if (category === 'facilitator') {
    return 'Facilitator'
  }

  return 'Module'
}

function ModuleCardsSection({ cards }: { cards: TripSheetCard[] }) {
  if (cards.length === 0) {
    return null
  }

  return (
    <section className="app-section-card space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Module Cards</h2>
        <p className="mt-1 text-sm text-gray-600">
          Open the relevant playbook cards for this trip sheet.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <a
            key={card.id}
            href={card.card_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg border border-zinc-200 px-4 py-3 transition hover:border-zinc-300 hover:bg-zinc-50"
          >
            <span className="block text-sm font-semibold leading-5 text-gray-900">
              {card.title}
            </span>
            <span className="mt-1 block text-xs font-medium text-gray-500">
              {formatCardCategoryLabel(card.category)}
            </span>
            <span className="mt-3 inline-flex min-h-9 items-center rounded-md border border-zinc-300 px-3 text-sm font-medium text-gray-800">
              Open Card
            </span>
          </a>
        ))}
      </div>
    </section>
  )
}

export async function renderTripSheetDetailPage({
  id,
  from,
}: {
  id: string
  from?: string
}) {
  const { supabase, user, profile } = await getCurrentUserProfile()
  const role = profile?.role ?? null

  if (!canAccessAssignedWork(role)) {
    redirect('/login?error=You%20do%20not%20have%20access%20to%20that%20page.')
  }

  const { data } = await supabase
    .from('trip_sheets')
    .select(
      'id, title, start_date, start_time, end_date, end_time, body_text, transportation_info, trip_id, trip:trips(id, title, trip_type, start_date, end_date, destination_ref:destinations(name), company_id, school_id, company_ref:companies(name), school_ref:schools(name), guest_name, company, phone_number, adult_count, kid_count)'
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

  if (isOperationalRole(role)) {
    const { data: assignmentRows, error: assignmentError } = await supabase
      .from('trip_sheet_assignments')
      .select('id')
      .eq('resource_user_id', user.id)
      .eq('trip_sheet_id', id)
      .limit(1)

    if (
      assignmentError ||
      (((assignmentRows as Array<{ id: string }> | null) ?? []).length === 0)
    ) {
      redirect('/my-trip-sheets')
    }
  }

  const visibleCardCategory = getVisibleCardCategory(role)
  const shouldLoadCards = isAdminRole(role) || Boolean(visibleCardCategory)
  let tripSheetCards: TripSheetCard[] = []
  let cardsErrorMessage: string | null = null

  if (shouldLoadCards) {
    let cardQuery = supabase
      .from('trip_sheet_cards')
      .select('id, title, category, card_url, sort_order')
      .eq('trip_sheet_id', id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (visibleCardCategory && !isAdminRole(role)) {
      cardQuery = cardQuery.eq('category', visibleCardCategory)
    }

    const { data: cardData, error: cardsError } = await cardQuery

    tripSheetCards = (cardData as TripSheetCard[] | null) ?? []
    cardsErrorMessage = cardsError?.message ?? null
  }

  const resolvedFrom = from ?? (isOperationalRole(role) ? 'my-trip-sheets' : undefined)
  const currentNav =
    resolvedFrom === 'my-trip-sheets'
      ? 'my-trip-sheets'
      : resolvedFrom === 'my-trips'
        ? 'my-trips'
        : isOperationalRole(role)
          ? 'my-trip-sheets'
          : 'trips'
  const backHref =
    resolvedFrom === 'my-trips' || resolvedFrom === 'my-trip-sheets'
      ? `/trips/${trip.id}?from=${resolvedFrom}`
      : isAdminRole(role)
        ? `/dashboard/trips/${trip.id}`
        : '/my-trip-sheets'
  const backLabel =
    resolvedFrom === 'my-trips' || resolvedFrom === 'my-trip-sheets'
      ? 'Back to Trip'
      : isAdminRole(role)
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

          {cardsErrorMessage ? (
            <p className="app-banner-error">{cardsErrorMessage}</p>
          ) : null}

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
                  {formatTripCustomerSummary(trip)}
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

          <ModuleCardsSection cards={tripSheetCards} />

          <section className="app-section-card space-y-4 p-3 sm:p-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Trip Sheet Body</h2>
              <p className="mt-1 text-sm text-gray-600">
                Execution content rendered from the saved Markdown text.
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

            <MarkdownBody content={tripSheet.body_text} />

            {tripSheet.transportation_info?.trim() ? (
              <div className="space-y-2 border-t border-zinc-200 pt-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    Transportation Details
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Operational transport notes for this trip sheet.
                  </p>
                </div>

                <div className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-900">
                  {tripSheet.transportation_info}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  )
}
