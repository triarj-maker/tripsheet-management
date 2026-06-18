import { NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { buildSimplePdfPages, createSimplePdf } from '@/lib/pdf'
import { isAdminRole } from '@/lib/roles'
import {
  renderClientItineraryHtml,
  renderClientItineraryPdfLines,
  type ClientItineraryTrip,
  type ClientItineraryTripSheet,
} from '@/lib/client-itinerary-html'

function sanitizeFileName(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'client-itinerary'
  )
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const tripId = id.trim()

  if (!tripId) {
    return new NextResponse('Trip not found.', { status: 404 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new NextResponse('Unauthorized.', { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, is_active')
    .eq('id', user.id)
    .maybeSingle()

  const currentProfile =
    (profile as { id: string; role: string | null; is_active: boolean | null } | null) ?? null

  if (
    !currentProfile ||
    currentProfile.is_active === false ||
    !isAdminRole(currentProfile.role)
  ) {
    return new NextResponse('Forbidden.', { status: 403 })
  }

  const adminClient = createAdminClient()
  const { data: tripData, error: tripError } = await adminClient
    .from('trips')
    .select(
      'id, title, trip_type, start_date, end_date, destination_ref:destinations(name), company_id, school_id, company_ref:companies(name), school_ref:schools(name), guest_name, company'
    )
    .eq('id', tripId)
    .maybeSingle()

  const trip = (tripData as ClientItineraryTrip | null) ?? null

  if (tripError || !trip) {
    return new NextResponse(tripError?.message ?? 'Trip not found.', { status: 404 })
  }

  const { data: tripSheetData, error: tripSheetsError } = await adminClient
    .from('trip_sheets')
    .select('id, title, start_date, start_time, end_date, end_time, body_text')
    .eq('trip_id', tripId)
    .eq('is_archived', false)
    .order('start_date', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: true })
    .order('end_date', { ascending: true, nullsFirst: true })
    .order('end_time', { ascending: true, nullsFirst: true })

  if (tripSheetsError) {
    return new NextResponse(tripSheetsError.message, { status: 500 })
  }

  const tripSheets = (tripSheetData as ClientItineraryTripSheet[] | null) ?? []

  // Rendered in memory for the V1 client itinerary pipeline; not persisted.
  renderClientItineraryHtml({ trip, tripSheets })

  const pdfLines = renderClientItineraryPdfLines({ trip, tripSheets })
  const pdfBuffer = createSimplePdf(buildSimplePdfPages(pdfLines), {
    footerText: 'Copyright 2026-27 Travspire Experiences Private Limited',
  })
  const fileName = `${sanitizeFileName(trip.title ?? 'trip')}-client-itinerary.pdf`

  return new NextResponse(pdfBuffer as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}
