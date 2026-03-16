import AdminNav from '@/app/dashboard/AdminNav'
import { logout } from '@/app/auth/actions'
import { requireAdmin } from '@/app/dashboard/lib'

function formatText(value: string | null) {
  return value ?? '-'
}

function badgeClass(isPositive: boolean) {
  return isPositive
    ? 'inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700'
    : 'inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700'
}

export default async function DashboardPage() {
  const { user, profile: currentProfile, error } = await requireAdmin()

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-12">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow-sm">
        <AdminNav current="profile" />

        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Profile</h1>
        </div>

        {error ? (
          <p className="mb-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error.message}
          </p>
        ) : null}

        <div className="space-y-4">
          <section className="rounded-xl border border-zinc-200 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
              Account Info
            </h2>

            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-700">Name</dt>
                <dd className="mt-1 text-base text-gray-900">
                  {formatText(currentProfile?.full_name ?? null)}
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-700">Email</dt>
                <dd className="mt-1 text-base text-gray-900">
                  {formatText(currentProfile?.email ?? user.email ?? null)}
                </dd>
              </div>

              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-700">Role</dt>
                <dd className="mt-2">
                  <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-gray-900">
                    {formatText(currentProfile?.role ?? null)}
                  </span>
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-zinc-200 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
              Status
            </h2>

            <div>
              <p className="text-sm font-medium text-gray-700">Status</p>
              <div className="mt-2">
                <span className={badgeClass(currentProfile?.is_active !== false)}>
                  {currentProfile?.is_active === false ? 'Inactive' : 'Active'}
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-zinc-200 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
              Actions
            </h2>

            <form action={logout}>
              <button
                type="submit"
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-zinc-50"
              >
                Logout
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  )
}
