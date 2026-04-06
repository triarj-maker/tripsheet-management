import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

export type DashboardProfile = {
  full_name: string | null
  email: string | null
  role: string | null
  is_active: boolean | null
}

function buildLoginRedirect(error: string) {
  const params = new URLSearchParams({ error })
  return `/login?${params.toString()}`
}

export function getSignedInHomePath(role: string | null | undefined) {
  return role === 'resource' ? '/my-trip-sheets' : '/dashboard/trips'
}

export async function getCurrentUserProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, email, role, is_active')
    .eq('id', user.id)
    .maybeSingle()

  const profile = (data as DashboardProfile | null) ?? null

  if (profile?.is_active === false) {
    await supabase.auth.signOut()
    redirect(buildLoginRedirect('Your account is inactive.'))
  }

  return { supabase, user, profile, error }
}

export async function requireAdmin() {
  const context = await getCurrentUserProfile()

  if (context.profile?.role === 'resource') {
    redirect('/my-trip-sheets')
  }

  if (context.profile?.role !== 'admin') {
    redirect(buildLoginRedirect('You do not have access to that page.'))
  }

  return context
}

export async function requireResource() {
  const context = await getCurrentUserProfile()

  if (context.profile?.role === 'admin') {
    redirect(getSignedInHomePath(context.profile?.role))
  }

  if (context.profile?.role !== 'resource') {
    redirect(buildLoginRedirect('You do not have access to that page.'))
  }

  return context
}

export async function requireAdminOrResource() {
  const context = await getCurrentUserProfile()

  if (context.profile?.role !== 'admin' && context.profile?.role !== 'resource') {
    redirect(buildLoginRedirect('You do not have access to that page.'))
  }

  return context
}
