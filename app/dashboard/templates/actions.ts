'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

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

function buildNewTemplateRedirect(error: string, duplicateFrom?: string) {
  const params = new URLSearchParams({ error })
  if (duplicateFrom) params.set('duplicateFrom', duplicateFrom)
  return `/dashboard/templates/new?${params.toString()}`
}

function buildEditTemplateRedirect(id: string, error: string, hash?: string) {
  const params = new URLSearchParams({ error })
  return `/dashboard/templates/${id}/edit?${params.toString()}${hash ?? ''}`
}

function buildEditTemplatePath(id: string) {
  return `/dashboard/templates/${id}/edit`
}

function buildEditTemplateModuleCardsPath(id: string) {
  return `${buildEditTemplatePath(id)}#module-cards`
}

function normalizeCardCategory(value: FormDataEntryValue | null) {
  const category = String(value ?? '').trim()

  return category === 'facilitator' || category === 'expert' ? category : null
}

function parseSortOrder(value: FormDataEntryValue | null) {
  const normalizedValue = String(value ?? '').trim()

  if (!normalizedValue) {
    return 0
  }

  const parsedValue = Number.parseInt(normalizedValue, 10)

  return Number.isNaN(parsedValue) ? null : parsedValue
}

function validateTemplateCardInput(formData: FormData) {
  const title = String(formData.get('title') ?? '').trim()
  const category = normalizeCardCategory(formData.get('category'))
  const cardUrl = String(formData.get('card_url') ?? '').trim()
  const sortOrder = parseSortOrder(formData.get('sort_order'))

  if (!title) {
    return { error: 'Card title is required.' }
  }

  if (!category) {
    return { error: 'Card category must be Facilitator or Expert.' }
  }

  if (!cardUrl) {
    return { error: 'Card URL is required.' }
  }

  if (!cardUrl.startsWith('/module-cards/')) {
    return { error: 'Card URL must start with /module-cards/.' }
  }

  if (sortOrder === null) {
    return { error: 'Sort order must be a whole number.' }
  }

  return {
    title,
    category,
    cardUrl,
    sortOrder,
  }
}

async function templateExists(
  supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'],
  templateId: string
) {
  if (!templateId) {
    return false
  }

  const { data, error } = await supabase
    .from('trip_templates')
    .select('id')
    .eq('id', templateId)
    .maybeSingle()

  return !error && Boolean(data)
}

function validateTemplateInput(formData: FormData) {
  const title = String(formData.get('title') ?? '').trim()
  const heading = String(formData.get('heading') ?? '').trim()
  const defaultStartTime = normalizeOptionalTime(formData.get('default_start_time'))
  const defaultEndTime = normalizeOptionalTime(formData.get('default_end_time'))
  const body = String(formData.get('body') ?? '')
  const destinationId = String(formData.get('destination_id') ?? '').trim()

  if (destinationId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(destinationId)) {
    return { error: 'Select a valid destination.' }
  }

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
    destinationId: destinationId || null,
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

async function validateDestination(
  supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'],
  destinationId: string | null
) {
  if (!destinationId) return null
  const { data, error } = await supabase.from('destinations').select('id').eq('id', destinationId).maybeSingle()
  return error ? 'Unable to verify destination. Please try again.' : data ? null : 'Selected destination was not found.'
}

export async function createTemplate(formData: FormData) {
  const { supabase, user } = await requireAdmin()
  const duplicateFrom = String(formData.get('duplicate_from') ?? '').trim()
  const result = validateTemplateInput(formData)

  if ('error' in result) {
    redirect(buildNewTemplateRedirect(result.error ?? 'Invalid template input.', duplicateFrom))
  }
  const destinationError = await validateDestination(supabase, result.destinationId)
  if (destinationError) redirect(buildNewTemplateRedirect(destinationError, duplicateFrom))

  let sourceCards: Array<{ title: string; category: string; card_url: string; sort_order: number }> = []
  if (duplicateFrom) {
    if (!(await templateExists(supabase, duplicateFrom))) {
      redirect(buildNewTemplateRedirect('Template to duplicate was not found.', duplicateFrom))
    }
    const { data, error } = await supabase.from('template_cards')
      .select('title, category, card_url, sort_order').eq('template_id', duplicateFrom)
    if (error) redirect(buildNewTemplateRedirect(error.message, duplicateFrom))
    sourceCards = data ?? []
  }

  const { data: created, error } = await supabase.from('trip_templates').insert({
    title: result.title,
    heading: result.heading,
    default_start_time: result.defaultStartTime,
    default_end_time: result.defaultEndTime,
    destination_id: result.destinationId,
    archived_at: null,
    body: result.body,
    created_by: user.id,
  }).select('id').single()

  if (error || !created) {
    redirect(buildNewTemplateRedirect(error?.message ?? 'Template could not be created.', duplicateFrom))
  }
  if (sourceCards.length) {
    const { error: cardsError } = await supabase.from('template_cards')
      .insert(sourceCards.map(card => ({ ...card, template_id: created.id })))
    if (cardsError) {
      const { error: cleanupError } = await supabase.from('trip_templates').delete().eq('id', created.id)
      if (cleanupError) {
        redirect(buildEditTemplateRedirect(created.id, 'Template created, but cards could not be copied. Review this template before retrying duplication.'))
      }
      redirect(buildNewTemplateRedirect(cardsError.message, duplicateFrom))
    }
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

  const destinationError = await validateDestination(supabase, result.destinationId)
  if (destinationError) redirect(buildEditTemplateRedirect(id, destinationError))

  const { error } = await supabase
    .from('trip_templates')
    .update({
      title: result.title,
      heading: result.heading,
      default_start_time: result.defaultStartTime,
      default_end_time: result.defaultEndTime,
      destination_id: result.destinationId,
      body: result.body,
    })
    .eq('id', id)

  if (error) {
    redirect(buildEditTemplateRedirect(id, error.message))
  }

  redirect(appendToastParam(`${buildEditTemplatePath(id)}#template-details`, 'Template saved.'))
}

function templateListingReturnPath(formData: FormData) {
  const value = String(formData.get('return_to') ?? '')
  return value === '/dashboard/templates' || value.startsWith('/dashboard/templates?') ? value : '/dashboard/templates'
}

function templateListingError(path: string, error: string) {
  const params = new URLSearchParams(path.split('?')[1] ?? '')
  params.set('error', error)
  return `/dashboard/templates?${params}`
}

async function setTemplateArchived(formData: FormData, archive: boolean) {
  const { supabase } = await requireAdmin()
  const returnTo = templateListingReturnPath(formData)
  const id = String(formData.get('id') ?? '').trim()
  if (!id) redirect(templateListingError(returnTo, 'Template not found.'))

  const { data: template, error: loadError } = await supabase.from('trip_templates')
    .select('id, archived_at').eq('id', id).maybeSingle()
  if (loadError || !template) {
    redirect(templateListingError(returnTo, loadError?.message ?? 'Template not found.'))
  }

  // Repeated requests are no-ops; never replace an existing archive timestamp.
  if (archive ? template.archived_at === null : template.archived_at !== null) {
    const update = supabase.from('trip_templates')
      .update({ archived_at: archive ? new Date().toISOString() : null }).eq('id', id)
    const { error } = archive
      ? await update.is('archived_at', null)
      : await update.eq('archived_at', template.archived_at)
    if (error) redirect(templateListingError(returnTo, error.message))
  }
  revalidatePath('/dashboard/templates')
  revalidatePath(`/dashboard/templates/${id}/edit`)
  revalidatePath('/dashboard/trip-sheets/new')
  redirect(appendToastParam(returnTo, archive ? 'Template archived.' : 'Template restored.'))
}

export async function archiveTemplate(formData: FormData) {
  return setTemplateArchived(formData, true)
}

export async function restoreTemplate(formData: FormData) {
  return setTemplateArchived(formData, false)
}

export async function deleteTemplate(formData: FormData) {
  const { supabase } = await requireAdmin()
  const returnTo = templateListingReturnPath(formData)
  const id = String(formData.get('id') ?? '').trim()

  if (!id) {
    redirect(templateListingError(returnTo, 'Template not found.'))
  }

  const { error } = await supabase.from('trip_templates').delete().eq('id', id)

  if (error) {
    redirect(templateListingError(returnTo, error.message))
  }

  redirect(appendToastParam(returnTo))
}

export async function createTemplateCard(formData: FormData) {
  const { supabase } = await requireAdmin()
  const templateId = String(formData.get('template_id') ?? '').trim()

  if (!templateId) {
    redirect(buildTemplatesRedirect('Template not found.'))
  }

  if (!(await templateExists(supabase, templateId))) {
    redirect(buildTemplatesRedirect('Template not found.'))
  }

  const result = validateTemplateCardInput(formData)

  if ('error' in result) {
    redirect(buildEditTemplateRedirect(templateId, result.error ?? 'Invalid card input.', '#module-cards'))
  }

  const { error } = await supabase.from('template_cards').insert({
    template_id: templateId,
    title: result.title,
    category: result.category,
    card_url: result.cardUrl,
    sort_order: result.sortOrder,
  })

  if (error) {
    redirect(buildEditTemplateRedirect(templateId, error.message, '#module-cards'))
  }

  redirect(appendToastParam(buildEditTemplateModuleCardsPath(templateId), 'Module card added.'))
}

export async function updateTemplateCard(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') ?? '').trim()
  const templateId = String(formData.get('template_id') ?? '').trim()

  if (!id || !templateId) {
    redirect(buildTemplatesRedirect('Module card not found.'))
  }

  const { data: cardData, error: cardError } = await supabase
    .from('template_cards')
    .select('id, template_id')
    .eq('id', id)
    .eq('template_id', templateId)
    .maybeSingle()

  if (cardError || !cardData) {
    redirect(buildEditTemplateRedirect(templateId, cardError?.message ?? 'Module card not found.', '#module-cards'))
  }

  const result = validateTemplateCardInput(formData)

  if ('error' in result) {
    redirect(buildEditTemplateRedirect(templateId, result.error ?? 'Invalid card input.', '#module-cards'))
  }

  const { error } = await supabase
    .from('template_cards')
    .update({
      title: result.title,
      category: result.category,
      card_url: result.cardUrl,
      sort_order: result.sortOrder,
    })
    .eq('id', id)
    .eq('template_id', templateId)

  if (error) {
    redirect(buildEditTemplateRedirect(templateId, error.message, '#module-cards'))
  }

  redirect(appendToastParam(buildEditTemplateModuleCardsPath(templateId), 'Module card updated.'))
}

export async function deleteTemplateCard(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') ?? '').trim()
  const templateId = String(formData.get('template_id') ?? '').trim()

  if (!id || !templateId) {
    redirect(buildTemplatesRedirect('Module card not found.'))
  }

  const { error } = await supabase
    .from('template_cards')
    .delete()
    .eq('id', id)
    .eq('template_id', templateId)

  if (error) {
    redirect(buildEditTemplateRedirect(templateId, error.message, '#module-cards'))
  }

  redirect(appendToastParam(buildEditTemplateModuleCardsPath(templateId), 'Module card deleted.'))
}
