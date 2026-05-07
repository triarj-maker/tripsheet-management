import AdminNav from '@/app/dashboard/AdminNav'
import {
  formatTripTypeLabel,
  getDestinationName,
  getLookupName,
  normalizeTripTypeInput,
  type DestinationRelation,
  type LookupNameRelation,
} from '@/lib/trip-sheets'

import { requireAdmin } from '../../lib'
import ReferenceTripCloneForm, { type ReferenceTripOption } from './ReferenceTripCloneForm'

type CloneTripPageProps = {
  searchParams: Promise<{
    error?: string
  }>
}

type ArchivedReferenceTripRow = {
  id: string
  title: string | null
  trip_type: string | null
  destination_ref: DestinationRelation
  company_id: string | null
  school_id: string | null
  company_ref: LookupNameRelation
  school_ref: LookupNameRelation
}

type LookupOption = {
  id: string
  name: string | null
}

export default async function CloneTripPage({ searchParams }: CloneTripPageProps) {
  const params = await searchParams
  const { supabase } = await requireAdmin()

  const { data, error } = await supabase
    .from('trips')
    .select('id, title, trip_type, destination_ref:destinations(name), company_id, school_id, company_ref:companies(name), school_ref:schools(name)')
    .eq('is_archived', true)
    .order('title', { ascending: true })

  const referenceTrips: ReferenceTripOption[] =
    ((data as ArchivedReferenceTripRow[] | null) ?? []).map((trip) => ({
      id: trip.id,
      title: trip.title?.trim() || 'Untitled trip',
      tripType: normalizeTripTypeInput(trip.trip_type ?? ''),
      tripTypeLabel: formatTripTypeLabel(trip.trip_type),
      destinationName:
        getDestinationName(trip.destination_ref, 'Unknown destination') ??
        'Unknown destination',
      companyId: trip.company_id ?? '',
      schoolId: trip.school_id ?? '',
    }))

  const { data: schoolData, error: schoolsError } = await supabase
    .from('schools')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true })

  let schools = (schoolData as LookupOption[] | null) ?? []

  const { data: companyData, error: companiesError } = await supabase
    .from('companies')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true })

  let companies = (companyData as LookupOption[] | null) ?? []

  for (const trip of (data as ArchivedReferenceTripRow[] | null) ?? []) {
    if (trip.school_id && !schools.some((school) => school.id === trip.school_id)) {
      schools = [
        ...schools,
        {
          id: trip.school_id,
          name: getLookupName(trip.school_ref, trip.school_id),
        },
      ]
    }

    if (
      trip.company_id &&
      !companies.some((company) => company.id === trip.company_id)
    ) {
      companies = [
        ...companies,
        {
          id: trip.company_id,
          name: getLookupName(trip.company_ref, trip.company_id),
        },
      ]
    }
  }

  schools = schools.sort((left, right) =>
    (left.name ?? '').localeCompare(right.name ?? '')
  )
  companies = companies.sort((left, right) =>
    (left.name ?? '').localeCompare(right.name ?? '')
  )

  return (
    <>
      <AdminNav current="trips" />

      <div className="app-page-header">
        <div>
          <h1 className="app-page-title">Create Trip from Reference</h1>
          <p className="app-page-subtitle">
            Use an archived trip as a structural reference for a fresh parent trip.
          </p>
        </div>
      </div>

      {error ? <p className="app-banner-error">{error.message}</p> : null}
      {schoolsError ? <p className="app-banner-error">{schoolsError.message}</p> : null}
      {companiesError ? <p className="app-banner-error">{companiesError.message}</p> : null}

      {referenceTrips.length === 0 ? (
        <p className="app-section-card text-sm text-gray-700">
          No archived trips are available to use as references yet.
        </p>
      ) : (
        <ReferenceTripCloneForm
          referenceTrips={referenceTrips}
          schools={schools.map((school) => ({
            id: school.id,
            name: school.name ?? school.id,
          }))}
          companies={companies.map((company) => ({
            id: company.id,
            name: company.name ?? company.id,
          }))}
          errorMessage={params.error}
        />
      )}
    </>
  )
}
