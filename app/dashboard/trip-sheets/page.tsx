import { redirect } from 'next/navigation'

type LegacyTripSheetsPageProps = {
  searchParams: Promise<{
    error?: string
  }>
}

export default async function LegacyTripSheetsPage({
  searchParams,
}: LegacyTripSheetsPageProps) {
  const params = await searchParams
  const nextParams = new URLSearchParams()

  if (params.error) {
    nextParams.set('error', params.error)
  }

  redirect(`/dashboard/trips${nextParams.size ? `?${nextParams.toString()}` : ''}`)
}
