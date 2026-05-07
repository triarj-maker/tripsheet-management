import { redirect } from 'next/navigation'

import AdminNav from '@/app/dashboard/AdminNav'
import { type DestinationRelation } from '@/lib/trip-sheets'
import { createAdminClient } from '@/lib/supabase/admin'

import ArchiveTripButton from '../../ArchiveTripButton'
import RestoreTripButton from '../../RestoreTripButton'
import TripForm from '../../TripForm'
import { updateTrip } from '../../actions'
import { requireAdmin } from '../../../lib'

type EditTripPageProps = {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    error?: string
  }>
}

type TripRow = {
  id: string
  title: string | null
  trip_type: string | null
  destination_id: string | null
  company_id: string | null
  school_id: string | null
  trip_color: string | null
  adult_count: number | null
  kid_count: number | null
  start_date: string | null
  end_date: string | null
  is_archived: boolean | null
  workflow_state: string | null
  destination_ref: DestinationRelation
  guest_name: string | null
  company: string | null
  phone_number: string | null
}

type TripSheetSummaryRow = {
  id: string
  title: string | null
  start_date: string | null
  end_date: string | null
  is_archived: boolean | null
}

type DestinationOption = {
  id: string
  name: string | null
  is_active: boolean | null
}

type LookupOption = DestinationOption

function buildTripsRedirect(error: string) {
  const params = new URLSearchParams({ error })
  return `/dashboard/trips?${params.toString()}`
}

export default async function EditTripPage({
  params,
  searchParams,
}: EditTripPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const { supabase } = await requireAdmin()

  const { data, error } = await supabase
    .from('trips')
    .select(
      'id, title, trip_type, destination_id, company_id, school_id, trip_color, adult_count, kid_count, start_date, end_date, is_archived, workflow_state, destination_ref:destinations(name), company_ref:companies(name), school_ref:schools(name), guest_name, company, phone_number'
    )
    .eq('id', id)
    .maybeSingle()

  const trip = (data as TripRow | null) ?? null

  if (!trip) {
    redirect(buildTripsRedirect(error?.message ?? 'Trip not found.'))
  }

  const { data: tripSheetData, error: tripSheetsError } = await supabase
    .from('trip_sheets')
    .select('id, title, start_date, end_date, is_archived')
    .eq('trip_id', id)
    .order('start_date', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: true })

  const tripSheets = (tripSheetData as TripSheetSummaryRow[] | null) ?? []
  const hasChildTripSheets = tripSheets.length > 0
  const { data: destinationData, error: destinationsError } = await supabase
    .from('destinations')
    .select('id, name, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true })

  let destinations = (destinationData as DestinationOption[] | null) ?? []

  const { data: schoolData, error: schoolsError } = await supabase
    .from('schools')
    .select('id, name, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true })

  let schools = (schoolData as LookupOption[] | null) ?? []

  const { data: companyData, error: companiesError } = await supabase
    .from('companies')
    .select('id, name, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true })

  let companies = (companyData as LookupOption[] | null) ?? []

  if (
    trip.destination_id &&
    !destinations.some((destination) => destination.id === trip.destination_id)
  ) {
    try {
      const adminClient = createAdminClient()
      const { data: selectedDestinationData } = await adminClient
        .from('destinations')
        .select('id, name, is_active')
        .eq('id', trip.destination_id)
        .maybeSingle()

      const selectedDestination = (selectedDestinationData as DestinationOption | null) ?? null

      if (selectedDestination) {
        destinations = [...destinations, selectedDestination].sort((left, right) =>
          (left.name ?? '').localeCompare(right.name ?? '')
        )
      }
    } catch {}
  }

  if (trip.school_id && !schools.some((school) => school.id === trip.school_id)) {
    const { data: selectedSchoolData } = await supabase
      .from('schools')
      .select('id, name, is_active')
      .eq('id', trip.school_id)
      .maybeSingle()
    const selectedSchool = (selectedSchoolData as LookupOption | null) ?? null

    if (selectedSchool) {
      schools = [...schools, selectedSchool].sort((left, right) =>
        (left.name ?? '').localeCompare(right.name ?? '')
      )
    }
  }

  if (trip.company_id && !companies.some((company) => company.id === trip.company_id)) {
    const { data: selectedCompanyData } = await supabase
      .from('companies')
      .select('id, name, is_active')
      .eq('id', trip.company_id)
      .maybeSingle()
    const selectedCompany = (selectedCompanyData as LookupOption | null) ?? null

    if (selectedCompany) {
      companies = [...companies, selectedCompany].sort((left, right) =>
        (left.name ?? '').localeCompare(right.name ?? '')
      )
    }
  }

  return (
    <>
      <AdminNav current="trips" />

      <div className="app-page-header">
        <div>
          <h1 className="app-page-title">Edit Trip</h1>
          <p className="app-page-subtitle">
            Update the parent trip metadata used across its child trip sheets.
          </p>
        </div>
      </div>

      {query.error ? <p className="app-banner-error">{query.error}</p> : null}
      {destinationsError ? <p className="app-banner-error">{destinationsError.message}</p> : null}
      {schoolsError ? <p className="app-banner-error">{schoolsError.message}</p> : null}
      {companiesError ? <p className="app-banner-error">{companiesError.message}</p> : null}
      {tripSheetsError ? <p className="app-banner-error">{tripSheetsError.message}</p> : null}

      <TripForm
        mode="edit"
        initialValues={{
          id: trip.id,
          original_start_date: trip.start_date ?? '',
          original_end_date: trip.end_date ?? '',
          title: trip.title ?? '',
          trip_type: trip.trip_type ?? '',
          destination_id: trip.destination_id ?? '',
          company_id: trip.company_id ?? '',
          school_id: trip.school_id ?? '',
          trip_color: trip.trip_color ?? '',
          adult_count: String(trip.adult_count ?? 0),
          kid_count: String(trip.kid_count ?? 0),
          start_date: trip.start_date ?? '',
          end_date: trip.end_date ?? '',
          guest_name: trip.guest_name ?? '',
          company: trip.company ?? '',
          phone_number: trip.phone_number ?? '',
          workflow_state: trip.workflow_state === 'tentative' ? 'tentative' : 'active',
          has_child_trip_sheets: hasChildTripSheets,
          child_trip_sheets: tripSheets.map((tripSheet) => ({
            id: tripSheet.id,
            title: tripSheet.title ?? 'Untitled trip sheet',
            start_date: tripSheet.start_date ?? '',
            end_date: tripSheet.end_date ?? '',
          })),
        }}
        destinations={destinations.map((destination) => ({
          id: destination.id,
          name: destination.name ?? destination.id,
        }))}
        schools={schools.map((school) => ({
          id: school.id,
          name: school.name ?? school.id,
        }))}
        companies={companies.map((company) => ({
          id: company.id,
          name: company.name ?? company.id,
        }))}
        submitAction={updateTrip}
        cancelHref={`/dashboard/trips/${trip.id}`}
        footerLeadingContent={
          trip.is_archived ? (
            <RestoreTripButton
              tripId={trip.id}
              returnPath={`/dashboard/trips/${trip.id}`}
              idleLabel="Unarchive Trip"
              pendingLabel="Unarchiving…"
              confirmMessage="Unarchive this trip and all of its child trip sheets?"
            />
          ) : (
            <ArchiveTripButton
              tripId={trip.id}
              returnPath={`/dashboard/trips/${trip.id}`}
              idleLabel="Archive Trip"
              pendingLabel="Archiving…"
              confirmMessage="Archive this trip and all of its child trip sheets?"
            />
          )
        }
      />
    </>
  )
}
