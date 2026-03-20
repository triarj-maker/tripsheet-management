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
    <>
      <AdminNav current="templates" />

        <div className="app-page-header">
          <div>
            <h1 className="app-page-title">Edit Template</h1>
            <p className="app-page-subtitle">
              Refine template content without changing its usage flow.
            </p>
          </div>
        </div>

        {query.error ? (
          <p className="app-banner-error">
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
    </>
  )
}
