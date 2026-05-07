import { requireAdmin } from '@/app/dashboard/lib'
import LookupManagementPage from '@/app/dashboard/lookup-management/LookupManagementPage'

import { createSchool, toggleSchoolActive, updateSchool } from './actions'

type SchoolsPageProps = {
  searchParams: Promise<{
    error?: string
  }>
}

type SchoolRow = {
  id: string
  name: string | null
  is_active: boolean | null
}

export default async function SchoolsPage({ searchParams }: SchoolsPageProps) {
  const params = await searchParams
  const { supabase } = await requireAdmin()
  const { data, error } = await supabase
    .from('schools')
    .select('id, name, is_active')
    .order('is_active', { ascending: false })
    .order('name', { ascending: true })

  return (
    <LookupManagementPage
      current="schools"
      title="Schools"
      subtitle="Manage simple school lookup values used by trip forms."
      addLabel="Add School"
      emptyLabel="No schools found."
      rows={(data as SchoolRow[] | null) ?? []}
      queryError={params.error}
      errorMessage={error?.message}
      createAction={createSchool}
      updateAction={updateSchool}
      toggleAction={toggleSchoolActive}
    />
  )
}
