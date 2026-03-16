import { redirect } from 'next/navigation'

import AdminNav from '@/app/dashboard/AdminNav'
import TemplateForm from '../../TemplateForm'
import { updateTemplate } from '../../actions'
import { requireAdmin } from '../../lib'

type EditTemplatePageProps = {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    error?: string
  }>
}

type TripTemplate = {
  id: string
  title: string | null
  body: string | null
}

function buildTemplatesRedirect(error: string) {
  const params = new URLSearchParams({ error })
  return `/dashboard/templates?${params.toString()}`
}

export default async function EditTemplatePage({
  params,
  searchParams,
}: EditTemplatePageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const { supabase } = await requireAdmin()
  const { data, error } = await supabase
    .from('trip_templates')
    .select('id, title, body')
    .eq('id', id)
    .maybeSingle()

  const tripTemplate = (data as TripTemplate | null) ?? null

  if (!tripTemplate) {
    redirect(buildTemplatesRedirect(error?.message ?? 'Template not found.'))
  }

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-12">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-sm">
        <AdminNav current="templates" />

        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Edit Template</h1>
        </div>

        {query.error ? (
          <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {query.error}
          </p>
        ) : null}

        <TemplateForm
          action={updateTemplate}
          submitLabel="Save Changes"
          templateId={tripTemplate.id}
          initialTitle={tripTemplate.title ?? ''}
          initialBody={tripTemplate.body ?? ''}
        />
      </div>
    </main>
  )
}
