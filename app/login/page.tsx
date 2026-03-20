import { redirect } from 'next/navigation'

import { getSignedInHomePath } from '@/app/dashboard/lib'
import { login } from '@/app/auth/actions'
import { createClient } from '@/lib/supabase/server'

type LoginPageProps = {
  searchParams: Promise<{
    error?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    redirect(getSignedInHomePath((profile as { role: string | null } | null)?.role))
  }

  return (
    <main className="app-page flex items-center justify-center">
      <div className="w-full max-w-lg">
        <div className="app-card">
        <div className="mb-8">
          <h1 className="app-page-title">Login</h1>
          <p className="app-page-subtitle">
            Sign in with your email and password.
          </p>
        </div>

        {params.error ? (
          <p className="app-banner-error">
            {params.error}
          </p>
        ) : null}

        <form action={login} className="space-y-4">
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
            <label htmlFor="password" className="ui-label">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="ui-input"
            />
          </div>

          <button
            type="submit"
            className="ui-button ui-button-primary w-full"
          >
            Sign in
          </button>
        </form>
        </div>
      </div>
    </main>
  )
}
