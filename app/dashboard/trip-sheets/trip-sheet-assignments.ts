'use server'

import { requireAdmin } from './lib'

type DashboardSupabaseClient = Awaited<ReturnType<typeof requireAdmin>>['supabase']

export async function insertTripSheetAssignments({
  supabase,
  tripSheetId,
  resourceUserIds,
  assignedBy,
}: {
  supabase: DashboardSupabaseClient
  tripSheetId: string
  resourceUserIds: string[]
  assignedBy: string
}) {
  const uniqueResourceUserIds = Array.from(
    new Set(resourceUserIds.map((value) => value.trim()).filter(Boolean))
  )

  if (uniqueResourceUserIds.length === 0) {
    return {
      error: null,
    }
  }

  const { error } = await supabase.from('trip_sheet_assignments').insert(
    uniqueResourceUserIds.map((resourceUserId) => ({
      trip_sheet_id: tripSheetId,
      resource_user_id: resourceUserId,
      assigned_by: assignedBy,
    }))
  )

  if (error) {
    return { error }
  }

  return {
    error: null,
  }
}
