import Link from 'next/link'

import AdminNav from '@/app/dashboard/AdminNav'
import { requireAdminOrResource } from '@/app/dashboard/lib'
import {
  getDestinationName,
  getTripParent,
  type DestinationRelation,
} from '@/lib/trip-sheets'

type TripParentRecord = {
  id: string
  title: string | null
  destination_ref: DestinationRelation
  guest_name: string | null
  phone_number: string | null
  company: string | null
}

type TripParentRelation = TripParentRecord | TripParentRecord[] | null | undefined

type AssignedTripSheetRow = {
  id: string
  title: string | null
  start_date: string | null
  start_time: string | null
  end_date: string | null
  end_time: string | null
  trip: TripParentRelation
}

type TripSheetCardItem = {
  id: string
  title: string
  startDate: string | null
  startTime: string | null
  endDate: string | null
  endTime: string | null
  parentTripTitle: string
  destination: string
  guestName: string
  phoneNumber: string
  company: string
  status: 'ongoing' | 'upcoming' | 'past'
  sortTimestamp: number
}

function parseDateTimeToTimestamp(date: string | null, time: string | null, fallbackToEndOfDay = false) {
  if (!date) {
    return null
  }

  const [yearText, monthText, dayText] = date.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)

  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return null
  }

  let hours = fallbackToEndOfDay ? 23 : 0
  let minutes = fallbackToEndOfDay ? 59 : 0

  if (time) {
    const [hoursText, minutesText] = time.split(':')
    const parsedHours = Number(hoursText)
    const parsedMinutes = Number(minutesText)

    if (!Number.isNaN(parsedHours) && !Number.isNaN(parsedMinutes)) {
      hours = parsedHours
      minutes = parsedMinutes
    }
  }

  return new Date(year, month - 1, day, hours, minutes, 0, 0).getTime()
}

function formatDate(value: string | null) {
  if (!value) {
    return 'Date TBD'
  }

  const [yearText, monthText, dayText] = value.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)

  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return value
  }

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(year, month - 1, day))
}

function formatTime(value: string | null) {
  if (!value) {
    return 'Time TBD'
  }

  const [hoursText, minutesText] = value.split(':')
  const hours = Number(hoursText)
  const minutes = Number(minutesText)

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return value
  }

  const date = new Date()
  date.setHours(hours, minutes, 0, 0)

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

function formatDateLabel(startDate: string | null, endDate: string | null) {
  if (!startDate && !endDate) {
    return 'Date TBD'
  }

  if (!startDate || startDate === endDate || !endDate) {
    return formatDate(startDate || endDate)
  }

  return `${formatDate(startDate)} - ${formatDate(endDate)}`
}

function formatTimeLabel(startTime: string | null, endTime: string | null) {
  if (!startTime && !endTime) {
    return 'Time TBD'
  }

  if (!startTime) {
    return `Until ${formatTime(endTime)}`
  }

  if (!endTime) {
    return `Starts ${formatTime(startTime)}`
  }

  return `${formatTime(startTime)} - ${formatTime(endTime)}`
}

function buildPhoneHref(value: string) {
  const normalized = value.replace(/[^+\d]/g, '')

  return normalized ? `tel:${normalized}` : ''
}

function buildStatus(
  startDate: string | null,
  startTime: string | null,
  endDate: string | null,
  endTime: string | null
): TripSheetCardItem['status'] {
  const now = Date.now()
  const startTimestamp = parseDateTimeToTimestamp(startDate, startTime) ?? Number.POSITIVE_INFINITY
  const endTimestamp =
    parseDateTimeToTimestamp(endDate ?? startDate, endTime, true) ??
    Number.NEGATIVE_INFINITY

  if (startTimestamp <= now && now <= endTimestamp) {
    return 'ongoing'
  }

  if (startTimestamp > now) {
    return 'upcoming'
  }

  return 'past'
}

function getSortTimestamp(
  startDate: string | null,
  startTime: string | null,
  endDate: string | null,
  endTime: string | null
) {
  return (
    parseDateTimeToTimestamp(startDate, startTime) ??
    parseDateTimeToTimestamp(endDate, endTime, true) ??
    0
  )
}

function statusBadgeClass(status: TripSheetCardItem['status']) {
  if (status === 'ongoing') {
    return 'ui-badge ui-badge-red'
  }

  if (status === 'upcoming') {
    return 'ui-badge ui-badge-green'
  }

  return 'ui-badge bg-zinc-100 text-zinc-700'
}

function buildTripSheetItems(rows: AssignedTripSheetRow[]) {
  return rows
    .map((row) => {
      const trip = getTripParent(row.trip)

      if (!trip) {
        return null
      }

      const status = buildStatus(row.start_date, row.start_time, row.end_date, row.end_time)

      return {
        id: row.id,
        title: row.title?.trim() || 'Untitled trip sheet',
        startDate: row.start_date,
        startTime: row.start_time,
        endDate: row.end_date,
        endTime: row.end_time,
        parentTripTitle: trip.title?.trim() || 'Untitled trip',
        destination: getDestinationName(trip.destination_ref, 'Unknown destination') || 'Unknown destination',
        guestName: trip.guest_name?.trim() || '-',
        phoneNumber: trip.phone_number?.trim() || '',
        company: trip.company?.trim() || '',
        status,
        sortTimestamp: getSortTimestamp(row.start_date, row.start_time, row.end_date, row.end_time),
      } satisfies TripSheetCardItem
    })
    .filter((item): item is TripSheetCardItem => item !== null)
}

function sortTripSheetGroups(items: TripSheetCardItem[]) {
  return {
    ongoing: items
      .filter((item) => item.status === 'ongoing')
      .sort((left, right) => left.sortTimestamp - right.sortTimestamp),
    upcoming: items
      .filter((item) => item.status === 'upcoming')
      .sort((left, right) => left.sortTimestamp - right.sortTimestamp),
    past: items
      .filter((item) => item.status === 'past')
      .sort((left, right) => right.sortTimestamp - left.sortTimestamp),
  }
}

function TripSheetCard({ item }: { item: TripSheetCardItem }) {
  const phoneHref = item.phoneNumber ? buildPhoneHref(item.phoneNumber) : ''
  const detailHref = `/my-trip-sheets/${item.id}`

  return (
    <article className="group rounded-2xl border border-zinc-200 bg-white px-4 py-3.5 shadow-sm transition focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-zinc-400 hover:border-zinc-300 hover:shadow-md">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <div className="min-w-0">
            <Link
              href={detailHref}
              className="inline-flex min-h-9 items-center text-base font-semibold leading-6 text-gray-900 underline decoration-transparent underline-offset-2 transition hover:text-gray-700 hover:decoration-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
            >
              {item.title}
            </Link>
            <p className="mt-0.5 text-sm text-gray-600">
              <span className="text-gray-500">Trip:</span> {item.parentTripTitle}
            </p>
          </div>
        </div>

        <div className="space-y-0.5">
          <p className="text-sm font-medium text-gray-900">
            {formatDateLabel(item.startDate, item.endDate)}
          </p>
          <p className="text-sm text-gray-700">
            {formatTimeLabel(item.startTime, item.endTime)}
          </p>
        </div>

        <dl className="space-y-2 text-sm">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <div className="min-w-[9rem] flex-1">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                Customer
              </dt>
              <dd className="mt-0.5 text-gray-900">{item.guestName}</dd>
            </div>

            <div className="min-w-[8.5rem] flex-1">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                Phone
              </dt>
              <dd className="mt-0.5">
                {phoneHref ? (
                  <a
                    href={phoneHref}
                    className="inline-flex min-h-9 items-center font-medium text-gray-900 underline decoration-zinc-300 underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
                  >
                    {item.phoneNumber}
                  </a>
                ) : (
                  <span className="text-gray-900">-</span>
                )}
              </dd>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {item.company ? (
              <div className="min-w-[8.5rem] flex-1">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                  Company
                </dt>
                <dd className="mt-0.5 text-gray-900">{item.company}</dd>
              </div>
            ) : (
              <div className="min-w-[8.5rem] flex-1">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                  Company
                </dt>
                <dd className="mt-0.5 text-gray-900">-</dd>
              </div>
            )}

            <div className="min-w-[9rem] flex-1">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                Destination
              </dt>
              <dd className="mt-0.5 text-gray-900">{item.destination}</dd>
            </div>
          </div>
        </dl>

        <div className="flex items-center justify-between gap-3 border-t border-zinc-100 pt-2 text-sm">
          <span className={statusBadgeClass(item.status)}>
            {item.status === 'ongoing'
              ? 'Ongoing'
              : item.status === 'upcoming'
                ? 'Upcoming'
                : 'Past'}
          </span>
          <Link
            href={detailHref}
            className="inline-flex min-h-9 items-center font-medium text-gray-600 underline decoration-transparent underline-offset-2 transition hover:text-gray-900 hover:decoration-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
          >
            View Trip Sheet
          </Link>
        </div>
      </div>
    </article>
  )
}

function TripSheetSection({
  title,
  items,
}: {
  title: string
  items: TripSheetCardItem[]
}) {
  if (items.length === 0) {
    return null
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
          {title}
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          {items.length} trip sheet{items.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <TripSheetCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  )
}

export default async function MyTripSheetsPage() {
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
            'id, title, start_date, start_time, end_date, end_time, trip:trips!inner(id, title, destination_ref:destinations(name), guest_name, phone_number, company)'
          )
          .eq('is_archived', false)
          .in('id', tripSheetIds)
      : { data: [], error: null }

  const tripSheets = buildTripSheetItems((tripSheetData as AssignedTripSheetRow[] | null) ?? [])
  const groupedTripSheets = sortTripSheetGroups(tripSheets)
  const errorMessage = assignmentError?.message || tripSheetError?.message || null
  const hasTripSheets = tripSheets.length > 0

  return (
    <main className="app-page">
      <div className="app-shell app-card">
        <AdminNav current="my-trip-sheets" role={profile?.role} />

        <div className="app-page-header">
          <div>
            <h1 className="app-page-title">My Trip Sheets</h1>
            <p className="app-page-subtitle">
              See every trip sheet assigned to you in chronological order.
            </p>
          </div>
        </div>
        {errorMessage ? <p className="app-banner-error">{errorMessage}</p> : null}

        {hasTripSheets ? (
          <div className="space-y-6">
            <TripSheetSection title="Ongoing" items={groupedTripSheets.ongoing} />
            <TripSheetSection title="Upcoming" items={groupedTripSheets.upcoming} />
            <TripSheetSection title="Past" items={groupedTripSheets.past} />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center">
            <p className="text-base font-medium text-gray-900">No trip sheets assigned yet.</p>
          </div>
        )}
      </div>
    </main>
  )
}
