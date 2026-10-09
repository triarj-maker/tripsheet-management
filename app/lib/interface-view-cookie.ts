import { cookies } from 'next/headers'

import {
  INTERFACE_VIEW_COOKIE,
  parseInterfaceViewPreference,
  serializeInterfaceViewPreference,
  type InterfaceView,
} from '@/lib/interface-view'

export async function getInterfaceViewPreference(userId: string) {
  const cookieStore = await cookies()
  return parseInterfaceViewPreference(
    cookieStore.get(INTERFACE_VIEW_COOKIE)?.value,
    userId
  )
}

export async function setInterfaceViewPreference(userId: string, view: InterfaceView) {
  const cookieStore = await cookies()
  cookieStore.set(
    INTERFACE_VIEW_COOKIE,
    serializeInterfaceViewPreference(userId, view),
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    }
  )
}
