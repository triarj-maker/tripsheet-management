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
    <main className="min-h-screen bg-zinc-100 px-4 py-12">
      <div className="mx-auto max-w-5xl rounded-2xl bg-white p-8 shadow-sm">
        <AdminNav current="templates" />

        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-gray-900">Templates</h1>

          <ActionLinkButton
            href="/dashboard/templates/new"
            idleLabel="Create Template"
            pendingLabel="Creating…"
            className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium text-gray-900"
          />
        </div>

        {params.error ? (
          <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {params.error}
          </p>
        ) : null}

        {error ? (
          <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error.message}
          </p>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
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
                  <tr
                    key={template.id}
                    className="border-b border-zinc-100 align-top transition-colors hover:bg-zinc-50"
                  >
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
                          className="rounded border border-zinc-300 px-3 py-1 text-sm text-gray-900"
                        >
                          Edit
                        </Link>
                        <ActionLinkButton
                          href={`/dashboard/templates/new?duplicateFrom=${template.id}`}
                          idleLabel="Duplicate"
                          pendingLabel="Duplicating…"
                          className="rounded border border-zinc-300 px-3 py-1 text-sm text-gray-900"
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
      </div>
    </main>
  )
}
