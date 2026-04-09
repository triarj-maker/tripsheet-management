import { redirect } from 'next/navigation'

import AdminNav from '@/app/dashboard/AdminNav'
import ActionSubmitButton from '@/app/components/ActionSubmitButton'
import DeleteTripSheetButton from '@/app/dashboard/trip-sheets/DeleteTripSheetButton'
import DuplicateTripSheetButton from '@/app/dashboard/trip-sheets/DuplicateTripSheetButton'
import {
  getDestinationName,
  getTripParent,
  type TripParentRelation,
} from '@/lib/trip-sheets'
import {
  assignResourceToTripSheet,
  removeResourceFromTripSheet,
} from '../../actions'
import { requireAdmin } from '../../lib'

import EditTripSheetForm from './EditTripSheetForm'

type EditTripSheetPageProps = {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    error?: string
  }>
}

type TripSheet = {
  id: string
  trip_id: string | null
  trip: TripParentRelation
  title: string | null
  start_date: string | null
  start_time: string | null
  end_date: string | null
  end_time: string | null
  template_id: string | null
  transportation_info: string | null
  template:
    | {
        title: string | null
      }
    | Array<{
        title: string | null
      }>
    | null
  body_text: string | null
}

type Assignment = {
  id: string
  resource_user_id: string
}

type ResourceProfile = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  role: string | null
}

function buildTripsRedirect(error: string) {
  const params = new URLSearchParams({ error })
  return `/dashboard/trips?${params.toString()}`
}

function formatAssignableLabel(resource: ResourceProfile) {
  const baseLabel = resource.full_name ?? resource.email ?? resource.id
  const roleLabel = resource.role === 'admin' ? 'Admin' : 'Resource'

  return `${baseLabel} (${roleLabel})`
}

export default async function EditTripSheetPage({
  params,
  searchParams,
}: EditTripSheetPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const { supabase } = await requireAdmin()

  const { data, error } = await supabase
    .from('trip_sheets')
    .select(
      'id, trip_id, trip:trips(id, title, trip_type, destination_id, destination_ref:destinations(name)), title, start_date, start_time, end_date, end_time, template_id, template:trip_templates(title), body_text, transportation_info'
    )
    .eq('id', id)
    .maybeSingle()

  const tripSheet = (data as TripSheet | null) ?? null

  if (!tripSheet) {
    redirect(buildTripsRedirect(error?.message ?? 'Trip sheet not found.'))
  }

  const trip = getTripParent(tripSheet.trip)
  const template = getTripParent(tripSheet.template)

  if (!trip) {
    redirect(buildTripsRedirect('Parent trip not found.'))
  }

  const { data: assignmentData, error: assignmentError } = await supabase
    .from('trip_sheet_assignments')
    .select('id, resource_user_id')
    .eq('trip_sheet_id', id)
    .order('created_at', { ascending: true })

  const assignments = (assignmentData as Assignment[] | null) ?? []
  const assignedResourceIds = assignments.map((assignment) => assignment.resource_user_id)

  const { data: activeResourceData, error: activeResourcesError } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, role')
    .in('role', ['resource', 'admin'])
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  const activeResources = (activeResourceData as ResourceProfile[] | null) ?? []

  const { data: assignedProfilesData, error: assignedProfilesError } =
    assignedResourceIds.length > 0
      ? await supabase
          .from('profiles')
          .select('id, full_name, email, phone, role')
          .in('id', assignedResourceIds)
      : { data: [], error: null }

  const assignedProfiles = (assignedProfilesData as ResourceProfile[] | null) ?? []
  const assignedProfilesById = new Map(
    assignedProfiles.map((profile) => [profile.id, profile])
  )
  const assignedResources = assignments.map((assignment) => ({
    assignmentId: assignment.id,
    resourceUserId: assignment.resource_user_id,
    profile: assignedProfilesById.get(assignment.resource_user_id) ?? null,
  }))
  const availableResources = activeResources.filter(
    (resource) => !assignedResourceIds.includes(resource.id)
  )

  const assignmentSectionError =
    assignmentError?.message ||
    activeResourcesError?.message ||
    assignedProfilesError?.message ||
    null

  return (
    <>
      <AdminNav current="trips" />

      <div className="app-page-header">
        <div>
          <h1 className="app-page-title">Edit Trip Sheet</h1>
          <p className="app-page-subtitle">
            Update the execution details and assignments for this child trip sheet.
          </p>
        </div>
      </div>

      {query.error ? <p className="app-banner-error">{query.error}</p> : null}

      {assignmentSectionError ? (
        <p className="app-banner-error">{assignmentSectionError}</p>
      ) : null}

      <div className="space-y-5">
        <EditTripSheetForm
          tripSheet={{
            id: tripSheet.id,
            trip_id: tripSheet.trip_id ?? trip.id,
            title: tripSheet.title,
            start_date: tripSheet.start_date,
            start_time: tripSheet.start_time,
            end_date: tripSheet.end_date,
            end_time: tripSheet.end_time,
            body_text: tripSheet.body_text,
            transportation_info: tripSheet.transportation_info,
            templateTitle: template?.title ?? null,
          }}
          trip={{
            id: trip.id,
            title: trip.title,
            trip_type: trip.trip_type,
            destination:
              getDestinationName(trip.destination_ref, 'Unknown destination') ??
              'Unknown destination',
          }}
        />

        <div className="flex flex-wrap items-center gap-2.5">
          <DuplicateTripSheetButton
            tripSheetId={tripSheet.id}
            tripId={trip.id}
          />
        </div>

        <section className="app-section-card space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Assigned Resources</h2>
            <p className="mt-1 text-sm text-gray-600">
              Manage the resources currently assigned to this trip sheet.
            </p>
          </div>

          <div className="space-y-2.5">
            {assignedResources.length === 0 ? (
              <p className="text-sm text-gray-700">No resources assigned yet.</p>
            ) : (
              assignedResources.map(({ assignmentId, profile }) => (
                <div
                  key={assignmentId}
                  className="flex items-start justify-between gap-4 rounded-lg border border-zinc-200 px-3 py-2.5"
                >
                  <div className="space-y-0.5 text-sm text-gray-900">
                    <p>{profile?.full_name ?? '-'}</p>
                    <p>{profile?.email ?? '-'}</p>
                    <p>{profile?.phone ?? '-'}</p>
                  </div>

                  <form action={removeResourceFromTripSheet}>
                    <input type="hidden" name="trip_sheet_id" value={tripSheet.id} />
                    <input type="hidden" name="assignment_id" value={assignmentId} />
                    <ActionSubmitButton
                      idleLabel="Remove"
                      pendingLabel="Removing…"
                      className="ui-button-secondary ui-button-compact"
                    />
                  </form>
                </div>
              ))
            )}
          </div>

          <form
            action={assignResourceToTripSheet}
            className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"
          >
            <input type="hidden" name="trip_sheet_id" value={tripSheet.id} />

            <div>
              <label htmlFor="resource_user_id" className="ui-label">Assign Resource</label>
              <select
                id="resource_user_id"
                name="resource_user_id"
                required
                className="ui-select ui-select-compact"
              >
                <option value="">Select a resource</option>
                {availableResources.map((resource) => (
                  <option key={resource.id} value={resource.id}>
                    {formatAssignableLabel(resource)}
                  </option>
                ))}
              </select>
            </div>

            <ActionSubmitButton
              idleLabel="Assign Resource"
              pendingLabel="Assigning…"
              className="ui-button-primary ui-button-compact md:min-w-[9rem]"
            />
          </form>
        </section>

      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <DeleteTripSheetButton tripSheetId={tripSheet.id} tripId={trip.id} />
      </div>
    </>
  )
}
