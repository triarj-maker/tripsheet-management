'use server'

import { redirect } from 'next/navigation'

import { getSignedInHomePath } from '@/app/dashboard/lib'
import { createClient } from '@/lib/supabase/server'

function buildLoginRedirect(error: string) {
  const params = new URLSearchParams({ error })
  return `/login?${params.toString()}`
}

export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    redirect(buildLoginRedirect('Email and password are required.'))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect(buildLoginRedirect(error.message))
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .maybeSingle()

    const currentProfile = (profile as {
      role: string | null
      is_active: boolean | null
    } | null)

    if (currentProfile?.is_active === false) {
      await supabase.auth.signOut()
      redirect(buildLoginRedirect('Your account is inactive.'))
    }

    redirect(getSignedInHomePath(currentProfile?.role))
  }

  redirect(getSignedInHomePath(null))
}

export async function logout() {
  const supabase = await createClient()

  await supabase.auth.signOut()

  redirect('/login')
}
