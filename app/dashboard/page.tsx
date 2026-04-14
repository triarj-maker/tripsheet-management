import { headers } from 'next/headers'

import AdminNav from '@/app/dashboard/AdminNav'
import { logout } from '@/app/auth/actions'
import CopyCalendarLinkButton from '@/app/components/CopyCalendarLinkButton'
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
  const headersList = await headers()
  const name = formatText(currentProfile?.full_name ?? null)
  const email = formatText(currentProfile?.email ?? user.email ?? null)
  const role = formatText(currentProfile?.role ?? null)
  const isActive = currentProfile?.is_active !== false
  const forwardedProto = headersList.get('x-forwarded-proto')
  const host = headersList.get('x-forwarded-host') ?? headersList.get('host')
  const origin =
    process.env.APP_BASE_URL?.trim() ||
    (host ? `${forwardedProto ?? 'https'}://${host}` : '')
  const calendarFeedUrl = origin
    ? `${origin.replace(/\/$/, '')}/calendar/feed/${user.id}.ics`
    : `/calendar/feed/${user.id}.ics`

  return (
    <>
      <AdminNav current="profile" role={currentProfile?.role} />

      <div className="mx-auto w-full max-w-2xl">
        <div className="app-page-header mb-4">
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

        <section className="app-section-card space-y-4 px-4 py-4 sm:px-5">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-gray-900">{name}</h2>
              <span className="ui-badge ui-badge-blue">{role}</span>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Email
                </p>
                <p className="mt-1 text-sm text-gray-900">{email}</p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Status
                </p>
                <div className="mt-1.5">
                  <span className={badgeClass(isActive)}>
                    {isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Calendar Sync
                </p>
                <div className="mt-1.5">
                  <CopyCalendarLinkButton url={calendarFeedUrl} />
                </div>
                <p className="mt-2 text-sm text-gray-600">
                  In Google Calendar, choose Add calendar, then From URL.
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-200 pt-4">
            <form action={logout}>
              <button
                type="submit"
                className="ui-button ui-button-secondary"
              >
                Logout
              </button>
            </form>
          </div>
        </section>
      </div>
    </>
  )
}
