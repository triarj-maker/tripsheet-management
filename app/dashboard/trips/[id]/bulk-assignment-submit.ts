'use server'

import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { getURLFromRedirectError } from 'next/dist/client/components/redirect'
import { bulkAssignTripSheets } from '../actions'

// Presentation adapter only: retain the existing action's authorization,
// validation, target calculation, writes and success/error messages unchanged.
export async function submitBulkTripSheetAssignments(formData: FormData): Promise<{
  ok: boolean; error: string | null; redirectTo: string
}> {
  try {
    await bulkAssignTripSheets(formData)
  } catch (error) {
    if (!isRedirectError(error)) throw error
    const target = getURLFromRedirectError(error)
    const tripId = String(formData.get('trip_id') ?? '')
    const url = target ? new URL(target, 'https://echo.invalid') : null
    // Auth redirects and unexpected navigation remain framework redirects.
    if (!url || url.origin !== 'https://echo.invalid' || url.pathname !== `/dashboard/trips/${tripId}`) throw error
    const message = url.searchParams.get('error')
    return { ok: !message, error: message, redirectTo: `${url.pathname}${url.search}` }
  }
  throw new Error('The bulk assignment operation did not return a result.')
}
