'use server'

import { requireAdmin } from './lib'
import { ASSIGNABLE_ROLES, canBeAssignedToTripSheet } from '@/lib/roles'

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

  const { data: resourceProfiles, error: resourceProfileError } = await supabase
    .from('profiles')
    .select('id, role, is_active')
    .in('id', uniqueResourceUserIds)
    .in('role', [...ASSIGNABLE_ROLES])
    .eq('is_active', true)

  if (resourceProfileError) {
    return { error: resourceProfileError }
  }

  const assignableResourceIds = new Set(
    ((resourceProfiles as Array<{
      id: string
      role: string | null
      is_active: boolean | null
    }> | null) ?? [])
      .filter((profile) => canBeAssignedToTripSheet(profile.role))
      .map((profile) => profile.id)
  )

  if (
    uniqueResourceUserIds.some(
      (resourceUserId) => !assignableResourceIds.has(resourceUserId)
    )
  ) {
    return {
      error: new Error('Selected resource is not active or assignable.'),
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
