'use server'

import { redirect } from 'next/navigation'

import { requireAdmin } from '@/app/dashboard/lib'
import { appendToastParam } from '@/app/lib/action-feedback'

function buildCompaniesRedirect(error: string) {
  const params = new URLSearchParams({ error })
  return `/dashboard/companies?${params.toString()}`
}

function normalizeName(formData: FormData) {
  return String(formData.get('name') ?? '').trim()
}

function getReturnPath(formData: FormData) {
  const returnPath = String(formData.get('return_path') ?? '').trim()

  if (returnPath.startsWith('/dashboard/companies')) {
    return returnPath
  }

  return '/dashboard/companies'
}

export async function createCompany(formData: FormData) {
  const { supabase } = await requireAdmin()
  const name = normalizeName(formData)

  if (!name) {
    redirect(buildCompaniesRedirect('Company name is required.'))
  }

  const { error } = await supabase.from('companies').insert({
    name,
    is_active: true,
  })

  if (error) {
    redirect(buildCompaniesRedirect(error.message))
  }

  redirect(appendToastParam('/dashboard/companies'))
}

export async function updateCompany(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') ?? '').trim()
  const name = normalizeName(formData)
  const isActive = formData.get('is_active') === 'on'
  const returnPath = getReturnPath(formData)

  if (!id) {
    redirect(buildCompaniesRedirect('Company not found.'))
  }

  if (!name) {
    redirect(buildCompaniesRedirect('Company name is required.'))
  }

  const { error } = await supabase
    .from('companies')
    .update({
      name,
      is_active: isActive,
    })
    .eq('id', id)

  if (error) {
    redirect(buildCompaniesRedirect(error.message))
  }

  redirect(appendToastParam(returnPath))
}

export async function toggleCompanyActive(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') ?? '').trim()
  const nextIsActive = formData.get('next_is_active') === 'true'
  const returnPath = getReturnPath(formData)

  if (!id) {
    redirect(buildCompaniesRedirect('Company not found.'))
  }

  const { error } = await supabase
    .from('companies')
    .update({
      is_active: nextIsActive,
    })
    .eq('id', id)

  if (error) {
    redirect(buildCompaniesRedirect(error.message))
  }

  redirect(appendToastParam(returnPath))
}
