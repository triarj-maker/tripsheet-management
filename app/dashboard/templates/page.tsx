import Link from 'next/link'

import AdminNav from '@/app/dashboard/AdminNav'
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

          <Link
            href="/dashboard/templates/new"
            className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium text-gray-900"
          >
            Create Template
          </Link>
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

        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200">
              <th className="px-3 py-2 font-medium text-gray-700">title</th>
              <th className="px-3 py-2 font-medium text-gray-700">updated_at</th>
              <th className="px-3 py-2 font-medium text-gray-700">actions</th>
            </tr>
          </thead>
          <tbody>
            {tripTemplates.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-gray-700">
                  No templates found.
                </td>
              </tr>
            ) : (
              tripTemplates.map((template) => (
                <tr key={template.id} className="border-b border-zinc-100">
                  <td className="px-3 py-2 text-gray-900">{formatValue(template.title)}</td>
                  <td className="px-3 py-2 text-gray-900">
                    {formatValue(template.updated_at)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/templates/${template.id}/edit`}
                        className="rounded border border-zinc-300 px-3 py-1 text-sm text-gray-900"
                      >
                        Edit
                      </Link>
                      <DeleteTemplateButton templateId={template.id} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
