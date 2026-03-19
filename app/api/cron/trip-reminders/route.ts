import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { sendReminderEmail } from '@/lib/email'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = new Date()

// Convert to IST
const todayIST = new Date(
  now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
)

// Add 3 days
const targetDate = new Date(todayIST)
targetDate.setDate(todayIST.getDate() + 3)

// Format YYYY-MM-DD
const targetDateString = targetDate.toISOString().split('T')[0]

// Debug logs (temporary)
console.log('Today IST:', todayIST)
console.log('Target Date:', targetDateString)

  const { data: tripSheets, error: tripSheetsError } = await supabase
    .from('trip_sheets')
    .select('id, title, start_date, end_date, guest_name, company, is_archived')
    .eq('start_date', targetDateString)
    .eq('is_archived', false)

  if (tripSheetsError) {
    return NextResponse.json(
      { success: false, error: tripSheetsError.message },
      { status: 500 }
    )
  }

  for (const tripSheet of tripSheets ?? []) {
    const { data: assignments, error: assignmentsError } = await supabase
      .from('trip_sheet_assignments')
      .select('resource_user_id')
      .eq('trip_sheet_id', tripSheet.id)

    if (assignmentsError) {
      continue
    }

    for (const assignment of assignments ?? []) {
      const resourceUserId = assignment.resource_user_id

      const { data: existingNotification } = await supabase
        .from('trip_sheet_notifications')
        .select('id')
        .eq('trip_sheet_id', tripSheet.id)
        .eq('resource_user_id', resourceUserId)
        .eq('notification_type', 'reminder_3_day')
        .maybeSingle()

      if (existingNotification) {
        continue
      }

      const { data: resource, error: resourceError } = await supabase
        .from('profiles')
        .select('id, full_name, email, is_active')
        .eq('id', resourceUserId)
        .maybeSingle()

      if (resourceError || !resource || !resource.email || !resource.is_active) {
        await supabase.from('trip_sheet_notifications').insert({
          trip_sheet_id: tripSheet.id,
          resource_user_id: resourceUserId,
          notification_type: 'reminder_3_day',
          email: resource?.email ?? '',
          status: 'failed',
          error_message:
            resourceError?.message ?? 'Reminder skipped: active resource email not found.',
        })
        continue
      }

      try {
        await sendReminderEmail({
          to: resource.email,
          resourceName: resource.full_name,
          tripTitle: tripSheet.title,
          startDate: tripSheet.start_date,
          endDate: tripSheet.end_date,
          customer: tripSheet.guest_name || tripSheet.company,
          tripId: tripSheet.id,
        })

        await supabase.from('trip_sheet_notifications').insert({
          trip_sheet_id: tripSheet.id,
          resource_user_id: resource.id,
          notification_type: 'reminder_3_day',
          email: resource.email,
          status: 'sent',
        })
      } catch (err: unknown) {
        await supabase.from('trip_sheet_notifications').insert({
          trip_sheet_id: tripSheet.id,
          resource_user_id: resource.id,
          notification_type: 'reminder_3_day',
          email: resource.email,
          status: 'failed',
          error_message:
            err instanceof Error ? err.message : 'Unknown reminder email error.',
        })
      }
    }
  }

  return NextResponse.json({
    success: true,
    targetDate: targetDateString,
  })
}
