import AdminNav from '@/app/dashboard/AdminNav'
import { createTemplate } from '../actions'
import TemplateForm from '../TemplateForm'
import { requireAdmin } from '../lib'

type NewTemplatePageProps = {
  searchParams: Promise<{
    error?: string
  }>
}

export default async function NewTemplatePage({
  searchParams,
}: NewTemplatePageProps) {
  const params = await searchParams

  await requireAdmin()

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-12">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-sm">
        <AdminNav current="templates" />

        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Create Template</h1>
        </div>

        {params.error ? (
          <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {params.error}
          </p>
        ) : null}

        <TemplateForm action={createTemplate} submitLabel="Save Template" />
      </div>
    </main>
  )
}
