import { eligibleProfiles, type PermissionProfile } from '@/lib/roles'
import type { TaskListItem } from '@/lib/trip-tasks'

import type { TaskAssignee, TaskPageData, TaskTrip, TaskTripSheet } from './types'

type SupabaseClient = Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>
type AssigneeRow = TaskAssignee & PermissionProfile

const taskSelect = 'id, title, description, trip_id, trip_sheet_id, assigned_to, due_at, status, completed_at, trip:trips(id, title), trip_sheet:trip_sheets(id, title), assignee:profiles!trip_tasks_assigned_to_fkey(id, full_name, email)'

export async function getTaskPageData(
  supabase: SupabaseClient,
  filters: { assignedTo?: string; tripId?: string; includeEditorData?: boolean } = {}
): Promise<{ data: TaskPageData; error: string | null }> {
  let taskQuery = supabase.from('trip_tasks').select(taskSelect)
  if (filters.assignedTo) taskQuery = taskQuery.eq('assigned_to', filters.assignedTo)
  if (filters.tripId) taskQuery = taskQuery.eq('trip_id', filters.tripId)

  let sheetQuery = supabase.from('trip_sheets').select('id, trip_id, title').order('title')
  if (filters.tripId) sheetQuery = sheetQuery.eq('trip_id', filters.tripId)

  const editorData = filters.includeEditorData !== false
  const [tasksResult, tripsResult, sheetsResult, assigneesResult] = await Promise.all([
    taskQuery,
    editorData ? supabase.from('trips').select('id, title').order('title') : Promise.resolve({ data: [], error: null }),
    editorData ? sheetQuery : Promise.resolve({ data: [], error: null }),
    editorData ? supabase
      .from('profiles')
      .select('id, full_name, email, is_admin, is_active, profile_operational_roles(role_code)')
      .eq('is_active', true)
      .order('full_name') : Promise.resolve({ data: [], error: null }),
  ])

  const assignees = eligibleProfiles((assigneesResult.data as AssigneeRow[] | null) ?? [])
    .map(({ id, full_name, email }) => ({ id, full_name, email }))

  return {
    data: {
      tasks: (tasksResult.data as TaskListItem[] | null) ?? [],
      trips: (tripsResult.data as TaskTrip[] | null) ?? [],
      tripSheets: (sheetsResult.data as TaskTripSheet[] | null) ?? [],
      assignees,
    },
    error:
      tasksResult.error?.message || tripsResult.error?.message ||
      sheetsResult.error?.message || assigneesResult.error?.message || null,
  }
}
