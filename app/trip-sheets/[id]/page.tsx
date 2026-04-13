import { redirect } from 'next/navigation'

import { getCurrentUserProfile } from '@/app/dashboard/lib'
import { renderTripSheetDetailPage } from './TripSheetDetailPageContent'

type TripSheetViewPageProps = {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    from?: string
  }>
}

export default async function TripSheetViewPage({
  params,
  searchParams,
}: TripSheetViewPageProps) {
  const [{ id }, query, { profile }] = await Promise.all([
    params,
    searchParams,
    getCurrentUserProfile(),
  ])

  const role = profile?.role ?? null

  if (role !== 'admin' && role !== 'resource') {
    redirect('/login?error=You%20do%20not%20have%20access%20to%20that%20page.')
  }

  if (role === 'resource') {
    const params = new URLSearchParams()

    if (query.from) {
      params.set('from', query.from)
    }

    redirect(`/my-trip-sheets/${id}${params.size ? `?${params.toString()}` : ''}`)
  }

  return renderTripSheetDetailPage({
    id,
    from: query.from,
  })
}
