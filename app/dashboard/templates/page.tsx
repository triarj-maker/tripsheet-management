import Link from 'next/link'

import AdminNav from '@/app/dashboard/AdminNav'
import ActionLinkButton from '@/app/components/ActionLinkButton'
import TemplateActionsMenu from './TemplateActionsMenu'
import { escapeTemplateSearch, parseTemplateListing, TEMPLATE_PAGE_SIZE, templateListingPageHref, type TemplateListingParams } from './listing'
import { getLookupName, type LookupNameRelation } from '@/lib/trip-sheets'
import { APP_TIME_ZONE } from '@/lib/time'
import { requireAdmin } from './lib'

type TemplatesPageProps = {
  searchParams: Promise<TemplateListingParams>
}

type TripTemplate = {
  id: string
  title: string | null
  destination_id: string | null
  destination_ref: LookupNameRelation
  updated_at: string | null
  archived_at: string | null
}

function formatValue(value: string | null) {
  return value ?? '-'
}

function formatDateTime(value: string | null) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  const datePart = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
  const timePart = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)

  return `${datePart}, ${timePart}`
}

export default async function TemplatesPage({
  searchParams,
}: TemplatesPageProps) {
  const params = await searchParams
  const { supabase } = await requireAdmin()
  const filters = parseTemplateListing(params)
  let templateQuery = supabase.from('trip_templates')
    .select('id, title, destination_id, destination_ref:destinations(name), updated_at, archived_at', { count: 'exact' })
  if (filters.q) templateQuery = templateQuery.ilike('title', `%${escapeTemplateSearch(filters.q)}%`)
  if (filters.destination === 'unassigned') templateQuery = templateQuery.is('destination_id', null)
  else if (filters.destination) templateQuery = templateQuery.eq('destination_id', filters.destination)
  if (filters.status === 'active') templateQuery = templateQuery.is('archived_at', null)
  else if (filters.status === 'archived') templateQuery = templateQuery.not('archived_at', 'is', null)
  templateQuery = templateQuery.order(filters.sort.startsWith('name_') ? 'title' : 'updated_at', {
    ascending: filters.sort === 'name_asc' || filters.sort === 'updated_asc', nullsFirst: false,
  }).order('id', { ascending: true }).range((filters.page - 1) * TEMPLATE_PAGE_SIZE, filters.page * TEMPLATE_PAGE_SIZE - 1)
  const [templatesResult, destinationsResult] = await Promise.all([
    templateQuery,
    supabase.from('destinations').select('id, name').order('name', { ascending: true }),
  ])
  const { data, error, count } = templatesResult
  const tripTemplates = (data as TripTemplate[] | null) ?? []
  const destinations = destinationsResult.data ?? []

  return (
    <>
      <AdminNav current="templates" />

        <div className="app-page-header">
          <div>
            <h1 className="app-page-title">Templates</h1>
            <p className="app-page-subtitle">
              Create and maintain reusable trip templates.
            </p>
          </div>

          <ActionLinkButton
            href="/dashboard/templates/new"
            idleLabel="Create Template"
            pendingLabel="Creating…"
            className="ui-button-primary"
          />
        </div>

        {typeof params.error === 'string' && params.error ? (
          <p className="app-banner-error">
            {params.error}
          </p>
        ) : null}

        {error ? (
          <p className="app-banner-error">
            {error.message}
          </p>
        ) : null}

        {destinationsResult.error ? <p className="app-banner-error">Unable to load destination filters. Please try again.</p> : null}
        <form action="/dashboard/templates" method="get" key={filters.returnTo} className="app-section-card mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="q" className="ui-label-compact">Template name</label>
            <input id="q" name="q" type="search" defaultValue={filters.q} placeholder="Search templates…" className="ui-input ui-input-compact" />
          </div>
          <div>
            <label htmlFor="destination" className="ui-label-compact">Destination</label>
            <select id="destination" name="destination" defaultValue={filters.destination} className="ui-select ui-select-compact">
              <option value="">All Destinations</option>
              <option value="unassigned">Unassigned</option>
              {filters.destination && filters.destination !== 'unassigned' && !destinations.some(destination => destination.id === filters.destination)
                ? <option value={filters.destination}>Destination unavailable</option> : null}
              {destinations.map(destination => <option key={destination.id} value={destination.id}>{destination.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="status" className="ui-label-compact">Status</label>
            <select id="status" name="status" defaultValue={filters.status} className="ui-select ui-select-compact">
              <option value="active">Active</option><option value="archived">Archived</option><option value="all">All</option>
            </select>
          </div>
          <div>
            <label htmlFor="sort" className="ui-label-compact">Sort</label>
            <select id="sort" name="sort" defaultValue={filters.sort} className="ui-select ui-select-compact">
              <option value="updated_desc">Recently Updated</option><option value="name_asc">Name A–Z</option>
              <option value="name_desc">Name Z–A</option><option value="updated_asc">Oldest Updated</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-4">
            <button type="submit" className="ui-button ui-button-primary">Apply Filters</button>
            {filters.hasFilters ? <Link href="/dashboard/templates" className="ui-button ui-button-secondary">Clear Filters</Link> : null}
            {!error ? <p className="text-sm text-gray-500" role="status">{count ?? tripTemplates.length} matching template{(count ?? tripTemplates.length) === 1 ? '' : 's'}</p> : null}
          </div>
        </form>
        <div className="app-table-wrap">
          <table className="app-table whitespace-nowrap">
            <thead><tr>
              {['Template Name', 'Destination', 'Status', 'Last Updated', 'Actions'].map(label => (
                <th key={label} scope="col" className="px-4 py-3 font-medium text-gray-700">{label}</th>
              ))}
            </tr></thead>
            <tbody>
              {tripTemplates.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-5 text-gray-700">
                  {error ? 'Templates could not be loaded.' : 'No templates match your filters.'}
                </td></tr>
              ) : tripTemplates.map(template => (
                <tr key={template.id}>
                  <td className="px-4 py-2 text-gray-900">
                    <Link href={`/dashboard/templates/${template.id}/edit`} className="block max-w-[24rem] truncate font-semibold hover:underline" title={formatValue(template.title)}>
                      {formatValue(template.title)}
                    </Link>
                  </td>
                  <td className="px-4 py-2"><span className="block max-w-[16rem] truncate" title={getLookupName(template.destination_ref) ?? 'Unassigned'}>{template.destination_id ? getLookupName(template.destination_ref, 'Unknown destination') : 'Unassigned'}</span></td>
                  <td className="px-4 py-2"><span className={`ui-badge ${template.archived_at ? 'ui-badge-neutral' : 'ui-badge-green'}`}>{template.archived_at ? 'Archived' : 'Active'}</span></td>
                  <td className="px-4 py-2 text-gray-700">{formatDateTime(template.updated_at)}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-nowrap items-center gap-2">
                      <Link href={`/dashboard/templates/${template.id}/edit`} className="ui-button ui-button-secondary">Edit</Link>
                      <TemplateActionsMenu templateId={template.id} title={formatValue(template.title)} archived={Boolean(template.archived_at)} returnTo={filters.returnTo} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!error && (filters.page > 1 || filters.page * TEMPLATE_PAGE_SIZE < (count ?? 0)) ? (
          <nav aria-label="Template pages" className="mt-3 flex items-center gap-3 text-sm">
            {filters.page > 1 ? <Link className="ui-button ui-button-secondary" href={templateListingPageHref(filters.returnTo, filters.page - 1)}>Previous</Link> : null}
            <span>Page {filters.page}</span>
            {filters.page * TEMPLATE_PAGE_SIZE < (count ?? 0) ? <Link className="ui-button ui-button-secondary" href={templateListingPageHref(filters.returnTo, filters.page + 1)}>Next</Link> : null}
          </nav>
        ) : null}
    </>
  )
}
