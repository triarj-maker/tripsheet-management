import { renderTripSheetDetailPage } from '@/app/trip-sheets/[id]/TripSheetDetailPageContent'

type MyTripSheetDetailPageProps = {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    from?: string
  }>
}

export default async function MyTripSheetDetailPage({
  params,
  searchParams,
}: MyTripSheetDetailPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams])

  return renderTripSheetDetailPage({
    id,
    from: query.from ?? 'my-trip-sheets',
  })
}
