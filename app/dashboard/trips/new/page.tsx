import AdminNav from '@/app/dashboard/AdminNav'
import {
  buildDuplicatedTripTitle,
  toTripTypeFormValue,
} from '@/lib/trip-sheets'

import CreateTripFlowForm from '../CreateTripFlowForm'
import { createTrip } from '../actions'
import { requireAdmin } from '../../lib'
import { guestOrCompanyRequiredMessage } from '../../trip-sheets/validation'

type NewTripPageProps = {
  searchParams: Promise<{
    error?: string
    cloneFrom?: string
  }>
}

type DestinationOption = {
  id: string
  name: string | null
}

type TripTemplate = {
  id: string
  title: string | null
  body: string | null
}

type ResourceProfile = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  role: string | null
}

type SourceTrip = {
  id: string
  title: string | null
  trip_type: string | null
  destination_id: string | null
  trip_color: string | null
  adult_count: number | null
  kid_count: number | null
  guest_name: string | null
  company: string | null
  phone_number: string | null
  start_date: string | null
  end_date: string | null
}

type CloneTripSheetSummary = {
  id: string
  title: string | null
  start_date: string | null
  start_time: string | null
  end_date: string | null
  end_time: string | null
}

export default async function NewTripPage({ searchParams }: NewTripPageProps) {
  const params = await searchParams
  const { supabase } = await requireAdmin()
  const cloneFromId = params.cloneFrom?.trim() ?? ''

  const { data, error } = await supabase
    .from('destinations')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true })

  const destinations = (data as DestinationOption[] | null) ?? []

  const { data: templateData, error: templatesError } = await supabase
    .from('trip_templates')
    .select('id, title, body')
    .order('title', { ascending: true })

  const tripTemplates = (templateData as TripTemplate[] | null) ?? []

  const { data: resourceData, error: resourcesError } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, role')
    .in('role', ['resource', 'admin'])
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  const availableResources = (resourceData as ResourceProfile[] | null) ?? []

  let initialTripValues:
    | {
        title: string
        trip_type: string
        destination_id: string
        trip_color: string
        adult_count: string
        kid_count: string
        guest_name: string
        company: string
        phone_number: string
        start_date: string
        end_date: string
      }
    | undefined
  let cloneSource:
    | {
        tripId: string
        originalStartDate: string
        tripSheets: Array<{
          id: string
          title: string
          start_date: string
          start_time: string
          end_date: string
          end_time: string
        }>
      }
    | undefined

  if (cloneFromId) {
    const { data: sourceTripData, error: sourceTripError } = await supabase
      .from('trips')
      .select(
        'id, title, trip_type, destination_id, trip_color, adult_count, kid_count, guest_name, company, phone_number, start_date, end_date'
      )
      .eq('id', cloneFromId)
      .maybeSingle()

    const sourceTrip = (sourceTripData as SourceTrip | null) ?? null

    if (!sourceTrip) {
      return (
        <>
          <AdminNav current="trips" />
          <p className="app-banner-error">
            {sourceTripError?.message ?? 'Trip to clone was not found.'}
          </p>
        </>
      )
    }

    const { data: sourceTripSheetData, error: sourceTripSheetsError } = await supabase
      .from('trip_sheets')
      .select('id, title, start_date, start_time, end_date, end_time')
      .eq('trip_id', sourceTrip.id)
      .order('start_date', { ascending: true })
      .order('start_time', { ascending: true, nullsFirst: true })

    if (sourceTripSheetsError) {
      return (
        <>
          <AdminNav current="trips" />
          <p className="app-banner-error">{sourceTripSheetsError.message}</p>
        </>
      )
    }

    const sourceTripSheets = (sourceTripSheetData as CloneTripSheetSummary[] | null) ?? []

    initialTripValues = {
      title: buildDuplicatedTripTitle(sourceTrip.title),
      trip_type: toTripTypeFormValue(sourceTrip.trip_type),
      destination_id: sourceTrip.destination_id ?? '',
      trip_color: sourceTrip.trip_color ?? '',
      adult_count: String(sourceTrip.adult_count ?? 0),
      kid_count: String(sourceTrip.kid_count ?? 0),
      guest_name: sourceTrip.guest_name ?? '',
      company: sourceTrip.company ?? '',
      phone_number: sourceTrip.phone_number ?? '',
      start_date: sourceTrip.start_date ?? '',
      end_date: sourceTrip.end_date ?? '',
    }

    cloneSource = {
      tripId: sourceTrip.id,
      originalStartDate: sourceTrip.start_date ?? '',
      tripSheets: sourceTripSheets.map((tripSheet) => ({
        id: tripSheet.id,
        title: tripSheet.title ?? 'Untitled trip sheet',
        start_date: tripSheet.start_date ?? '',
        start_time: tripSheet.start_time ?? '',
        end_date: tripSheet.end_date ?? '',
        end_time: tripSheet.end_time ?? '',
      })),
    }
  }

  return (
    <>
      <AdminNav current="trips" />

      <div className="app-page-header">
        <div>
          <h1 className="app-page-title">
            {cloneSource ? 'Clone Trip' : 'Create Trip'}
          </h1>
          <p className="app-page-subtitle">
            {cloneSource
              ? 'Review the parent trip details. Child trip sheets will be duplicated under the new trip when you save.'
              : 'Create the parent trip and its first child trip sheet in one compact flow.'}
          </p>
        </div>
      </div>

      {params.error && params.error !== guestOrCompanyRequiredMessage ? (
        <p className="app-banner-error">{params.error}</p>
      ) : null}
      {error ? <p className="app-banner-error">{error.message}</p> : null}
      {templatesError ? <p className="app-banner-error">{templatesError.message}</p> : null}
      {resourcesError ? <p className="app-banner-error">{resourcesError.message}</p> : null}

      {destinations.length === 0 ? (
        <p className="text-sm text-gray-700">No destinations are available yet.</p>
      ) : (
        <CreateTripFlowForm
          destinations={destinations.map((destination) => ({
            id: destination.id,
            name: destination.name ?? destination.id,
          }))}
          tripTemplates={tripTemplates}
          availableResources={availableResources}
          submitAction={createTrip}
          cancelHref="/dashboard/trips"
          errorMessage={params.error}
          initialTripValues={initialTripValues}
          cloneSource={cloneSource}
        />
      )}
    </>
  )
}
