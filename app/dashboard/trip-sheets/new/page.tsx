import AdminNav from '@/app/dashboard/AdminNav'
import {
  getDestinationName,
  toTripTypeFormValue,
  type DestinationRelation,
} from '@/lib/trip-sheets'
import { createAdminClient } from '@/lib/supabase/admin'

import TripSheetForm from './TripSheetForm'
import { requireAdmin } from '../lib'
import { guestOrCompanyRequiredMessage } from '../validation'

type NewTripSheetPageProps = {
  searchParams: Promise<{
    error?: string
    duplicateFrom?: string
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

type DestinationOption = {
  id: string
  name: string | null
  is_active: boolean | null
}

type DuplicateTripSheet = {
  title: string | null
  trip_type: string | null
  destination_id: string | null
  destination_ref: DestinationRelation
  start_date: string | null
  end_date: string | null
  guest_name: string | null
  company: string | null
  phone_number: string | null
  template_id: string | null
  body_text: string | null
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
  const { data: destinationData, error: destinationsError } = await supabase
    .from('destinations')
    .select('id, name, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true })

  let destinations = (destinationData as DestinationOption[] | null) ?? []
  const { data: resourceData, error: resourceError } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, role')
    .in('role', ['resource', 'admin'])
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  const availableResources = (resourceData as ResourceProfile[] | null) ?? []
  let duplicateError: string | null = null
  let initialValues: {
    title: string
    trip_type: string
    destination_id: string
    start_date: string
    end_date: string
    guest_name: string
    company: string
    phone_number: string
    template_id: string
    body: string
  } | undefined

  if (params.duplicateFrom) {
    const { data: duplicateData, error: duplicateLoadError } = await supabase
      .from('trip_sheets')
      .select(
        'title, trip_type, destination_id, destination_ref:destinations(name), start_date, end_date, guest_name, company, phone_number, template_id, body_text'
      )
      .eq('id', params.duplicateFrom)
      .maybeSingle()

    const duplicateTripSheet = (duplicateData as DuplicateTripSheet | null) ?? null

    if (duplicateLoadError) {
      duplicateError = duplicateLoadError.message
    } else if (!duplicateTripSheet) {
      duplicateError = 'Trip sheet to duplicate was not found.'
    } else {
      if (
        duplicateTripSheet.destination_id &&
        !destinations.some((destination) => destination.id === duplicateTripSheet.destination_id)
      ) {
        let selectedDestination: DestinationOption | null = null

        try {
          const adminClient = createAdminClient()
          const { data: selectedDestinationData } = await adminClient
            .from('destinations')
            .select('id, name, is_active')
            .eq('id', duplicateTripSheet.destination_id)
            .maybeSingle()

          selectedDestination = (selectedDestinationData as DestinationOption | null) ?? null
        } catch {}

        if (selectedDestination) {
          destinations = [...destinations, selectedDestination].sort((left, right) =>
            (left.name ?? '').localeCompare(right.name ?? '')
          )
        } else {
          const destinationName = getDestinationName(
            duplicateTripSheet.destination_ref,
            'Unknown destination'
          )

          destinations = [
            ...destinations,
            {
              id: duplicateTripSheet.destination_id,
              name: destinationName,
              is_active: false,
            },
          ].sort((left, right) => (left.name ?? '').localeCompare(right.name ?? ''))
        }
      }

      initialValues = {
        title: duplicateTripSheet.title ?? '',
        trip_type: toTripTypeFormValue(duplicateTripSheet.trip_type),
        destination_id: duplicateTripSheet.destination_id ?? '',
        start_date: duplicateTripSheet.start_date ?? '',
        end_date: duplicateTripSheet.end_date ?? '',
        guest_name: duplicateTripSheet.guest_name ?? '',
        company: duplicateTripSheet.company ?? '',
        phone_number: duplicateTripSheet.phone_number ?? '',
        template_id: duplicateTripSheet.template_id ?? '',
        body: duplicateTripSheet.body_text ?? '',
      }
    }
  }

  return (
    <>
      <AdminNav current="trip-sheets" />

        <div className="app-page-header">
          <div>
            <h1 className="app-page-title">
              {params.duplicateFrom ? 'Duplicate Trip Sheet' : 'Create Trip Sheet'}
            </h1>
            <p className="app-page-subtitle">
              Capture trip details, template content, and optional assignments.
            </p>
          </div>
        </div>

        {params.error && params.error !== guestOrCompanyRequiredMessage ? (
          <p className="app-banner-error">
            {params.error}
          </p>
        ) : null}

        {error ? (
          <p className="app-banner-error">
            {error.message}
          </p>
        ) : null}

        {resourceError ? (
          <p className="app-banner-error">
            {resourceError.message}
          </p>
        ) : null}

        {destinationsError ? (
          <p className="app-banner-error">
            {destinationsError.message}
          </p>
        ) : null}

        {duplicateError ? (
          <p className="app-banner-error">
            {duplicateError}
          </p>
        ) : null}

        {tripTemplates.length === 0 ? (
          <p className="text-sm text-gray-700">
            No templates are available yet.
          </p>
        ) : destinations.length === 0 ? (
          <p className="text-sm text-gray-700">
            No destinations are available yet.
          </p>
        ) : (
          <TripSheetForm
            tripTemplates={tripTemplates}
            destinations={destinations.map((destination) => ({
              id: destination.id,
              name: destination.name ?? destination.id,
            }))}
            availableResources={availableResources}
            errorMessage={params.error}
            initialValues={initialValues}
          />
        )}
    </>
  )
}
