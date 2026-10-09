import { redirect } from 'next/navigation'

import { getCurrentUserProfile, getSignedInHomePath } from '@/app/dashboard/lib'
import { getInterfaceViewPreference } from '@/app/lib/interface-view-cookie'

export default async function Home() {
  const { user, profile } = await getCurrentUserProfile()
  const preference = await getInterfaceViewPreference(user.id)

  redirect(getSignedInHomePath(profile, preference))
}
