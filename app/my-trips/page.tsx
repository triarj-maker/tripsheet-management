import { redirect } from 'next/navigation'

export default async function MyTripsPage() {
  redirect('/dashboard/my-trips')
}
