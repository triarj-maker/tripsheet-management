'use server'

import { redirect } from 'next/navigation'

import { requireAdmin } from '@/app/dashboard/lib'
import { appendToastParam } from '@/app/lib/action-feedback'
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
    .eq('role', 'resource')

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

  if (!fullName || !email || !password) {
    redirect(buildNewResourceRedirect('Full name, email, and password are required.'))
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
    role: 'resource',
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
  const isActive = formData.get('is_active') === 'on'

  if (!id) {
    redirect(buildResourcesRedirect('Resource not found.'))
  }

  if (!fullName) {
    redirect(buildEditResourceRedirect(id, 'Full name is required.'))
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      phone: phone || null,
      is_active: isActive,
    })
    .eq('id', id)
    .eq('role', 'resource')

  if (error) {
    redirect(buildEditResourceRedirect(id, error.message))
  }

  redirect(appendToastParam('/dashboard/resources'))
}
