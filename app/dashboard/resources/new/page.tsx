import Link from 'next/link'

import AdminNav from '@/app/dashboard/AdminNav'
import ActionSubmitButton from '@/app/components/ActionSubmitButton'
import { requireAdmin } from '@/app/dashboard/lib'

import { createResource } from '../actions'

type NewResourcePageProps = {
  searchParams: Promise<{
    error?: string
  }>
}

export default async function NewResourcePage({
  searchParams,
}: NewResourcePageProps) {
  const params = await searchParams

  await requireAdmin()

  return (
    <>
      <AdminNav current="resources" />

        <div className="app-page-header">
          <div>
            <h1 className="app-page-title">Create Resource</h1>
            <p className="app-page-subtitle">
              Add a new resource account and profile.
            </p>
          </div>
        </div>

        {params.error ? (
          <p className="app-banner-error">
            {params.error}
          </p>
        ) : null}

        <form action={createResource} className="app-section-card space-y-4">
          <div>
            <label htmlFor="full_name" className="ui-label">Full Name</label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              required
              className="ui-input"
            />
          </div>

          <div>
            <label htmlFor="email" className="ui-label">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="ui-input"
            />
          </div>

          <div>
            <label htmlFor="phone" className="ui-label">Phone</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              className="ui-input"
            />
          </div>

          <div>
            <label htmlFor="password" className="ui-label">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              className="ui-input"
            />
          </div>

          <div className="flex items-center gap-3">
            <ActionSubmitButton
              idleLabel="Save Resource"
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
    </>
  )
}
