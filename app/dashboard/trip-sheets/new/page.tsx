import { redirect } from 'next/navigation'

import AdminNav from '@/app/dashboard/AdminNav'
import {
  buildDuplicatedTripSheetTitle,
  getDestinationName,
  type DestinationRelation,
} from '@/lib/trip-sheets'

import TripSheetForm from './TripSheetForm'
import { requireAdmin } from '../lib'

type NewTripSheetPageProps = {
  searchParams: Promise<{
    error?: string
    duplicateFrom?: string
    tripId?: string
  }>
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

type TripRow = {
  id: string
  title: string | null
  trip_type: string | null
  start_date: string | null
  end_date: string | null
  destination_id: string | null
  destination_ref: DestinationRelation
  guest_name: string | null
  company: string | null
  phone_number: string | null
}

type DuplicateTripSheet = {
  trip_id: string | null
  title: string | null
  start_date: string | null
  start_time: string | null
  end_date: string | null
  end_time: string | null
  transportation_info: string | null
}

function buildTripsRedirect(error: string) {
  const params = new URLSearchParams({ error })
  return `/dashboard/trips?${params.toString()}`
}

export default async function NewTripSheetPage({
  searchParams,
}: NewTripSheetPageProps) {
  const params = await searchParams
  const { supabase } = await requireAdmin()

  const { data, error } = await supabase
    .from('trip_templates')
    .select('id, title, body')
    .order('title', { ascending: true })

  const tripTemplates = (data as TripTemplate[] | null) ?? []
  const { data: resourceData, error: resourceError } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, role')
    .in('role', ['resource', 'admin'])
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  const availableResources = (resourceData as ResourceProfile[] | null) ?? []

  let tripId = params.tripId?.trim() ?? ''

  if (!tripId && params.duplicateFrom) {
    const { data: sourceTripSheet } = await supabase
      .from('trip_sheets')
      .select('trip_id')
      .eq('id', params.duplicateFrom)
      .maybeSingle()

    tripId = ((sourceTripSheet as { trip_id: string | null } | null)?.trip_id ?? '').trim()
  }

  if (!tripId) {
    redirect(buildTripsRedirect('Select a trip before creating a trip sheet.'))
  }

  const { data: tripData, error: tripError } = await supabase
    .from('trips')
    .select(
      'id, title, trip_type, start_date, end_date, destination_id, destination_ref:destinations(name), guest_name, company, phone_number'
    )
    .eq('id', tripId)
    .maybeSingle()

  const trip = (tripData as TripRow | null) ?? null

  if (!trip) {
    redirect(buildTripsRedirect(tripError?.message ?? 'Trip not found.'))
  }

  let duplicateError: string | null = null
  let initialValues: {
    title: string
    start_date: string
    start_time: string
    end_date: string
    end_time: string
    template_id: string
    body: string
    transportation_info: string
  } | undefined

  if (params.duplicateFrom) {
    const { data: duplicateData, error: duplicateLoadError } = await supabase
      .from('trip_sheets')
      .select('trip_id, title, start_date, start_time, end_date, end_time, transportation_info')
      .eq('id', params.duplicateFrom)
      .maybeSingle()

    const duplicateTripSheet = (duplicateData as DuplicateTripSheet | null) ?? null

    if (duplicateLoadError) {
      duplicateError = duplicateLoadError.message
    } else if (!duplicateTripSheet) {
      duplicateError = 'Trip sheet to duplicate was not found.'
    } else if (duplicateTripSheet.trip_id && duplicateTripSheet.trip_id !== trip.id) {
      duplicateError = 'Trip sheet belongs to a different trip.'
    } else {
      initialValues = {
        title: buildDuplicatedTripSheetTitle(duplicateTripSheet.title),
        start_date: duplicateTripSheet.start_date ?? '',
        start_time: duplicateTripSheet.start_time ?? '',
        end_date: duplicateTripSheet.end_date ?? '',
        end_time: duplicateTripSheet.end_time ?? '',
        template_id: '',
        body: '',
        transportation_info: duplicateTripSheet.transportation_info ?? '',
      }
    }
  }

  return (
    <>
      <AdminNav current="trips" />

      <div className="app-page-header">
        <div>
          <h1 className="app-page-title">
            {params.duplicateFrom ? 'Duplicate Trip Sheet' : 'Add New Trip Sheet'}
          </h1>
          <p className="app-page-subtitle">
            Create an execution-specific trip sheet under the selected parent trip.
          </p>
        </div>
      </div>

      {params.error ? (
        <p className="app-banner-error">{params.error}</p>
      ) : null}

      {error ? <p className="app-banner-error">{error.message}</p> : null}
      {resourceError ? <p className="app-banner-error">{resourceError.message}</p> : null}
      {duplicateError ? <p className="app-banner-error">{duplicateError}</p> : null}

      {tripTemplates.length === 0 ? (
        <p className="text-sm text-gray-700">
          No templates are available yet. You can still start from a blank body.
        </p>
      ) : null}

      <TripSheetForm
        trip={{
          id: trip.id,
          title: trip.title,
          trip_type: trip.trip_type,
          start_date: trip.start_date,
          end_date: trip.end_date,
          destination:
            getDestinationName(trip.destination_ref, 'Unknown destination') ??
            'Unknown destination',
          guest_name: trip.guest_name,
          company: trip.company,
          phone_number: trip.phone_number,
        }}
        tripTemplates={tripTemplates}
        availableResources={availableResources}
        initialValues={initialValues}
      />
    </>
  )
}
