export const TEMPLATE_PAGE_SIZE = 100

type SearchValue = string | string[] | undefined
export type TemplateListingParams = {
  q?: SearchValue
  destination?: SearchValue
  status?: SearchValue
  sort?: SearchValue
  page?: SearchValue
  error?: SearchValue
}

export function parseTemplateListing(params: TemplateListingParams) {
  const q = typeof params.q === 'string' ? params.q.trim() : ''
  const destination = typeof params.destination === 'string' && (
    params.destination === 'unassigned' || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.destination)
  ) ? params.destination : ''
  const status = params.status === 'archived' || params.status === 'all' ? params.status : 'active'
  const sort = params.sort === 'name_asc' || params.sort === 'name_desc' || params.sort === 'updated_asc'
    ? params.sort : 'updated_desc'
  const pageValue = typeof params.page === 'string' ? Number(params.page) : 1
  const page = Number.isSafeInteger(pageValue) && pageValue >= 1 && pageValue <= 10000 ? pageValue : 1
  const query = new URLSearchParams()
  if (q) query.set('q', q)
  if (destination) query.set('destination', destination)
  if (status !== 'active') query.set('status', status)
  if (sort !== 'updated_desc') query.set('sort', sort)
  if (page > 1) query.set('page', String(page))
  return { q, destination, status, sort, page, hasFilters: query.size > 0,
    returnTo: `/dashboard/templates${query.size ? `?${query}` : ''}` }
}

export function escapeTemplateSearch(value: string) {
  return value.replace(/[\\%_]/g, '\\$&')
}

export function templateListingPageHref(returnTo: string, page: number) {
  const query = new URLSearchParams(returnTo.split('?')[1] ?? '')
  if (page > 1) query.set('page', String(page))
  else query.delete('page')
  return `/dashboard/templates${query.size ? `?${query}` : ''}`
}
