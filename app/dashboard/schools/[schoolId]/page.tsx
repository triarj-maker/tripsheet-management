import Link from 'next/link'
import { notFound } from 'next/navigation'

import ActionSubmitButton from '@/app/components/ActionSubmitButton'
import AdminNav from '@/app/dashboard/AdminNav'
import { requireAdmin } from '@/app/dashboard/lib'
import { getCurrentDateStringInAppTimeZone } from '@/lib/time'
import {
  formatTripTypeLabel,
  getDestinationName,
  type DestinationRelation,
} from '@/lib/trip-sheets'
import {
  formatVisibleTripStateLabel,
  getVisibleTripState,
  type VisibleTripState,
} from '@/lib/trip-workflow'

import { toggleSchoolActive, updateSchool } from '../actions'

type SchoolDetailPageProps = {
  params: Promise<{
    schoolId: string
  }>
  searchParams: Promise<{
    error?: string
  }>
}

type SchoolRow = {
  id: string
  name: string | null
  is_active: boolean | null
}

type TripRow = {
  id: string
  title: string | null
  start_date: string | null
  end_date: string | null
  workflow_state: string | null
  is_archived: boolean | null
  trip_type: string | null
  destination_ref: DestinationRelation
}

type TripSheetRow = {
  id: string
  trip_id: string | null
}

function statusBadgeClass(isActive: boolean) {
  return ['ui-badge', isActive ? 'ui-badge-green' : 'ui-badge-neutral'].join(' ')
}

function tripStateBadgeClass(state: VisibleTripState) {
  if (state === 'active') {
    return 'ui-badge ui-badge-green'
  }

  if (state === 'tentative') {
    return 'ui-badge ui-badge-blue'
  }

  return 'ui-badge ui-badge-neutral'
}

function formatDate(value: string | null) {
  if (!value) {
    return '-'
  }

  const [year, month, day] = value.split('-').map(Number)

  if (!year || !month || !day) {
    return value
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function buildTripSheetCounts(tripSheets: TripSheetRow[]) {
  const counts = new Map<string, number>()

  for (const tripSheet of tripSheets) {
    if (!tripSheet.trip_id) {
      continue
    }

    counts.set(tripSheet.trip_id, (counts.get(tripSheet.trip_id) ?? 0) + 1)
  }

  return counts
}

export default async function SchoolDetailPage({ params, searchParams }: SchoolDetailPageProps) {
  const [{ schoolId }, query] = await Promise.all([params, searchParams])
  const { supabase } = await requireAdmin()
  const today = getCurrentDateStringInAppTimeZone()
  const { data: schoolData, error: schoolError } = await supabase
    .from('schools')
    .select('id, name, is_active')
    .eq('id', schoolId)
    .maybeSingle()

  if (schoolError || !schoolData) {
    notFound()
  }

  const school = schoolData as SchoolRow
  const schoolName = school.name?.trim() || 'Untitled school'
  const isActive = school.is_active === true
  const returnPath = `/dashboard/schools/${school.id}`
  const { data: tripData, error: tripsError } = await supabase
    .from('trips')
    .select(
      'id, title, start_date, end_date, workflow_state, is_archived, trip_type, destination_ref:destinations(name)'
    )
    .eq('school_id', school.id)
    .order('start_date', { ascending: true })
  const trips = (tripData as TripRow[] | null) ?? []
  const tripIds = trips.map((trip) => trip.id)
  const { data: tripSheetData, error: tripSheetsError } =
    tripIds.length > 0
      ? await supabase
          .from('trip_sheets')
          .select('id, trip_id')
          .in('trip_id', tripIds)
      : { data: [], error: null }
  const tripSheetCounts = buildTripSheetCounts((tripSheetData as TripSheetRow[] | null) ?? [])
  const errorMessage = query.error || tripsError?.message || tripSheetsError?.message || null

  return (
    <>
      <AdminNav current="schools" />

      <div className="mb-4">
        <Link
          href="/dashboard/schools"
          className="inline-flex items-center text-sm font-medium text-gray-700 transition hover:text-gray-900"
        >
          Back to Schools
        </Link>
      </div>

      <div className="app-page-header">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="app-page-title">{schoolName}</h1>
            <span className={statusBadgeClass(isActive)}>
              {isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="app-page-subtitle">
            Manage this school and review trips linked by school ID.
          </p>
        </div>

        <form action={toggleSchoolActive}>
          <input type="hidden" name="id" value={school.id} />
          <input type="hidden" name="return_path" value={returnPath} />
          <input
            type="hidden"
            name="next_is_active"
            value={isActive ? 'false' : 'true'}
          />
          <ActionSubmitButton
            idleLabel={isActive ? 'Deactivate' : 'Activate'}
            pendingLabel="Saving..."
            className="ui-button-secondary"
          />
        </form>
      </div>

      {errorMessage ? <p className="app-banner-error">{errorMessage}</p> : null}

      <section className="app-section-card mb-5 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">School Details</h2>
          <p className="mt-1 text-sm text-gray-600">
            Update the school name used in trip forms and filters.
          </p>
        </div>

        <form
          action={updateSchool}
          className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"
        >
          <input type="hidden" name="id" value={school.id} />
          <input type="hidden" name="return_path" value={returnPath} />
          <input type="hidden" name="is_active" value={isActive ? 'on' : ''} />
          <div>
            <label htmlFor="school_name" className="ui-label">
              School name
            </label>
            <input
              id="school_name"
              name="name"
              type="text"
              required
              defaultValue={schoolName}
              className="ui-input ui-input-compact"
            />
          </div>
          <ActionSubmitButton
            idleLabel="Save"
            pendingLabel="Saving..."
            className="ui-button-primary ui-button-compact"
          />
        </form>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Status</p>
          <span className={`mt-1.5 ${statusBadgeClass(isActive)}`}>
            {isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Related Trips</h2>
          <p className="mt-1 text-sm text-gray-600">
            Trips linked to this school through <code>trips.school_id</code>.
          </p>
        </div>

        <div className="app-table-wrap">
          <table className="app-table">
            <thead>
              <tr>
                <th className="px-4 py-3 font-medium text-gray-700">Trip title</th>
                <th className="w-[9rem] px-4 py-3 font-medium text-gray-700">Start date</th>
                <th className="px-4 py-3 font-medium text-gray-700">Destination</th>
                <th className="w-[9rem] px-4 py-3 font-medium text-gray-700">Trip type</th>
                <th className="w-[9rem] px-4 py-3 font-medium text-gray-700">State</th>
                <th className="w-[8rem] px-4 py-3 font-medium text-gray-700">Trip Sheets</th>
                <th className="w-[9rem] px-4 py-3 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {trips.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-5 text-gray-700">
                    No trips linked to this school.
                  </td>
                </tr>
              ) : (
                trips.map((trip) => {
                  const state = getVisibleTripState({
                    workflowState: trip.workflow_state,
                    isArchived: trip.is_archived === true,
                    endDate: trip.end_date,
                    today,
                  })

                  return (
                    <tr key={trip.id} className="align-top">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {trip.title?.trim() || 'Untitled trip'}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{formatDate(trip.start_date)}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {getDestinationName(trip.destination_ref, 'Unknown destination')}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {formatTripTypeLabel(trip.trip_type)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={tripStateBadgeClass(state)}>
                          {formatVisibleTripStateLabel(state)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {tripSheetCounts.get(trip.id) ?? 0}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/trips/${trip.id}`}
                          className="ui-button ui-button-secondary ui-button-compact"
                        >
                          Open Trip
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
