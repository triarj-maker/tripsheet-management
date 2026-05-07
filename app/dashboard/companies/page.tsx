import { requireAdmin } from '@/app/dashboard/lib'
import LookupManagementPage from '@/app/dashboard/lookup-management/LookupManagementPage'

import { createCompany, toggleCompanyActive, updateCompany } from './actions'

type CompaniesPageProps = {
  searchParams: Promise<{
    error?: string
  }>
}

type CompanyRow = {
  id: string
  name: string | null
  is_active: boolean | null
}

export default async function CompaniesPage({ searchParams }: CompaniesPageProps) {
  const params = await searchParams
  const { supabase } = await requireAdmin()
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, is_active')
    .order('is_active', { ascending: false })
    .order('name', { ascending: true })

  return (
    <LookupManagementPage
      current="companies"
      title="Companies"
      subtitle="Manage simple company lookup values used by trip forms."
      addLabel="Add Company"
      emptyLabel="No companies found."
      rows={(data as CompanyRow[] | null) ?? []}
      queryError={params.error}
      errorMessage={error?.message}
      createAction={createCompany}
      updateAction={updateCompany}
      toggleAction={toggleCompanyActive}
    />
  )
}
