'use server'

import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'

import { getSignedInHomePath } from '@/app/dashboard/lib'
import { passwordRecoveryCookieName } from '@/lib/auth-recovery'
import { createClient } from '@/lib/supabase/server'

function buildLoginRedirect(error: string) {
  const params = new URLSearchParams({ error })
  return `/login?${params.toString()}`
}

function buildForgotPasswordRedirect(key: 'error' | 'sent', value: string) {
  const params = new URLSearchParams({ [key]: value })
  return `/forgot-password?${params.toString()}`
}

function buildResetPasswordRedirect(error: string) {
  const params = new URLSearchParams({ error })
  return `/reset-password?${params.toString()}`
}

async function getApplicationOrigin() {
  const configuredOrigin = process.env.APP_BASE_URL?.trim()

  if (configuredOrigin) {
    try {
      const url = new URL(configuredOrigin)
      const isLocalUrl =
        url.hostname === 'localhost' || url.hostname === '127.0.0.1'

      if (process.env.VERCEL !== '1' || !isLocalUrl) {
        return url.origin
      }
    } catch {}
  }

  const vercelProductionHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()

  if (process.env.VERCEL === '1' && vercelProductionHost) {
    return `https://${vercelProductionHost.replace(/^https?:\/\//, '').replace(/\/$/, '')}`
  }

  const headersList = await headers()
  const host = headersList.get('x-forwarded-host') ?? headersList.get('host')

  if (!host) {
    throw new Error('Unable to determine the application URL.')
  }

  const forwardedProto = headersList
    .get('x-forwarded-proto')
    ?.split(',')[0]
    ?.trim()
  const protocol =
    forwardedProto ||
    (host.startsWith('localhost') || host.startsWith('127.0.0.1')
      ? 'http'
      : 'https')

  return `${protocol}://${host}`
}

export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    redirect(buildLoginRedirect('Email and password are required.'))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect(buildLoginRedirect(error.message))
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .maybeSingle()

    const currentProfile = (profile as {
      role: string | null
      is_active: boolean | null
    } | null)

    if (currentProfile?.is_active === false) {
      await supabase.auth.signOut()
      redirect(buildLoginRedirect('Your account is inactive.'))
    }

    redirect(getSignedInHomePath(currentProfile?.role))
  }

  redirect(getSignedInHomePath(null))
}

export async function logout() {
  const supabase = await createClient()

  await supabase.auth.signOut()

  redirect('/login')
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()

  if (!email) {
    redirect(buildForgotPasswordRedirect('error', 'Email is required.'))
  }

  let origin: string

  try {
    origin = await getApplicationOrigin()
  } catch (error) {
    redirect(
      buildForgotPasswordRedirect(
        'error',
        error instanceof Error
          ? error.message
          : 'Unable to send a password reset link.'
      )
    )
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/recovery`,
  })

  if (error) {
    redirect(buildForgotPasswordRedirect('error', error.message))
  }

  redirect(buildForgotPasswordRedirect('sent', '1'))
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get('password') ?? '')
  const confirmPassword = String(formData.get('confirm_password') ?? '')

  if (!password || !confirmPassword) {
    redirect(buildResetPasswordRedirect('Both password fields are required.'))
  }

  if (password !== confirmPassword) {
    redirect(
      buildResetPasswordRedirect('New password and confirmation must match.')
    )
  }

  if (password.length < 6) {
    redirect(
      buildResetPasswordRedirect('Password must be at least 6 characters.')
    )
  }

  const cookieStore = await cookies()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const recoveryUserId = cookieStore.get(passwordRecoveryCookieName)?.value

  if (!user || recoveryUserId !== user.id) {
    cookieStore.delete(passwordRecoveryCookieName)
    redirect(buildResetPasswordRedirect('invalid_or_expired'))
  }

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    redirect(buildResetPasswordRedirect(error.message))
  }

  await supabase.auth.signOut()
  cookieStore.delete(passwordRecoveryCookieName)

  const params = new URLSearchParams({
    message:
      'Password updated successfully. Please sign in with your new password.',
  })
  redirect(`/login?${params.toString()}`)
}
