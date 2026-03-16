import { redirect } from 'next/navigation'

import { getCurrentUserProfile, getSignedInHomePath } from '@/app/dashboard/lib'

export default async function Home() {
  const { profile } = await getCurrentUserProfile()

  redirect(getSignedInHomePath(profile?.role))
}
