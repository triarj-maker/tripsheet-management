import 'server-only'

import { cache } from 'react'
import { requireAdmin } from '@/app/dashboard/lib'
import type { PermissionProfile } from '@/lib/roles'
import {
  formatTripCustomerSummary,
  getDestinationName,
  getTripParent,
  type LookupNameRelation,
} from '@/lib/trip-sheets'
import type { ResourceScheduleEntry } from '@/lib/resource-assignment-schedule'

// Request-scoped: page and loader share the same verified authorization lookup.
export const requireScheduleAdmin = cache(requireAdmin)

type ScheduleResource = PermissionProfile & {
  id: string
  full_name: string | null
  email: string | null
  is_active: boolean | null
}

type Trip = {
  id: string
  start_date: string | null
  end_date: string | null
  title: string | null
  destination_ref: LookupNameRelation
  school_id: string | null
  company_id: string | null
  school_ref: LookupNameRelation
  company_ref: LookupNameRelation
  guest_name: string | null
  company: string | null
}

type TripSheet = {
  id: string
  trip_id: string
  title: string | null
  start_date: string | null
  start_time: string | null
  end_date: string | null
  end_time: string | null
  trip: Trip | Trip[] | null
}

type ScheduleResult = {
  resource: ScheduleResource | null
  entries: ResourceScheduleEntry[]
  error: string | null
}

export async function loadResourceAssignmentSchedule(resourceId: string): Promise<ScheduleResult> {
  // Never accept a client or permission flag from the caller as authorization.
  const { supabase } = await requireScheduleAdmin()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resourceId)) {
    return { resource: null, entries: [], error: null }
  }

  const { data, error } = await supabase.from('profiles')
    .select('id, full_name, email, is_active, is_admin, profile_operational_roles(role_code)')
    .eq('id', resourceId).maybeSingle()
  if (error) return { resource: null, entries: [], error: 'Unable to load resource details. Please try again.' }
  const resource = data as ScheduleResource | null
  if (!resource) return { resource: null, entries: [], error: null }

  const { data: assignments, error: assignmentError } = await supabase
    .from('trip_sheet_assignments').select('trip_sheet_id').eq('resource_user_id', resourceId)
  if (assignmentError) return { resource, entries: [], error: 'Unable to load assignments. Please try again.' }
  const ids = [...new Set((assignments ?? []).map(row => row.trip_sheet_id as string))]
  if (!ids.length) return { resource, entries: [], error: null }

  const { data: sheets, error: sheetError } = await supabase.from('trip_sheets')
    .select('id, trip_id, title, start_date, start_time, end_date, end_time, trip:trips!inner(id, start_date, end_date, title, destination_ref:destinations(name), company_id, school_id, company_ref:companies(name), school_ref:schools(name), guest_name, company)')
    .eq('is_archived', false).in('id', ids)
  if (sheetError) return { resource, entries: [], error: 'Unable to load the assignment schedule. Please try again.' }

  const entries = ((sheets as TripSheet[] | null) ?? []).map(sheet => {
    const trip = getTripParent(sheet.trip)
    return {
      id: sheet.id,
      title: sheet.title?.trim() || 'Untitled trip sheet',
      startDate: sheet.start_date,
      startTime: sheet.start_time,
      endDate: sheet.end_date,
      endTime: sheet.end_time,
      tripId: sheet.trip_id,
      tripStartDate: trip?.start_date ?? null,
      tripEndDate: trip?.end_date ?? null,
      tripTitle: trip?.title?.trim() || 'Untitled trip',
      customer: trip ? formatTripCustomerSummary(trip) : '-',
      destination: getDestinationName(trip?.destination_ref, '-') ?? '-',
    }
  })
  return { resource, entries, error: null }
}
