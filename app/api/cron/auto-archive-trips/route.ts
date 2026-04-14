import { NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import { addDaysToDateString, getCurrentDateStringInAppTimeZone } from '@/lib/time'

function getBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader?.startsWith('Bearer ')) {
    return ''
  }

  return authorizationHeader.slice('Bearer '.length).trim()
}

function getArchiveCutoffDate() {
  return addDaysToDateString(getCurrentDateStringInAppTimeZone(), -3)
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim()

  if (!cronSecret) {
    return NextResponse.json(
      { error: 'Missing CRON_SECRET configuration.' },
      { status: 500 }
    )
  }

  const bearerToken = getBearerToken(request.headers.get('authorization'))

  if (bearerToken !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const cutoffDate = getArchiveCutoffDate()
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('trip_sheets')
    .update({ is_archived: true })
    .eq('is_archived', false)
    .lt('end_date', cutoffDate)
    .select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    archivedCount: data?.length ?? 0,
    cutoffDate,
    ok: true,
  })
}
