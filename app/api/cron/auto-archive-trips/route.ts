import { NextResponse } from 'next/server'

function getBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader?.startsWith('Bearer ')) {
    return ''
  }

  return authorizationHeader.slice('Bearer '.length).trim()
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

  return NextResponse.json({
    archivedCount: 0,
    disabled: true,
    reason: 'Automatic trip archiving is disabled. Completed trips remain distinct from archived trips.',
    ok: true,
  })
}
