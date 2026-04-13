import { redirect } from 'next/navigation'

export default async function DashboardMyTripsRedirectPage() {
  redirect('/my-trips')
}
