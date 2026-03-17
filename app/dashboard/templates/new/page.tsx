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
    <main className="min-h-screen bg-zinc-100 px-4 py-12">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-sm">
        <AdminNav current="templates" />

        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">
            {params.duplicateFrom ? 'Duplicate Template' : 'Create Template'}
          </h1>
        </div>

        {params.error ? (
          <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {params.error}
          </p>
        ) : null}

        {duplicateError ? (
          <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {duplicateError}
          </p>
        ) : null}

        <TemplateForm
          action={createTemplate}
          submitLabel="Save Template"
          initialTitle={initialTitle}
          initialBody={initialBody}
        />
      </div>
    </main>
  )
}
