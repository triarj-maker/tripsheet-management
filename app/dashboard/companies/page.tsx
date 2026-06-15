import Link from 'next/link'

import ActionSubmitButton from '@/app/components/ActionSubmitButton'
import AdminNav from '@/app/dashboard/AdminNav'
import { requireAdmin } from '@/app/dashboard/lib'
import { getCurrentDateStringInAppTimeZone } from '@/lib/time'
import { getVisibleTripState } from '@/lib/trip-workflow'

import { createCompany, toggleCompanyActive } from './actions'

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

type TripRow = {
  id: string
  company_id: string | null
  workflow_state: string | null
  is_archived: boolean | null
  start_date: string | null
  end_date: string | null
}

type TripSummary = {
  active: number
  tentative: number
  upcoming: number
}

function statusBadgeClass(isActive: boolean) {
  return ['ui-badge', isActive ? 'ui-badge-green' : 'ui-badge-neutral'].join(' ')
}

function buildTripSummaryByCompany(trips: TripRow[], today: string) {
  const summaryByCompanyId = new Map<string, TripSummary>()

  for (const trip of trips) {
    if (!trip.company_id) {
      continue
    }

    const summary =
      summaryByCompanyId.get(trip.company_id) ?? {
        active: 0,
        tentative: 0,
        upcoming: 0,
      }
    const state = getVisibleTripState({
      workflowState: trip.workflow_state,
      isArchived: trip.is_archived === true,
      endDate: trip.end_date,
      today,
    })

    if (state === 'active') {
      summary.active += 1
    }

    if (state === 'tentative') {
      summary.tentative += 1
    }

    if (state !== 'archived' && state !== 'completed') {
      summary.upcoming += 1
    }

    summaryByCompanyId.set(trip.company_id, summary)
  }

  return summaryByCompanyId
}

function TripSummaryText({ summary }: { summary?: TripSummary }) {
  if (!summary || (summary.active === 0 && summary.tentative === 0 && summary.upcoming === 0)) {
    return <span className="text-gray-500">No active or upcoming linked trips</span>
  }

  return (
    <div className="flex flex-wrap gap-2 text-sm">
      <span className="ui-badge ui-badge-blue">{summary.active} active</span>
      <span className="ui-badge ui-badge-neutral">{summary.tentative} tentative</span>
      <span className="ui-badge ui-badge-green">{summary.upcoming} upcoming</span>
    </div>
  )
}

export default async function CompaniesPage({ searchParams }: CompaniesPageProps) {
  const params = await searchParams
  const { supabase } = await requireAdmin()
  const today = getCurrentDateStringInAppTimeZone()
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, is_active')
    .order('is_active', { ascending: false })
    .order('name', { ascending: true })
  const { data: tripData, error: tripsError } = await supabase
    .from('trips')
    .select('id, company_id, workflow_state, is_archived, start_date, end_date')
    .not('company_id', 'is', null)

  const companies = (data as CompanyRow[] | null) ?? []
  const summaryByCompanyId = buildTripSummaryByCompany((tripData as TripRow[] | null) ?? [], today)
  const errorMessage = error?.message || tripsError?.message || null

  return (
    <>
      <AdminNav current="companies" />

      <div className="app-page-header">
        <div>
          <h1 className="app-page-title">Companies</h1>
          <p className="app-page-subtitle">
            See company lookup values and the trip work connected to each company.
          </p>
        </div>
      </div>

      {params.error ? <p className="app-banner-error">{params.error}</p> : null}
      {errorMessage ? <p className="app-banner-error">{errorMessage}</p> : null}

      <section className="app-section-card mb-5">
        <form
          action={createCompany}
          className="grid gap-3 md:grid-cols-[minmax(16rem,1fr)_auto] md:items-end"
        >
          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">Add Company</h2>
            <label htmlFor="company_name" className="ui-label">
              Company name
            </label>
            <input
              id="company_name"
              name="name"
              type="text"
              required
              className="ui-input ui-input-compact"
            />
          </div>
          <ActionSubmitButton
            idleLabel="Add"
            pendingLabel="Adding..."
            className="ui-button-primary ui-button-compact"
          />
        </form>
      </section>

      <div className="app-table-wrap">
        <table className="app-table">
          <thead>
            <tr>
              <th className="px-4 py-3 font-medium text-gray-700">Company</th>
              <th className="px-4 py-3 font-medium text-gray-700">Trip Summary</th>
              <th className="w-[9rem] px-4 py-3 font-medium text-gray-700">Status</th>
              <th className="w-[16rem] px-4 py-3 font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {companies.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-5 text-gray-700">
                  No companies found.
                </td>
              </tr>
            ) : (
              companies.map((company) => {
                const companyId = company.id
                const companyName = company.name?.trim() || 'Untitled company'
                const isActive = company.is_active === true

                return (
                  <tr key={companyId} className={isActive ? 'align-top' : 'align-top opacity-70'}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{companyName}</p>
                    </td>
                    <td className="px-4 py-3">
                      <TripSummaryText summary={summaryByCompanyId.get(companyId)} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={statusBadgeClass(isActive)}>
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/dashboard/companies/${companyId}`}
                          className="ui-button ui-button-secondary ui-button-compact"
                        >
                          Open
                        </Link>
                        <form action={toggleCompanyActive}>
                          <input type="hidden" name="id" value={companyId} />
                          <input
                            type="hidden"
                            name="next_is_active"
                            value={isActive ? 'false' : 'true'}
                          />
                          <ActionSubmitButton
                            idleLabel={isActive ? 'Deactivate' : 'Activate'}
                            pendingLabel="Saving..."
                            className="ui-button-secondary ui-button-compact"
                          />
                        </form>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
