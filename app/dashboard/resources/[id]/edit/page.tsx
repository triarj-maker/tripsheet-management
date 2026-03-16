import Link from 'next/link'
import { redirect } from 'next/navigation'

import AdminNav from '@/app/dashboard/AdminNav'
import { requireAdmin } from '@/app/dashboard/lib'

import { updateResource } from '../../actions'

type EditResourcePageProps = {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    error?: string
  }>
}

type ResourceProfile = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  is_active: boolean | null
}

function buildResourcesRedirect(error: string) {
  const params = new URLSearchParams({ error })
  return `/dashboard/resources?${params.toString()}`
}

export default async function EditResourcePage({
  params,
  searchParams,
}: EditResourcePageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const { supabase } = await requireAdmin()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, is_active')
    .eq('id', id)
    .eq('role', 'resource')
    .maybeSingle()

  const resource = (data as ResourceProfile | null) ?? null

  if (!resource) {
    redirect(buildResourcesRedirect(error?.message ?? 'Resource not found.'))
  }

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-12">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-sm">
        <AdminNav current="resources" />

        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Edit Resource</h1>
        </div>

        {query.error ? (
          <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {query.error}
          </p>
        ) : null}

        <form action={updateResource} className="space-y-4">
          <input type="hidden" name="id" value={resource.id} />

          <div>
            <label
              htmlFor="full_name"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Full Name
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              defaultValue={resource.full_name ?? ''}
              required
              className="w-full rounded border border-zinc-300 px-3 py-2 text-gray-900 placeholder:text-gray-400"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              id="email"
              value={resource.email ?? ''}
              readOnly
              disabled
              className="w-full rounded border border-zinc-300 px-3 py-2 text-gray-900 placeholder:text-gray-400"
            />
          </div>

          <div>
            <label
              htmlFor="phone"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={resource.phone ?? ''}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-gray-900 placeholder:text-gray-400"
            />
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={resource.is_active ?? false}
            />
            <span>Is Active</span>
          </label>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-gray-900"
            >
              Save Changes
            </button>
            <Link
              href="/dashboard/resources"
              className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-gray-900"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  )
}
