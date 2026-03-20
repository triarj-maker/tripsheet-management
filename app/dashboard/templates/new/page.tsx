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
  title: string | null
  body: string | null
}

export default async function NewTemplatePage({
  searchParams,
}: NewTemplatePageProps) {
  const params = await searchParams
  const { supabase } = await requireAdmin()
  let duplicateError: string | null = null
  let initialTitle = ''
  let initialBody = ''

  if (params.duplicateFrom) {
    const { data, error } = await supabase
      .from('trip_templates')
      .select('title, body')
      .eq('id', params.duplicateFrom)
      .maybeSingle()

    const tripTemplate = (data as TripTemplate | null) ?? null

    if (error) {
      duplicateError = error.message
    } else if (!tripTemplate) {
      duplicateError = 'Template to duplicate was not found.'
    } else {
      initialTitle = `${tripTemplate.title ?? ''} Copy`
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

        <TemplateForm
          action={createTemplate}
          submitLabel="Save Template"
          initialTitle={initialTitle}
          initialBody={initialBody}
        />
    </>
  )
}
