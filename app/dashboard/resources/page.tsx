import type { PermissionProfile } from '@/lib/roles'
import Link from 'next/link'

import AdminNav from '@/app/dashboard/AdminNav'
import ActionLinkButton from '@/app/components/ActionLinkButton'
import { requireAdmin } from '@/app/dashboard/lib'
import { teamPermissionLabels } from './permissions'

import ResourceActionsMenu from './ResourceActionsMenu'

type ResourcesPageProps = {
  searchParams: Promise<{
    error?: string
  }>
}

type ResourceProfile = PermissionProfile & {
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
    'ui-badge',
    isActive ? 'ui-badge-green' : 'ui-badge-neutral',
  ].join(' ')
}

function roleLabel(role: ResourceProfile) {
  return teamPermissionLabels(role).join(', ') || 'No roles'
}

function roleBadgeClass(role: ResourceProfile) {
  return [
    'ui-badge',
    role.is_admin === true ? 'ui-badge-blue' : 'ui-badge-neutral',
  ].join(' ')
}

export default async function ResourcesPage({
  searchParams,
}: ResourcesPageProps) {
  const params = await searchParams
  const { supabase, user } = await requireAdmin()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, is_active, created_at, is_admin, profile_operational_roles(role_code)')
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
              <th className="px-3 py-2 font-medium text-gray-700">Roles</th>
              <th className="px-3 py-2 font-medium text-gray-700">Status</th>
              <th className="px-3 py-2 font-medium text-gray-700">Created At</th>
              <th className="px-3 py-2 font-medium text-gray-700">Actions</th>
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
                <tr key={resource.id}>
                  <td className="px-3 py-2 text-gray-900">
                    {formatValue(resource.full_name)}
                  </td>
                  <td className="px-3 py-2 text-gray-900">
                    {formatValue(resource.email)}
                  </td>
                  <td className="px-3 py-2">
                    <span className={roleBadgeClass(resource)}>
                      {roleLabel(resource)}
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
                    <div className="flex flex-nowrap items-center gap-2 whitespace-nowrap">
                      <Link
                        href={`/dashboard/resources/${resource.id}/assignments`}
                        className="ui-button ui-button-secondary"
                      >
                        Assignments
                      </Link>
                      <Link
                        href={`/dashboard/resources/${resource.id}/edit`}
                        className="ui-button ui-button-secondary"
                      >
                        Edit
                      </Link>
                      <ResourceActionsMenu
                        resourceId={resource.id}
                        fullName={resource.full_name}
                        email={resource.email}
                        isActive={resource.is_active}
                        canResetPassword={resource.id !== user.id}
                      />
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
