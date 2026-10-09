import { redirect } from 'next/navigation'

import {
  canAccessAssignedWork,
  type PermissionProfile,
  isAdminRole,
  isOperationalRole,
} from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'

export type DashboardProfile = PermissionProfile & {
  full_name: string | null
  email: string | null
  role: string | null
  is_active: boolean | null
}

function buildLoginRedirect(error: string) {
  const params = new URLSearchParams({ error })
  return `/login?${params.toString()}`
}

export function getSignedInHomePath(role: PermissionProfile | null | undefined) {
  if (isAdminRole(role)) {
    return '/dashboard/trips'
  }

  if (isOperationalRole(role)) {
    return '/my-trips'
  }

  return '/login'
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
    .select('full_name, email, role, is_active, is_admin, profile_operational_roles(role_code)')
    .eq('id', user.id)
    .maybeSingle()

  const profile = (data as DashboardProfile | null) ?? null

  if (!profile || error) {
    redirect(buildLoginRedirect('Your profile is unavailable.'))
  }

  if (profile.is_active !== true) {
    await supabase.auth.signOut()
    redirect(buildLoginRedirect('Your account is inactive.'))
  }

  return { supabase, user, profile, error }
}

export async function requireAdmin() {
  const context = await getCurrentUserProfile()

  if (isOperationalRole(context.profile)) {
    redirect('/my-trip-sheets')
  }

  if (!isAdminRole(context.profile)) {
    redirect(buildLoginRedirect('You do not have access to that page.'))
  }

  return context
}

export async function requireResource() {
  const context = await getCurrentUserProfile()

  if (isAdminRole(context.profile)) {
    redirect(getSignedInHomePath(context.profile))
  }

  if (!isOperationalRole(context.profile)) {
    redirect(buildLoginRedirect('You do not have access to that page.'))
  }

  return context
}

export async function requireAdminOrResource() {
  const context = await getCurrentUserProfile()

  if (!canAccessAssignedWork(context.profile)) {
    redirect(buildLoginRedirect('You do not have access to that page.'))
  }

  return context
}
