import AdminNav from '@/app/dashboard/AdminNav'
import { logout } from '@/app/auth/actions'
import { requireAdminOrResource } from '@/app/dashboard/lib'

function formatText(value: string | null) {
  return value ?? '-'
}

function badgeClass(isPositive: boolean) {
  return isPositive
    ? 'ui-badge ui-badge-green'
    : 'ui-badge ui-badge-red'
}

export default async function DashboardPage() {
  const { user, profile: currentProfile, error } = await requireAdminOrResource()

  return (
    <>
      <AdminNav current="profile" role={currentProfile?.role} />

        <div className="app-page-header">
          <div>
            <h1 className="app-page-title">Profile</h1>
            <p className="app-page-subtitle">
              Review your account details and sign out when needed.
            </p>
          </div>
        </div>

        {error ? (
          <p className="app-banner-error">
            {error.message}
          </p>
        ) : null}

        <div className="space-y-4">
          <section className="app-section-card">
            <h2 className="mb-4 text-base font-semibold text-gray-900">Account Info</h2>

            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-gray-500">Name</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {formatText(currentProfile?.full_name ?? null)}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium text-gray-500">Email</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {formatText(currentProfile?.email ?? user.email ?? null)}
                </dd>
              </div>

              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-gray-500">Role</dt>
                <dd className="mt-2">
                  <span className="ui-badge ui-badge-blue">
                    {formatText(currentProfile?.role ?? null)}
                  </span>
                </dd>
              </div>
            </dl>
          </section>

          <section className="app-section-card">
            <h2 className="mb-4 text-base font-semibold text-gray-900">Status</h2>

            <div>
              <p className="text-xs font-medium text-gray-500">Status</p>
              <div className="mt-2">
                <span className={badgeClass(currentProfile?.is_active !== false)}>
                  {currentProfile?.is_active === false ? 'Inactive' : 'Active'}
                </span>
              </div>
            </div>
          </section>

          <section className="app-section-card">
            <h2 className="mb-4 text-base font-semibold text-gray-900">Actions</h2>

            <form action={logout}>
              <button
                type="submit"
                className="ui-button ui-button-secondary"
              >
                Logout
              </button>
            </form>
          </section>
        </div>
    </>
  )
}
