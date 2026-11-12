import AdminNav from '@/app/dashboard/AdminNav'
import { createTemplate } from '../actions'
import TemplateForm from '../TemplateForm'
import { requireAdmin } from '../lib'

type NewTemplatePageProps = {
  searchParams: Promise<{
    error?: string
    duplicateFrom?: string
  }>
}

type TripTemplate = {
  destination_id: string | null
  title: string | null
  heading: string | null
  default_start_time: string | null
  default_end_time: string | null
  body: string | null
}

function formatTimeInputValue(value: string | null) {
  return value?.slice(0, 5) ?? ''
}

export default async function NewTemplatePage({
  searchParams,
}: NewTemplatePageProps) {
  const params = await searchParams
  const { supabase } = await requireAdmin()
  const { data: destinations, error: destinationsError } = await supabase
    .from('destinations').select('id, name').order('name', { ascending: true })
  let duplicateError: string | null = null
  let initialDestinationId = ''
  let initialTitle = ''
  let initialHeading = ''
  let initialDefaultStartTime = ''
  let initialDefaultEndTime = ''
  let initialBody = ''

  if (params.duplicateFrom) {
    const { data, error } = await supabase
      .from('trip_templates')
      .select('title, heading, default_start_time, default_end_time, body, destination_id')
      .eq('id', params.duplicateFrom)
      .maybeSingle()

    const tripTemplate = (data as TripTemplate | null) ?? null

    if (error) {
      duplicateError = error.message
    } else if (!tripTemplate) {
      duplicateError = 'Template to duplicate was not found.'
    } else {
      initialDestinationId = tripTemplate.destination_id ?? ''
      initialTitle = `${tripTemplate.title ?? ''} Copy`
      initialHeading = tripTemplate.heading ?? ''
      initialDefaultStartTime = formatTimeInputValue(tripTemplate.default_start_time)
      initialDefaultEndTime = formatTimeInputValue(tripTemplate.default_end_time)
      initialBody = tripTemplate.body ?? ''
    }
  }

  return (
    <>
      <AdminNav current="templates" />

        <div className="app-page-header">
          <div>
            <h1 className="app-page-title">
              {params.duplicateFrom ? 'Duplicate Template' : 'Create Template'}
            </h1>
            <p className="app-page-subtitle">
              Write and save reusable template content for trip sheets.
            </p>
          </div>
        </div>

        {params.error ? (
          <p className="app-banner-error">
            {params.error}
          </p>
        ) : null}

        {duplicateError ? (
          <p className="app-banner-error">
            {duplicateError}
          </p>
        ) : null}

        {destinationsError ? <p className="app-banner-error">Unable to load destinations. Please reload before saving.</p> : null}
        {!destinationsError && !duplicateError ? <TemplateForm
          destinations={destinations ?? []}
          duplicateFrom={params.duplicateFrom}
          initialDestinationId={initialDestinationId}
          action={createTemplate}
          submitLabel="Save Template"
          initialTitle={initialTitle}
          initialHeading={initialHeading}
          initialDefaultStartTime={initialDefaultStartTime}
          initialDefaultEndTime={initialDefaultEndTime}
          initialBody={initialBody}
        /> : null}
    </>
  )
}
