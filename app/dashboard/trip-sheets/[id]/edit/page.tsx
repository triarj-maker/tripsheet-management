import Link from 'next/link'
import { redirect } from 'next/navigation'

import AdminNav from '@/app/dashboard/AdminNav'
import {
  assignResourceToTripSheet,
  removeResourceFromTripSheet,
  updateTripSheet,
} from '../../actions'
import { requireAdmin } from '../../lib'

import ArchiveTripSheetButton from './ArchiveTripSheetButton'

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
  title: string | null
  destination: string | null
  start_date: string | null
  end_date: string | null
  guest_name: string | null
  company: string | null
  phone_number: string | null
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
}

function buildTripSheetsRedirect(error: string) {
  const params = new URLSearchParams({ error })
  return `/dashboard/trip-sheets?${params.toString()}`
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
      'id, title, destination, start_date, end_date, guest_name, company, phone_number, body_text'
    )
    .eq('id', id)
    .maybeSingle()

  const tripSheet = (data as TripSheet | null) ?? null

  if (!tripSheet) {
    redirect(buildTripSheetsRedirect(error?.message ?? 'Trip sheet not found.'))
  }

  const { data: assignmentData, error: assignmentError } = await supabase
    .from('trip_sheet_assignments')
    .select('id, resource_user_id')
    .eq('trip_sheet_id', id)
    .order('assigned_at', { ascending: true })

  const assignments = (assignmentData as Assignment[] | null) ?? []
  const assignedResourceIds = assignments.map((assignment) => assignment.resource_user_id)

  const { data: activeResourceData, error: activeResourcesError } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone')
    .eq('role', 'resource')
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  const activeResources = (activeResourceData as ResourceProfile[] | null) ?? []

  const { data: assignedProfilesData, error: assignedProfilesError } =
    assignedResourceIds.length > 0
      ? await supabase
          .from('profiles')
          .select('id, full_name, email, phone')
          .in('id', assignedResourceIds)
      : { data: [], error: null }

  const assignedProfiles = (assignedProfilesData as ResourceProfile[] | null) ?? []
  const assignedProfilesById = new Map(
    assignedProfiles.map((profile) => [profile.id, profile])
  )
  const assignedResources = assignments.map((assignment) => ({
    assignmentId: assignment.id,
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
    <main className="min-h-screen bg-zinc-100 px-4 py-12">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-sm">
        <AdminNav current="trip-sheets" />

        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Edit Trip Sheet</h1>
        </div>

        {query.error ? (
          <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {query.error}
          </p>
        ) : null}

        {assignmentSectionError ? (
          <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {assignmentSectionError}
          </p>
        ) : null}

        <form action={updateTripSheet} className="space-y-4">
          <input type="hidden" name="id" value={tripSheet.id} />

          <div>
            <label htmlFor="title" className="mb-1 block text-sm font-medium text-gray-700">
              Title
            </label>
            <input
              id="title"
              name="title"
              type="text"
              defaultValue={tripSheet.title ?? ''}
              required
              className="w-full rounded border border-zinc-300 px-3 py-2 text-gray-900 placeholder:text-gray-400"
            />
          </div>

          <div>
            <label
              htmlFor="destination"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Destination
            </label>
            <input
              id="destination"
              name="destination"
              type="text"
              defaultValue={tripSheet.destination ?? ''}
              required
              className="w-full rounded border border-zinc-300 px-3 py-2 text-gray-900 placeholder:text-gray-400"
            />
          </div>

          <div>
            <label
              htmlFor="start_date"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Start Date
            </label>
            <input
              id="start_date"
              name="start_date"
              type="date"
              defaultValue={tripSheet.start_date ?? ''}
              required
              className="w-full rounded border border-zinc-300 px-3 py-2 text-gray-900 placeholder:text-gray-400"
            />
          </div>

          <div>
            <label htmlFor="end_date" className="mb-1 block text-sm font-medium text-gray-700">
              End Date
            </label>
            <input
              id="end_date"
              name="end_date"
              type="date"
              defaultValue={tripSheet.end_date ?? ''}
              required
              className="w-full rounded border border-zinc-300 px-3 py-2 text-gray-900 placeholder:text-gray-400"
            />
          </div>

          <div>
            <label
              htmlFor="guest_name"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Guest Name
            </label>
            <input
              id="guest_name"
              name="guest_name"
              type="text"
              defaultValue={tripSheet.guest_name ?? ''}
              required
              className="w-full rounded border border-zinc-300 px-3 py-2 text-gray-900 placeholder:text-gray-400"
            />
          </div>

          <div>
            <label htmlFor="company" className="mb-1 block text-sm font-medium text-gray-700">
              Company
            </label>
            <input
              id="company"
              name="company"
              type="text"
              defaultValue={tripSheet.company ?? ''}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-gray-900 placeholder:text-gray-400"
            />
          </div>

          <div>
            <label
              htmlFor="phone_number"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Phone Number
            </label>
            <input
              id="phone_number"
              name="phone_number"
              type="tel"
              defaultValue={tripSheet.phone_number ?? ''}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-gray-900 placeholder:text-gray-400"
            />
          </div>

          <div>
            <label htmlFor="body" className="mb-1 block text-sm font-medium text-gray-700">
              Body
            </label>
            <textarea
              id="body"
              name="body"
              rows={14}
              defaultValue={tripSheet.body_text ?? ''}
              required
              className="w-full rounded border border-zinc-300 px-3 py-2 text-gray-900 placeholder:text-gray-400"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-gray-900"
            >
              Save Changes
            </button>
            <Link
              href={`/dashboard/trip-sheets/new?duplicateFrom=${tripSheet.id}`}
              className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-gray-900"
            >
              Duplicate
            </Link>
            <Link
              href="/dashboard/trip-sheets"
              className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-gray-900"
            >
              Cancel
            </Link>
          </div>
        </form>

        <div className="mt-6 border-t border-zinc-200 pt-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Assigned Resources
          </h2>

          <div className="mb-6 space-y-3">
            {assignedResources.length === 0 ? (
              <p className="text-sm text-gray-700">No resources assigned yet.</p>
            ) : (
              assignedResources.map(({ assignmentId, profile }) => (
                <div
                  key={assignmentId}
                  className="flex items-start justify-between gap-4 rounded border border-zinc-200 px-4 py-3"
                >
                  <div className="space-y-1 text-sm text-gray-900">
                    <p>{profile?.full_name ?? '-'}</p>
                    <p>{profile?.email ?? '-'}</p>
                    <p>{profile?.phone ?? '-'}</p>
                  </div>

                  <form action={removeResourceFromTripSheet}>
                    <input type="hidden" name="trip_sheet_id" value={tripSheet.id} />
                    <input type="hidden" name="assignment_id" value={assignmentId} />
                    <button
                      type="submit"
                      className="rounded border border-zinc-300 px-3 py-1 text-sm font-medium text-gray-900"
                    >
                      Remove
                    </button>
                  </form>
                </div>
              ))
            )}
          </div>

          <form action={assignResourceToTripSheet} className="space-y-4">
            <input type="hidden" name="trip_sheet_id" value={tripSheet.id} />

            <div>
              <label
                htmlFor="resource_user_id"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Assign Resource
              </label>
              <select
                id="resource_user_id"
                name="resource_user_id"
                required
                className="w-full rounded border border-zinc-300 px-3 py-2 text-gray-900"
              >
                <option value="">Select a resource</option>
                {availableResources.map((resource) => (
                  <option key={resource.id} value={resource.id}>
                    {resource.full_name ?? resource.email ?? resource.id}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-gray-900"
            >
              Assign Resource
            </button>
          </form>
        </div>

        <div className="mt-6 border-t border-zinc-200 pt-6">
          <ArchiveTripSheetButton tripSheetId={tripSheet.id} />
        </div>
      </div>
    </main>
  )
}
