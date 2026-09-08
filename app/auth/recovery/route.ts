import { NextResponse } from 'next/server'

import {
  passwordRecoveryCookieName,
  passwordRecoveryCookieOptions,
} from '@/lib/auth-recovery'
import { createClient } from '@/lib/supabase/server'

function createRedirect(request: Request, path: string) {
  const response = NextResponse.redirect(new URL(path, request.url))
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const invalidPath = '/reset-password?error=invalid_or_expired'

  if (!code) {
    const response = createRedirect(request, invalidPath)
    response.cookies.delete(passwordRecoveryCookieName)
    return response
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    const response = createRedirect(request, invalidPath)
    response.cookies.delete(passwordRecoveryCookieName)
    return response
  }

  const response = createRedirect(request, '/reset-password')
  response.cookies.set(
    passwordRecoveryCookieName,
    data.user.id,
    passwordRecoveryCookieOptions
  )

  return response
}
