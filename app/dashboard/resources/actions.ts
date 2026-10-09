'use server'

import { redirect } from 'next/navigation'

import { requireAdmin } from '@/app/dashboard/lib'
import { appendToastParam } from '@/app/lib/action-feedback'
import { parseTeamPermissions } from './permissions'
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

export async function toggleResourceActive(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') ?? '').trim()
  const nextIsActive = formData.get('next_is_active') === 'true'

  if (!id) {
    redirect(buildResourcesRedirect('Resource not found.'))
  }

  const { error } = await supabase.rpc('set_profile_active', {
    p_id: id, p_active: nextIsActive,
  })

  if (error) {
    redirect(buildResourcesRedirect(error.message))
  }

  redirect(appendToastParam('/dashboard/resources'))
}

export async function createResource(formData: FormData) {
  const { supabase } = await requireAdmin()
  const fullName = String(formData.get('full_name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const phone = String(formData.get('phone') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const selection = parseTeamPermissions(formData)

  if (!fullName || !email || !password) {
    redirect(buildNewResourceRedirect('Full name, email, and password are required.'))
  }
  if (selection.error !== null) redirect(buildNewResourceRedirect(selection.error))
  const { isAdmin, roles, isActive } = selection.permissions

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

  // Profile fields and permissions commit together; Auth identity is separate.
  let profileFailure: string | null = null
  try {
    const { error: profileError } = await supabase.rpc('save_profile_permissions', {
      p_id: data.user.id, p_full_name: fullName, p_phone: phone || null,
      p_admin: isAdmin, p_roles: roles, p_active: isActive, p_email: email,
    })
    if (profileError) profileFailure = profileError.message
  } catch {
    // A transport failure may leave the commit outcome unknown. Preserve the
    // identity and require inspection before attempting any recovery write.
    profileFailure = 'The database request could not be confirmed.'
  }

  if (profileFailure !== null) {
    redirect(
      buildNewResourceRedirect(
        `Auth account ${data.user.id} was created, but Team profile creation could not be confirmed. The account has been preserved. Do not create it again; ask a database administrator to verify this Auth ID and complete its profile using the multi-role deployment recovery runbook. Error: ${profileFailure}`
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
  const selection = parseTeamPermissions(formData)

  if (!id) {
    redirect(buildResourcesRedirect('Resource not found.'))
  }

  if (!fullName) {
    redirect(buildEditResourceRedirect(id, 'Full name is required.'))
  }
  if (selection.error !== null) redirect(buildEditResourceRedirect(id, selection.error))
  const { isAdmin, roles, isActive } = selection.permissions

  const { error } = await supabase.rpc('save_profile_permissions', {
    p_id: id, p_full_name: fullName, p_phone: phone || null,
    p_admin: isAdmin, p_roles: roles, p_active: isActive, p_email: null,
  })

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
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (targetProfileError) {
    redirectWithError(
      'Unable to verify the selected resource. Please try again.'
    )
  }

  if (!targetProfile) {
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
