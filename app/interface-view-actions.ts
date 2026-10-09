'use server'

import { redirect } from 'next/navigation'

import { getCurrentUserProfile, getSignedInHomePath } from '@/app/dashboard/lib'
import {
  getInterfaceViewPreference,
  setInterfaceViewPreference,
} from '@/app/lib/interface-view-cookie'
import {
  getInterfaceViewHomePath,
  parseInterfaceView,
} from '@/lib/interface-view'
import { isAdminRole } from '@/lib/roles'

export async function switchInterfaceView(formData: FormData) {
  const { user, profile } = await getCurrentUserProfile()
  const requestedView = parseInterfaceView(formData.get('view'))

  if (!requestedView) {
    const preference = await getInterfaceViewPreference(user.id)
    redirect(getSignedInHomePath(profile, preference))
  }

  if (requestedView === 'admin' && !isAdminRole(profile)) {
    await setInterfaceViewPreference(user.id, 'resource')
    redirect('/my-trips')
  }

  await setInterfaceViewPreference(user.id, requestedView)
  redirect(getInterfaceViewHomePath(requestedView))
}
