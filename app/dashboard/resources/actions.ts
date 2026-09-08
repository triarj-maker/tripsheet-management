'use server'

import { redirect } from 'next/navigation'

import { requireAdmin } from '@/app/dashboard/lib'
import { appendToastParam } from '@/app/lib/action-feedback'
import {
  APP_ROLES,
  canBeAssignedToTripSheet,
  type AppRole,
} from '@/lib/roles'
import { createAdminClient } from '@/lib/supabase/admin'

function buildResourcesRedirect(error: string) {
  const params = new URLSearchParams({ error })
  return `/dashboard/resources?${params.toString()}`
}

function buildNewResourceRedirect(error: string) {
  const params = new URLSearchParams({ error })
  return `/dashboard/resources/new?${params.toString()}`
}

function buildEditResourceRedirect(id: string, error: string) {
  const params = new URLSearchParams({ error })
  return `/dashboard/resources/${id}/edit?${params.toString()}`
}

function buildPasswordResetErrorRedirect(
  id: string,
  error: string,
  returnToResources: boolean
) {
  return returnToResources
    ? buildResourcesRedirect(error)
    : buildEditResourceRedirect(id, error)
}

function normalizeRole(value: FormDataEntryValue | null) {
  const role = String(value ?? '').trim()

  return APP_ROLES.includes(role as AppRole) ? role : null
}

export async function toggleResourceActive(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') ?? '').trim()
  const nextIsActive = formData.get('next_is_active') === 'true'

  if (!id) {
    redirect(buildResourcesRedirect('Resource not found.'))
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      is_active: nextIsActive,
    })
    .eq('id', id)

  if (error) {
    redirect(buildResourcesRedirect(error.message))
  }

  redirect(appendToastParam('/dashboard/resources'))
}

export async function createResource(formData: FormData) {
  await requireAdmin()
  const fullName = String(formData.get('full_name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const phone = String(formData.get('phone') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const role = normalizeRole(formData.get('role'))

  if (!fullName || !email || !password || !role) {
    redirect(buildNewResourceRedirect('Full name, email, password, and role are required.'))
  }

  let adminClient: ReturnType<typeof createAdminClient>

  try {
    adminClient = createAdminClient()
  } catch (error) {
    redirect(
      buildNewResourceRedirect(
        error instanceof Error ? error.message : 'Unable to create resource.'
      )
    )
  }

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error || !data.user) {
    redirect(buildNewResourceRedirect(error?.message ?? 'Unable to create resource.'))
  }

  const { error: profileError } = await adminClient.from('profiles').insert({
    id: data.user.id,
    full_name: fullName,
    phone: phone || null,
    email,
    role,
    is_active: true,
  })

  if (profileError) {
    await adminClient.auth.admin.deleteUser(data.user.id)
    redirect(
      buildNewResourceRedirect(
        `Auth user was created, but profile creation failed and was rolled back: ${profileError.message}`
      )
    )
  }

  redirect(appendToastParam('/dashboard/resources'))
}

export async function updateResource(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') ?? '').trim()
  const fullName = String(formData.get('full_name') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim()
  const role = normalizeRole(formData.get('role'))
  const isActive = formData.get('is_active') === 'on'

  if (!id) {
    redirect(buildResourcesRedirect('Resource not found.'))
  }

  if (!fullName || !role) {
    redirect(buildEditResourceRedirect(id, 'Full name and role are required.'))
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      phone: phone || null,
      role,
      is_active: isActive,
    })
    .eq('id', id)

  if (error) {
    redirect(buildEditResourceRedirect(id, error.message))
  }

  redirect(appendToastParam('/dashboard/resources'))
}

export async function updateResourcePassword(formData: FormData) {
  const { supabase, user: currentUser } = await requireAdmin()
  const id = String(formData.get('id') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const confirmPassword = String(formData.get('confirm_password') ?? '')
  const returnToResources = formData.get('return_to') === 'resources'

  function redirectWithError(error: string): never {
    redirect(buildPasswordResetErrorRedirect(id, error, returnToResources))
  }

  if (!id) {
    redirect(buildResourcesRedirect('Resource not found.'))
  }

  if (id === currentUser.id) {
    redirectWithError(
      'You cannot reset your own password from user management.'
    )
  }

  if (!password && !confirmPassword) {
    redirectWithError('Enter a new password to update.')
  }

  if (password !== confirmPassword) {
    redirectWithError('New password and confirmation must match.')
  }

  if (password.length < 6) {
    redirectWithError('Password must be at least 6 characters.')
  }

  const { data: targetProfile, error: targetProfileError } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', id)
    .maybeSingle()

  if (targetProfileError) {
    redirectWithError(
      'Unable to verify the selected resource. Please try again.'
    )
  }

  if (!targetProfile || !canBeAssignedToTripSheet(targetProfile.role)) {
    redirectWithError('Resource not found or cannot be managed.')
  }

  let adminClient: ReturnType<typeof createAdminClient>

  try {
    adminClient = createAdminClient()
  } catch {
    redirectWithError(
      'Password reset is not configured. Contact the system administrator.'
    )
  }

  const { data: authUserData, error: authUserError } =
    await adminClient.auth.admin.getUserById(id)

  if (authUserError || !authUserData.user) {
    redirectWithError(
      'The selected profile is not linked to a Supabase Auth user.'
    )
  }

  const { error } = await adminClient.auth.admin.updateUserById(id, {
    password,
  })

  if (error) {
    redirectWithError(
      error.code === 'weak_password'
        ? error.message
        : 'Unable to update the password. Please try again.'
    )
  }

  const successPath = returnToResources
    ? '/dashboard/resources'
    : `/dashboard/resources/${id}/edit`

  redirect(appendToastParam(successPath, 'Password updated successfully.'))
}
