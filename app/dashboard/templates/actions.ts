'use server'

import { redirect } from 'next/navigation'

import { requireAdmin } from './lib'

function buildTemplatesRedirect(error: string) {
  const params = new URLSearchParams({ error })
  return `/dashboard/templates?${params.toString()}`
}

function buildNewTemplateRedirect(error: string) {
  const params = new URLSearchParams({ error })
  return `/dashboard/templates/new?${params.toString()}`
}

function buildEditTemplateRedirect(id: string, error: string) {
  const params = new URLSearchParams({ error })
  return `/dashboard/templates/${id}/edit?${params.toString()}`
}

function validateTemplateInput(formData: FormData) {
  const title = String(formData.get('title') ?? '').trim()
  const body = String(formData.get('body') ?? '')

  if (!title) {
    return { error: 'Title is required.' }
  }

  if (title.length > 30) {
    return { error: 'Title must be 30 characters or fewer.' }
  }

  if (!body.trim()) {
    return { error: 'Body is required.' }
  }

  if (body.length > 3000) {
    return { error: 'Body must be 3000 characters or fewer.' }
  }

  return { title, body }
}

export async function createTemplate(formData: FormData) {
  const { supabase, user } = await requireAdmin()
  const result = validateTemplateInput(formData)

  if ('error' in result) {
    redirect(buildNewTemplateRedirect(result.error))
  }

  const { error } = await supabase.from('trip_templates').insert({
    title: result.title,
    body: result.body,
    created_by: user.id,
  })

  if (error) {
    redirect(buildNewTemplateRedirect(error.message))
  }

  redirect('/dashboard/templates')
}

export async function updateTemplate(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') ?? '').trim()

  if (!id) {
    redirect(buildTemplatesRedirect('Template not found.'))
  }

  const result = validateTemplateInput(formData)

  if ('error' in result) {
    redirect(buildEditTemplateRedirect(id, result.error))
  }

  const { error } = await supabase
    .from('trip_templates')
    .update({
      title: result.title,
      body: result.body,
    })
    .eq('id', id)

  if (error) {
    redirect(buildEditTemplateRedirect(id, error.message))
  }

  redirect('/dashboard/templates')
}

export async function deleteTemplate(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') ?? '').trim()

  if (!id) {
    redirect(buildTemplatesRedirect('Template not found.'))
  }

  const { error } = await supabase.from('trip_templates').delete().eq('id', id)

  if (error) {
    redirect(buildTemplatesRedirect(error.message))
  }

  redirect('/dashboard/templates')
}
