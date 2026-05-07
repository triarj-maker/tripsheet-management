'use server'

import { redirect } from 'next/navigation'

import { requireAdmin } from '@/app/dashboard/lib'
import { appendToastParam } from '@/app/lib/action-feedback'

function buildSchoolsRedirect(error: string) {
  const params = new URLSearchParams({ error })
  return `/dashboard/schools?${params.toString()}`
}

function normalizeName(formData: FormData) {
  return String(formData.get('name') ?? '').trim()
}

export async function createSchool(formData: FormData) {
  const { supabase } = await requireAdmin()
  const name = normalizeName(formData)

  if (!name) {
    redirect(buildSchoolsRedirect('School name is required.'))
  }

  const { error } = await supabase.from('schools').insert({
    name,
    is_active: true,
  })

  if (error) {
    redirect(buildSchoolsRedirect(error.message))
  }

  redirect(appendToastParam('/dashboard/schools'))
}

export async function updateSchool(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') ?? '').trim()
  const name = normalizeName(formData)
  const isActive = formData.get('is_active') === 'on'

  if (!id) {
    redirect(buildSchoolsRedirect('School not found.'))
  }

  if (!name) {
    redirect(buildSchoolsRedirect('School name is required.'))
  }

  const { error } = await supabase
    .from('schools')
    .update({
      name,
      is_active: isActive,
    })
    .eq('id', id)

  if (error) {
    redirect(buildSchoolsRedirect(error.message))
  }

  redirect(appendToastParam('/dashboard/schools'))
}

export async function toggleSchoolActive(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') ?? '').trim()
  const nextIsActive = formData.get('next_is_active') === 'true'

  if (!id) {
    redirect(buildSchoolsRedirect('School not found.'))
  }

  const { error } = await supabase
    .from('schools')
    .update({
      is_active: nextIsActive,
    })
    .eq('id', id)

  if (error) {
    redirect(buildSchoolsRedirect(error.message))
  }

  redirect(appendToastParam('/dashboard/schools'))
}
