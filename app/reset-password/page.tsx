import Link from 'next/link'
import { cookies } from 'next/headers'

import { updatePassword } from '@/app/auth/actions'
import ActionSubmitButton from '@/app/components/ActionSubmitButton'
import { passwordRecoveryCookieName } from '@/lib/auth-recovery'
import { createClient } from '@/lib/supabase/server'

type ResetPasswordPageProps = {
  searchParams: Promise<{
    error?: string
  }>
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const params = await searchParams
  const cookieStore = await cookies()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const recoveryUserId = cookieStore.get(passwordRecoveryCookieName)?.value
  const hasValidRecoverySession = Boolean(
    user && recoveryUserId === user.id
  )

  return (
    <main className="app-page flex items-center justify-center">
      <div className="w-full max-w-lg">
        <div className="app-card">
          {hasValidRecoverySession ? (
            <>
              <div className="mb-8">
                <h1 className="app-page-title">Set a new password</h1>
                <p className="app-page-subtitle">
                  Choose a password with at least 6 characters.
                </p>
              </div>

              {params.error ? (
                <p className="app-banner-error">{params.error}</p>
              ) : null}

              <form action={updatePassword} className="space-y-4">
                <div>
                  <label htmlFor="password" className="ui-label">
                    New password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={6}
                    required
                    className="ui-input"
                  />
                </div>

                <div>
                  <label htmlFor="confirm_password" className="ui-label">
                    Confirm new password
                  </label>
                  <input
                    id="confirm_password"
                    name="confirm_password"
                    type="password"
                    autoComplete="new-password"
                    minLength={6}
                    required
                    className="ui-input"
                  />
                </div>

                <ActionSubmitButton
                  idleLabel="Update password"
                  pendingLabel="Updating…"
                  className="ui-button-primary w-full"
                />
              </form>
            </>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="app-page-title">Set a new password</h1>
              </div>
              <p className="app-banner-error">
                This password reset link is invalid or has expired.
              </p>
              <Link
                href="/forgot-password"
                className="ui-button ui-button-primary w-full"
              >
                Request a new reset link
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
