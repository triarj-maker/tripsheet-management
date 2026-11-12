import { NextResponse } from 'next/server'

import { loadResourceAssignmentSchedule, requireScheduleAdmin } from '@/lib/resource-assignment-schedule.server'
import { parseScheduleFilter, selectScheduleTrips } from '@/lib/resource-assignment-schedule'
import { createResourceSchedulePdf, resourceSchedulePdfFilename } from '@/lib/resource-assignment-schedule-pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  // Independently enforce requireAdmin(), even when the page was never visited.
  await requireScheduleAdmin()
  const { id } = await context.params
  const result = await loadResourceAssignmentSchedule(id)
  if (result.error) return new NextResponse(result.error, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  if (!result.resource) return new NextResponse('Resource not found.', { status: 404, headers: { 'Cache-Control': 'no-store' } })

  const filters = new URL(request.url).searchParams.getAll('filter')
  const filter = parseScheduleFilter(filters.length > 1 ? filters : filters[0])
  const entries = selectScheduleTrips(result.entries, filter)
  const generatedAt = new Date()
  // Never fall back to an account email or UUID in a shareable document.
  const name = result.resource.full_name?.trim() || 'Unnamed resource'
  const pdf = createResourceSchedulePdf({ name, entries, filter, generatedAt })
  return new NextResponse(pdf as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${resourceSchedulePdfFilename(name, generatedAt)}"`,
      'Cache-Control': 'no-store',
    },
  })
}
