import AdminNav from '@/app/dashboard/AdminNav'

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
}

type DuplicateTripSheet = {
  title: string | null
  destination: string | null
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
  const { data: resourceData, error: resourceError } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone')
    .eq('role', 'resource')
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  const availableResources = (resourceData as ResourceProfile[] | null) ?? []
  let duplicateError: string | null = null
  let initialValues: {
    title: string
    destination: string
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
        'title, destination, start_date, end_date, guest_name, company, phone_number, template_id, body_text'
      )
      .eq('id', params.duplicateFrom)
      .maybeSingle()

    const duplicateTripSheet = (duplicateData as DuplicateTripSheet | null) ?? null

    if (duplicateLoadError) {
      duplicateError = duplicateLoadError.message
    } else if (!duplicateTripSheet) {
      duplicateError = 'Trip sheet to duplicate was not found.'
    } else {
      initialValues = {
        title: duplicateTripSheet.title ?? '',
        destination: duplicateTripSheet.destination ?? '',
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
    <main className="min-h-screen bg-zinc-100 px-4 py-12">
      <div className="mx-auto w-full max-w-[1600px] rounded-2xl bg-white p-8 shadow-sm">
        <AdminNav current="trip-sheets" />

        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">
            {params.duplicateFrom ? 'Duplicate Trip Sheet' : 'Create Trip Sheet'}
          </h1>
        </div>

        {params.error && params.error !== guestOrCompanyRequiredMessage ? (
          <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {params.error}
          </p>
        ) : null}

        {error ? (
          <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error.message}
          </p>
        ) : null}

        {resourceError ? (
          <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {resourceError.message}
          </p>
        ) : null}

        {duplicateError ? (
          <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {duplicateError}
          </p>
        ) : null}

        {tripTemplates.length === 0 ? (
          <p className="text-sm text-gray-700">
            No templates are available yet.
          </p>
        ) : (
          <TripSheetForm
            tripTemplates={tripTemplates}
            availableResources={availableResources}
            errorMessage={params.error}
            initialValues={initialValues}
          />
        )}
      </div>
    </main>
  )
}
