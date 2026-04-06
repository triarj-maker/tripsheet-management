import { redirect } from 'next/navigation'

type MyTripSheetDetailPageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function MyTripSheetDetailPage({
  params,
}: MyTripSheetDetailPageProps) {
  const { id } = await params

  redirect(`/trip-sheets/${id}?from=my-trip-sheets`)
}
