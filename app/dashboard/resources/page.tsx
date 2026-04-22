import Link from 'next/link'

import AdminNav from '@/app/dashboard/AdminNav'
import ActionLinkButton from '@/app/components/ActionLinkButton'
import ActionSubmitButton from '@/app/components/ActionSubmitButton'
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
  role: string | null
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
    'ui-badge',
    isActive ? 'ui-badge-green' : 'ui-badge-neutral',
  ].join(' ')
}

function roleLabel(role: string | null) {
  return role === 'admin' ? 'Admin' : 'Resource'
}

function roleBadgeClass(role: string | null) {
  return [
    'ui-badge',
    role === 'admin' ? 'ui-badge-blue' : 'ui-badge-neutral',
  ].join(' ')
}

export default async function ResourcesPage({
  searchParams,
}: ResourcesPageProps) {
  const params = await searchParams
  const { supabase } = await requireAdmin()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, role, is_active, created_at')
    .in('role', ['admin', 'resource'])
    .order('created_at', { ascending: false })

  const resources = (data as ResourceProfile[] | null) ?? []

  return (
    <>
      <AdminNav current="resources" />

        <div className="app-page-header">
          <div>
            <h1 className="app-page-title">Resources</h1>
            <p className="app-page-subtitle">
              Manage resource accounts and availability.
            </p>
          </div>

          <ActionLinkButton
            href="/dashboard/resources/new"
            idleLabel="Create Resource"
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
              <th className="px-3 py-2 font-medium text-gray-700">Name</th>
              <th className="px-3 py-2 font-medium text-gray-700">Email</th>
              <th className="px-3 py-2 font-medium text-gray-700">Phone</th>
              <th className="px-3 py-2 font-medium text-gray-700">Role</th>
              <th className="px-3 py-2 font-medium text-gray-700">Status</th>
              <th className="px-3 py-2 font-medium text-gray-700">Created At</th>
              <th className="px-3 py-2 font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {resources.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-gray-700">
                  No resources found.
                </td>
              </tr>
              ) : (
              resources.map((resource) => (
                <tr key={resource.id}>
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
                    <span className={roleBadgeClass(resource.role)}>
                      {roleLabel(resource.role)}
                    </span>
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
                        className="ui-button ui-button-secondary"
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
                        <ActionSubmitButton
                          idleLabel={resource.is_active ? 'Deactivate' : 'Activate'}
                          pendingLabel="Saving…"
                          className="ui-button-secondary"
                        />
                      </form>
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
