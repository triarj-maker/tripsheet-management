import Link from 'next/link'

import AdminNav from '@/app/dashboard/AdminNav'
import { requireAdmin } from '@/app/dashboard/lib'

import { toggleResourceActive } from './actions'

type ResourcesPageProps = {
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
  created_at: string | null
}

function formatValue(value: string | null) {
  if (value === null) {
    return '-'
  }

  return value
}

function formatCreatedAt(value: string | null) {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function statusBadgeClass(isActive: boolean | null) {
  return [
    'inline-flex rounded-full px-2.5 py-1 text-xs font-medium',
    isActive
      ? 'bg-green-100 text-green-800'
      : 'bg-zinc-100 text-zinc-700',
  ].join(' ')
}

export default async function ResourcesPage({
  searchParams,
}: ResourcesPageProps) {
  const params = await searchParams
  const { supabase } = await requireAdmin()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, is_active, created_at')
    .eq('role', 'resource')
    .order('created_at', { ascending: false })

  const resources = (data as ResourceProfile[] | null) ?? []

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-12">
      <div className="mx-auto max-w-5xl rounded-2xl bg-white p-8 shadow-sm">
        <AdminNav current="resources" />

        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-gray-900">Resources</h1>

          <Link
            href="/dashboard/resources/new"
            className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium text-gray-900"
          >
            Create Resource
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
              <th className="px-3 py-2 font-medium text-gray-700">Name</th>
              <th className="px-3 py-2 font-medium text-gray-700">Email</th>
              <th className="px-3 py-2 font-medium text-gray-700">Phone</th>
              <th className="px-3 py-2 font-medium text-gray-700">Status</th>
              <th className="px-3 py-2 font-medium text-gray-700">Created At</th>
              <th className="px-3 py-2 font-medium text-gray-700">actions</th>
            </tr>
          </thead>
          <tbody>
            {resources.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-gray-700">
                  No resources found.
                </td>
              </tr>
            ) : (
              resources.map((resource) => (
                <tr key={resource.id} className="border-b border-zinc-100">
                  <td className="px-3 py-2 text-gray-900">
                    {formatValue(resource.full_name)}
                  </td>
                  <td className="px-3 py-2 text-gray-900">
                    {formatValue(resource.email)}
                  </td>
                  <td className="px-3 py-2 text-gray-900">
                    {formatValue(resource.phone)}
                  </td>
                  <td className="px-3 py-2">
                    <span className={statusBadgeClass(resource.is_active)}>
                      {resource.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-900">
                    {formatCreatedAt(resource.created_at)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/resources/${resource.id}/edit`}
                        className="rounded border border-zinc-300 px-3 py-1 text-sm text-gray-900"
                      >
                        Edit
                      </Link>
                      <form action={toggleResourceActive}>
                        <input type="hidden" name="id" value={resource.id} />
                        <input
                          type="hidden"
                          name="next_is_active"
                          value={resource.is_active ? 'false' : 'true'}
                        />
                        <button
                          type="submit"
                          className="rounded border border-zinc-300 px-3 py-1 text-sm text-gray-900"
                        >
                          {resource.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </form>
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
