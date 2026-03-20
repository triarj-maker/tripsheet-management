import Link from 'next/link'

import AdminNav from '@/app/dashboard/AdminNav'
import ActionLinkButton from '@/app/components/ActionLinkButton'
import DeleteTemplateButton from './DeleteTemplateButton'
import { requireAdmin } from './lib'

type TemplatesPageProps = {
  searchParams: Promise<{
    error?: string
  }>
}

type TripTemplate = {
  id: string
  title: string | null
  updated_at: string | null
}

function formatValue(value: string | null) {
  return value ?? '-'
}

function formatDateTime(value: string | null) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  const datePart = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
  const timePart = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)

  return `${datePart}, ${timePart}`
}

export default async function TemplatesPage({
  searchParams,
}: TemplatesPageProps) {
  const params = await searchParams
  const { supabase } = await requireAdmin()
  const { data, error } = await supabase
    .from('trip_templates')
    .select('id, title, updated_at')
    .order('updated_at', { ascending: false })

  const tripTemplates = (data as TripTemplate[] | null) ?? []

  return (
    <>
      <AdminNav current="templates" />

        <div className="app-page-header">
          <div>
            <h1 className="app-page-title">Templates</h1>
            <p className="app-page-subtitle">
              Create and maintain reusable trip templates.
            </p>
          </div>

          <ActionLinkButton
            href="/dashboard/templates/new"
            idleLabel="Create Template"
            pendingLabel="Creating…"
            className="ui-button-primary"
          />
        </div>

        {params.error ? (
          <p className="app-banner-error">
            {params.error}
          </p>
        ) : null}

        {error ? (
          <p className="app-banner-error">
            {error.message}
          </p>
        ) : null}

        <div className="app-table-wrap">
          <table className="app-table">
            <thead>
              <tr>
                <th className="w-[26rem] px-4 py-3 font-medium text-gray-700">
                  Template Name
                </th>
                <th className="w-[14rem] px-4 py-3 font-medium text-gray-700">
                  Last Updated
                </th>
                <th className="w-[14rem] px-4 py-3 font-medium text-gray-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {tripTemplates.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-5 text-gray-700">
                    No templates found.
                  </td>
                </tr>
              ) : (
                tripTemplates.map((template) => (
                  <tr key={template.id} className="align-top">
                    <td className="px-4 py-4 text-gray-900">
                      <div className="max-w-full space-y-1">
                        <p className="text-[15px] font-semibold leading-6 whitespace-normal break-words text-gray-900">
                          {formatValue(template.title)}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-gray-900">
                      {formatDateTime(template.updated_at)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/dashboard/templates/${template.id}/edit`}
                          className="ui-button ui-button-secondary"
                        >
                          Edit
                        </Link>
                        <ActionLinkButton
                          href={`/dashboard/templates/new?duplicateFrom=${template.id}`}
                          idleLabel="Duplicate"
                          pendingLabel="Duplicating…"
                          className="ui-button-secondary"
                        />
                        <DeleteTemplateButton templateId={template.id} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
    </>
  )
}
