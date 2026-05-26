import { redirect } from 'next/navigation'

import AdminNav from '@/app/dashboard/AdminNav'
import TemplateCardsSection from '../../TemplateCardsSection'
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
  heading: string | null
  default_start_time: string | null
  default_end_time: string | null
  body: string | null
}

type TemplateCard = {
  id: string
  template_id: string
  title: string | null
  category: string | null
  card_url: string | null
  sort_order: number | null
}

function formatTimeInputValue(value: string | null) {
  return value?.slice(0, 5) ?? ''
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
    .select('id, title, heading, default_start_time, default_end_time, body')
    .eq('id', id)
    .maybeSingle()

  const tripTemplate = (data as TripTemplate | null) ?? null

  if (!tripTemplate) {
    redirect(buildTemplatesRedirect(error?.message ?? 'Template not found.'))
  }

  const { data: cardData, error: cardsError } = await supabase
    .from('template_cards')
    .select('id, template_id, title, category, card_url, sort_order')
    .eq('template_id', tripTemplate.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  const templateCards = (cardData as TemplateCard[] | null) ?? []

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

        {cardsError ? (
          <p className="app-banner-error">
            {cardsError.message}
          </p>
        ) : null}

        <TemplateForm
          action={updateTemplate}
          submitLabel="Save Changes"
          templateId={tripTemplate.id}
          initialTitle={tripTemplate.title ?? ''}
          initialHeading={tripTemplate.heading ?? ''}
          initialDefaultStartTime={formatTimeInputValue(tripTemplate.default_start_time)}
          initialDefaultEndTime={formatTimeInputValue(tripTemplate.default_end_time)}
          initialBody={tripTemplate.body ?? ''}
        />

        <TemplateCardsSection
          templateId={tripTemplate.id}
          cards={templateCards}
        />
    </>
  )
}
