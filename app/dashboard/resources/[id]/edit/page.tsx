import Link from 'next/link'
import { redirect } from 'next/navigation'

import AdminNav from '@/app/dashboard/AdminNav'
import ActionSubmitButton from '@/app/components/ActionSubmitButton'
import { requireAdmin } from '@/app/dashboard/lib'

import { updateResource, updateResourcePassword } from '../../actions'

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
  role: string | null
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
    .select('id, full_name, email, phone, role, is_active')
    .eq('id', id)
    .maybeSingle()

  const resource = (data as ResourceProfile | null) ?? null

  if (!resource) {
    redirect(buildResourcesRedirect(error?.message ?? 'Resource not found.'))
  }

  return (
    <>
      <AdminNav current="resources" />

        <div className="app-page-header">
          <div>
            <h1 className="app-page-title">Edit Resource</h1>
            <p className="app-page-subtitle">
              Update profile details and active status.
            </p>
          </div>
        </div>

        {query.error ? (
          <p className="app-banner-error">
            {query.error}
          </p>
        ) : null}

        <form action={updateResource} className="app-section-card space-y-4">
          <input type="hidden" name="id" value={resource.id} />

          <div>
            <label htmlFor="full_name" className="ui-label">Full Name</label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              defaultValue={resource.full_name ?? ''}
              required
              className="ui-input"
            />
          </div>

          <div>
            <label htmlFor="email" className="ui-label">Email</label>
            <input
              id="email"
              value={resource.email ?? ''}
              readOnly
              disabled
              className="ui-input"
            />
          </div>

          <div>
            <label htmlFor="phone" className="ui-label">Phone</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={resource.phone ?? ''}
              className="ui-input"
            />
          </div>

          <div>
            <label htmlFor="role" className="ui-label">Role</label>
            <select
              id="role"
              name="role"
              defaultValue={resource.role === 'admin' ? 'admin' : 'resource'}
              required
              className="ui-select"
            >
              <option value="resource">Resource</option>
              <option value="admin">Admin</option>
            </select>
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
            <ActionSubmitButton
              idleLabel="Save Changes"
              pendingLabel="Saving…"
              className="ui-button-primary"
            />
            <Link
              href="/dashboard/resources"
              className="ui-button ui-button-secondary"
            >
              Cancel
            </Link>
          </div>
        </form>

        <form action={updateResourcePassword} className="app-section-card space-y-4">
          <input type="hidden" name="id" value={resource.id} />

          <div>
            <h2 className="text-lg font-semibold text-gray-900">Password</h2>
            <p className="mt-1 text-sm text-gray-600">
              Set a new sign-in password for this managed account.
            </p>
          </div>

          <div>
            <label htmlFor="password" className="ui-label">New Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              className="ui-input"
            />
          </div>

          <div>
            <label htmlFor="confirm_password" className="ui-label">Confirm Password</label>
            <input
              id="confirm_password"
              name="confirm_password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              className="ui-input"
            />
          </div>

          <ActionSubmitButton
            idleLabel="Update Password"
            pendingLabel="Updating…"
            className="ui-button-secondary"
          />
        </form>
    </>
  )
}
