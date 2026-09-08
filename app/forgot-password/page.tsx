import Link from 'next/link'

import { requestPasswordReset } from '@/app/auth/actions'
import ActionSubmitButton from '@/app/components/ActionSubmitButton'

type ForgotPasswordPageProps = {
  searchParams: Promise<{
    error?: string
    sent?: string
  }>
}

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const params = await searchParams

  return (
    <main className="app-page flex items-center justify-center">
      <div className="w-full max-w-lg">
        <div className="app-card">
          <div className="mb-8">
            <h1 className="app-page-title">Forgot password?</h1>
            <p className="app-page-subtitle">
              Enter your email address and we&apos;ll send you a link to reset
              your password.
            </p>
          </div>

          {params.error ? (
            <p className="app-banner-error">{params.error}</p>
          ) : null}

          {params.sent ? (
            <p className="app-banner-success">
              If an account exists for that email address, we&apos;ve sent a
              password reset link.
            </p>
          ) : null}

          <form action={requestPasswordReset} className="space-y-4">
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

            <ActionSubmitButton
              idleLabel="Send reset link"
              pendingLabel="Sending…"
              className="ui-button-primary w-full"
            />
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
