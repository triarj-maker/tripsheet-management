import AdminNav from '@/app/dashboard/AdminNav'
import { requireAdmin } from '@/app/dashboard/lib'

import TripSheetCalendar from './TripSheetCalendar'
import type { CalendarEvent } from './TripSheetCalendar'

type TripSheet = {
  id: string
  title: string | null
  destination: string | null
  guest_name: string | null
  start_date: string | null
  end_date: string | null
}

type Assignment = {
  trip_sheet_id: string
  resource_user_id: string
}

type ResourceProfile = {
  id: string
  full_name: string | null
}

function addOneDay(dateString: string | null) {
  if (!dateString) {
    return undefined
  }

  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

export default async function CalendarPage() {
  const { supabase } = await requireAdmin()

  const { data, error } = await supabase
    .from('trip_sheets')
    .select('id, title, destination, guest_name, start_date, end_date')
    .eq('is_archived', false)
    .not('start_date', 'is', null)
    .not('end_date', 'is', null)
    .order('start_date', { ascending: true })

  const tripSheets = (data as TripSheet[] | null) ?? []
  const tripSheetIds = tripSheets.map((tripSheet) => tripSheet.id)
  const { data: assignmentData, error: assignmentError } =
    tripSheetIds.length > 0
      ? await supabase
          .from('trip_sheet_assignments')
          .select('trip_sheet_id, resource_user_id')
          .in('trip_sheet_id', tripSheetIds)
          .order('assigned_at', { ascending: true })
      : { data: [], error: null }

  const assignments = (assignmentData as Assignment[] | null) ?? []
  const resourceUserIds = Array.from(
    new Set(assignments.map((assignment) => assignment.resource_user_id))
  )
  const { data: resourceData, error: resourceError } =
    resourceUserIds.length > 0
      ? await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', resourceUserIds)
      : { data: [], error: null }

  const resources = (resourceData as ResourceProfile[] | null) ?? []
  const resourceNamesById = new Map(
    resources.map((resource) => [resource.id, resource.full_name ?? 'Unnamed resource'])
  )
  const assignedNamesByTripSheetId = new Map<string, string[]>()

  for (const assignment of assignments) {
    const currentNames = assignedNamesByTripSheetId.get(assignment.trip_sheet_id) ?? []
    currentNames.push(
      resourceNamesById.get(assignment.resource_user_id) ?? 'Unnamed resource'
    )
    assignedNamesByTripSheetId.set(assignment.trip_sheet_id, currentNames)
  }

  function formatAssignedLabel(names: string[]) {
    if (names.length === 0) {
      return 'Unassigned'
    }

    if (names.length <= 2) {
      return names.join(', ')
    }

    return `${names[0]}, ${names[1]} +${names.length - 2}`
  }

  const events: CalendarEvent[] = tripSheets
    .filter((tripSheet) => tripSheet.start_date && tripSheet.end_date)
    .map((tripSheet) => {
      const assignedNames = assignedNamesByTripSheetId.get(tripSheet.id) ?? []

      return {
        id: tripSheet.id,
        title: tripSheet.title ?? 'Untitled trip',
        start: tripSheet.start_date ?? '',
        end: addOneDay(tripSheet.end_date),
        allDay: true,
        url: `/trip-sheets/${tripSheet.id}`,
        backgroundColor: '#18181b',
        borderColor: '#18181b',
        extendedProps: {
          destination: tripSheet.destination ?? 'No destination',
          guestName: tripSheet.guest_name ?? 'No guest name',
          assignedLabel: formatAssignedLabel(assignedNames),
          isUnassigned: assignedNames.length === 0,
        },
      }
    })

  const calendarError =
    error?.message || assignmentError?.message || resourceError?.message || null

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-12">
      <div className="mx-auto max-w-6xl rounded-2xl bg-white p-8 shadow-sm">
        <AdminNav current="calendar" />

        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Calendar</h1>
        </div>

        {calendarError ? (
          <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {calendarError}
          </p>
        ) : null}

        <TripSheetCalendar events={events} />
      </div>
    </main>
  )
}
