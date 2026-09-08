import 'server-only'

export const passwordRecoveryCookieName = 'trip-sheet-password-recovery'

export const passwordRecoveryCookieOptions = {
  httpOnly: true,
  maxAge: 10 * 60,
  path: '/',
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
}
