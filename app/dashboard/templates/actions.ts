'use server'

import { redirect } from 'next/navigation'

import { appendToastParam } from '@/app/lib/action-feedback'

import { requireAdmin } from './lib'
import {
  TEMPLATE_BODY_MAX_LENGTH,
  TEMPLATE_TITLE_MAX_LENGTH,
} from './validation'

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
  const heading = String(formData.get('heading') ?? '').trim()
  const defaultStartTime = normalizeOptionalTime(formData.get('default_start_time'))
  const defaultEndTime = normalizeOptionalTime(formData.get('default_end_time'))
  const body = String(formData.get('body') ?? '')

  if (!title) {
    return { error: 'Title is required.' }
  }

  if (title.length > TEMPLATE_TITLE_MAX_LENGTH) {
    return {
      error: `Title must be ${TEMPLATE_TITLE_MAX_LENGTH} characters or fewer.`,
    }
  }

  if (!body.trim()) {
    return { error: 'Body is required.' }
  }

  if (body.length > TEMPLATE_BODY_MAX_LENGTH) {
    return {
      error: `Body must be ${TEMPLATE_BODY_MAX_LENGTH} characters or fewer.`,
    }
  }

  if (defaultStartTime === false || defaultEndTime === false) {
    return { error: 'Default start and end times must be valid times.' }
  }

  return {
    title,
    heading: heading || null,
    defaultStartTime,
    defaultEndTime,
    body,
  }
}

function normalizeOptionalTime(value: FormDataEntryValue | null) {
  const normalizedValue = String(value ?? '').trim()

  if (!normalizedValue) {
    return null
  }

  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(normalizedValue)) {
    return false
  }

  return normalizedValue
}

export async function createTemplate(formData: FormData) {
  const { supabase, user } = await requireAdmin()
  const result = validateTemplateInput(formData)

  if ('error' in result) {
    redirect(buildNewTemplateRedirect(result.error ?? 'Invalid template input.'))
  }

  const { error } = await supabase.from('trip_templates').insert({
    title: result.title,
    heading: result.heading,
    default_start_time: result.defaultStartTime,
    default_end_time: result.defaultEndTime,
    body: result.body,
    created_by: user.id,
  })

  if (error) {
    redirect(buildNewTemplateRedirect(error.message))
  }

  redirect(appendToastParam('/dashboard/templates'))
}

export async function updateTemplate(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') ?? '').trim()

  if (!id) {
    redirect(buildTemplatesRedirect('Template not found.'))
  }

  const result = validateTemplateInput(formData)

  if ('error' in result) {
    redirect(buildEditTemplateRedirect(id, result.error ?? 'Invalid template input.'))
  }

  const { error } = await supabase
    .from('trip_templates')
    .update({
      title: result.title,
      heading: result.heading,
      default_start_time: result.defaultStartTime,
      default_end_time: result.defaultEndTime,
      body: result.body,
    })
    .eq('id', id)

  if (error) {
    redirect(buildEditTemplateRedirect(id, error.message))
  }

  redirect(appendToastParam('/dashboard/templates'))
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

  redirect(appendToastParam('/dashboard/templates'))
}
