import { redirect } from 'next/navigation'

import AdminNav from '@/app/dashboard/AdminNav'
import { getCurrentUserProfile, getSignedInHomePath } from '@/app/dashboard/lib'

type TripSheet = {
  id: string
  body_text: string | null
}

type TripSheetViewPageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function TripSheetViewPage({
  params,
}: TripSheetViewPageProps) {
  const [{ id }, { supabase, user, profile }] = await Promise.all([
    params,
    getCurrentUserProfile(),
  ])

  const role = profile?.role ?? null

  if (role !== 'admin' && role !== 'resource') {
    redirect('/login?error=You%20do%20not%20have%20access%20to%20that%20page.')
  }

  if (role === 'resource') {
    const { data: assignment } = await supabase
      .from('trip_sheet_assignments')
      .select('id')
      .eq('trip_sheet_id', id)
      .eq('resource_user_id', user.id)
      .maybeSingle()

    if (!assignment) {
      redirect('/my-trip-sheets')
    }
  }

  const { data } = await supabase
    .from('trip_sheets')
    .select('id, body_text')
    .eq('id', id)
    .maybeSingle()

  const tripSheet = (data as TripSheet | null) ?? null

  if (!tripSheet) {
    redirect(getSignedInHomePath(role))
  }

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-12">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        <AdminNav
          current={role === 'resource' ? 'my-trip-sheets' : 'trip-sheets'}
          role={role}
        />

        <div className="rounded-xl border border-zinc-200 px-6 py-6 sm:px-8 sm:py-8">
          <div className="whitespace-pre-wrap text-base leading-7 text-gray-900 sm:text-lg sm:leading-8">
            {tripSheet.body_text ?? ''}
          </div>
        </div>
      </div>
    </main>
  )
}
