import AdminNav from '@/app/dashboard/AdminNav'
import { requireAdmin } from '@/app/dashboard/lib'
import { getTripColorStyle } from '@/lib/trip-colors'
import {
  getDestinationName,
  getTripParent,
  type DestinationRelation,
} from '@/lib/trip-sheets'

import TripSheetCalendar from './TripSheetCalendar'
import type { MonthCalendarEvent, WeekCalendarEvent } from './TripSheetCalendar'

type CalendarTripParent = {
  id: string
  title: string | null
  start_date: string | null
  end_date: string | null
  is_archived: boolean | null
  trip_color: string | null
  guest_name: string | null
  company: string | null
  phone_number: string | null
  trip_type: string | null
  destination_id: string | null
  destination_ref: DestinationRelation
}

type CalendarTripRelation = CalendarTripParent | CalendarTripParent[] | null | undefined

type TripSheetRow = {
  id: string
  trip_id: string | null
  trip: CalendarTripRelation
  title: string | null
  start_date: string | null
  start_time: string | null
  end_date: string | null
  end_time: string | null
  is_archived: boolean | null
}

type TripRow = {
  id: string
  title: string | null
  start_date: string | null
  end_date: string | null
  is_archived: boolean | null
  trip_color: string | null
  destination_ref: DestinationRelation
}

type TripSheetSummaryRow = {
  trip_id: string | null
  is_archived: boolean | null
}

type Assignment = {
  id: string
  trip_sheet_id: string
  resource_user_id: string
}

type ResourceProfile = {
  id: string
  full_name: string | null
  email: string | null
  role: string | null
}

type CalendarTripSheet = {
  id: string
  start_date: string | null
  start_time: string | null
  end_date: string | null
  end_time: string | null
}

function buildTripSummary(tripSheets: TripSheetSummaryRow[]) {
  const summaryByTripId = new Map<
    string,
    {
      total: number
      active: number
    }
  >()

  for (const tripSheet of tripSheets) {
    if (!tripSheet.trip_id) {
      continue
    }

    const currentSummary = summaryByTripId.get(tripSheet.trip_id) ?? {
      total: 0,
      active: 0,
    }

    currentSummary.total += 1

    if (!tripSheet.is_archived) {
      currentSummary.active += 1
    }

    summaryByTripId.set(tripSheet.trip_id, currentSummary)
  }

  return summaryByTripId
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

function parseTimeToMinutes(value: string | null) {
  if (!value) {
    return null
  }

  const [hoursText, minutesText] = value.split(':')
  const hours = Number(hoursText)
  const minutes = Number(minutesText)

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null
  }

  return hours * 60 + minutes
}

function doTripSheetsConflictOnSameDay(
  left: CalendarTripSheet,
  right: CalendarTripSheet
) {
  if (
    !left.start_date ||
    !left.end_date ||
    !right.start_date ||
    !right.end_date
  ) {
    return false
  }

  const leftStartMinutes = parseTimeToMinutes(left.start_time)
  const leftEndMinutes = parseTimeToMinutes(left.end_time)
  const rightStartMinutes = parseTimeToMinutes(right.start_time)
  const rightEndMinutes = parseTimeToMinutes(right.end_time)

  if (
    leftStartMinutes === null ||
    leftEndMinutes === null ||
    rightStartMinutes === null ||
    rightEndMinutes === null
  ) {
    return false
  }

  if (leftEndMinutes <= leftStartMinutes || rightEndMinutes <= rightStartMinutes) {
    return false
  }

  const sharesAtLeastOneDay =
    left.start_date <= right.end_date && right.start_date <= left.end_date

  if (!sharesAtLeastOneDay) {
    return false
  }

  return leftStartMinutes < rightEndMinutes && rightStartMinutes < leftEndMinutes
}

function getConflictingTripSheetIds(
  tripSheets: CalendarTripSheet[],
  assignments: Assignment[]
) {
  const conflictIds = new Set<string>()
  const tripSheetById = new Map(tripSheets.map((tripSheet) => [tripSheet.id, tripSheet]))
  const tripSheetIdsByResourceUserId = new Map<string, string[]>()

  for (const assignment of assignments) {
    const currentTripSheetIds =
      tripSheetIdsByResourceUserId.get(assignment.resource_user_id) ?? []
    currentTripSheetIds.push(assignment.trip_sheet_id)
    tripSheetIdsByResourceUserId.set(assignment.resource_user_id, currentTripSheetIds)
  }

  for (const tripSheetIds of tripSheetIdsByResourceUserId.values()) {
    for (let leftIndex = 0; leftIndex < tripSheetIds.length; leftIndex += 1) {
      const leftTripSheetId = tripSheetIds[leftIndex]
      const leftTripSheet = leftTripSheetId
        ? tripSheetById.get(leftTripSheetId) ?? null
        : null

      if (!leftTripSheet) {
        continue
      }

      for (
        let rightIndex = leftIndex + 1;
        rightIndex < tripSheetIds.length;
        rightIndex += 1
      ) {
        const rightTripSheetId = tripSheetIds[rightIndex]
        const rightTripSheet = rightTripSheetId
          ? tripSheetById.get(rightTripSheetId) ?? null
          : null

        if (!rightTripSheet) {
          continue
        }

        if (doTripSheetsConflictOnSameDay(leftTripSheet, rightTripSheet)) {
          conflictIds.add(leftTripSheet.id)
          conflictIds.add(rightTripSheet.id)
        }
      }
    }
  }

  return conflictIds
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)

  if (!year || !month || !day) {
    return null
  }

  return new Date(Date.UTC(year, month - 1, day))
}

function addDaysToIsoDate(value: string, days: number) {
  const parsedDate = parseIsoDate(value)

  if (!parsedDate) {
    return ''
  }

  parsedDate.setUTCDate(parsedDate.getUTCDate() + days)

  const year = parsedDate.getUTCFullYear()
  const month = String(parsedDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(parsedDate.getUTCDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getInclusiveDateRange(startDate: string | null, endDate: string | null) {
  if (!startDate || !endDate || startDate > endDate) {
    return []
  }

  const dateRange: string[] = []
  let currentDate = startDate

  while (currentDate && currentDate <= endDate) {
    dateRange.push(currentDate)
    currentDate = addDaysToIsoDate(currentDate, 1)
  }

  return dateRange
}

function formatAssignableLabel(resource: Pick<ResourceProfile, 'id' | 'full_name' | 'email' | 'role'>) {
  const baseLabel = resource.full_name?.trim() || resource.email?.trim() || resource.id
  const roleLabel = resource.role === 'admin' ? 'Admin' : 'Resource'

  return `${baseLabel} (${roleLabel})`
}

type CalendarPageProps = {
  searchParams: Promise<{
    view?: string
    date?: string
    tripSheetId?: string
    error?: string
  }>
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const query = await searchParams
  const { supabase } = await requireAdmin()

  const { data: tripData, error: tripsError } = await supabase
    .from('trips')
    .select('id, title, start_date, end_date, is_archived, trip_color, destination_ref:destinations(name)')
    .eq('is_archived', false)
    .not('start_date', 'is', null)
    .not('end_date', 'is', null)
    .order('start_date', { ascending: true })

  const trips = ((tripData as TripRow[] | null) ?? []).map((trip) => ({
    ...trip,
    destination:
      getDestinationName(trip.destination_ref, 'Unknown destination') ??
      'Unknown destination',
  }))
  const tripIds = trips.map((trip) => trip.id)
  const { data: tripSheetSummaryData, error: tripSheetSummaryError } =
    tripIds.length > 0
      ? await supabase
          .from('trip_sheets')
          .select('trip_id, is_archived')
          .in('trip_id', tripIds)
      : { data: [], error: null }

  const tripSheetSummaryByTripId = buildTripSummary(
    (tripSheetSummaryData as TripSheetSummaryRow[] | null) ?? []
  )
  const visibleTrips = trips
    .map((trip) => {
      const summary = tripSheetSummaryByTripId.get(trip.id)
      const childSheetCount = summary?.total ?? 0
      const isArchived = childSheetCount > 0 && (summary?.active ?? 0) === 0

      return {
        ...trip,
        isArchived,
      }
    })
    .filter((trip) => !trip.isArchived)

  const { data: tripSheetData, error: tripSheetsError } = await supabase
    .from('trip_sheets')
    .select(
      'id, trip_id, title, trip:trips!inner(id, title, start_date, end_date, is_archived, trip_color, guest_name, company, phone_number, trip_type, destination_id, destination_ref:destinations(name)), start_date, start_time, end_date, end_time, is_archived'
    )
    .eq('is_archived', false)
    .eq('trip.is_archived', false)
    .not('start_date', 'is', null)
    .not('end_date', 'is', null)
    .order('start_date', { ascending: true })

  const tripSheets = ((tripSheetData as TripSheetRow[] | null) ?? []).map((tripSheet) => {
    const trip = getTripParent(tripSheet.trip)

    return {
      ...tripSheet,
      trip_sheet_title: tripSheet.title ?? 'Untitled trip sheet',
      parent_trip_title: trip?.title ?? 'Untitled trip',
      trip_color: trip?.trip_color ?? null,
      destination:
        getDestinationName(trip?.destination_ref, 'Unknown destination') ??
        'Unknown destination',
      guest_name: trip?.guest_name ?? trip?.company,
    }
  })
  const tripSheetIds = tripSheets.map((tripSheet) => tripSheet.id)
  const { data: assignmentData, error: assignmentError } =
    tripSheetIds.length > 0
      ? await supabase
          .from('trip_sheet_assignments')
          .select('id, trip_sheet_id, resource_user_id')
          .in('trip_sheet_id', tripSheetIds)
          .order('created_at', { ascending: true })
      : { data: [], error: null }

  const assignments = (assignmentData as Assignment[] | null) ?? []
  const resourceUserIds = Array.from(
    new Set(assignments.map((assignment) => assignment.resource_user_id))
  )
  const { data: resourceData, error: resourceError } =
    resourceUserIds.length > 0
      ? await supabase
          .from('profiles')
          .select('id, full_name, email, role')
          .in('id', resourceUserIds)
      : { data: [], error: null }

  const { data: activeResourceData, error: activeResourcesError } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .in('role', ['resource', 'admin'])
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  const resources = (resourceData as ResourceProfile[] | null) ?? []
  const activeResources = (activeResourceData as ResourceProfile[] | null) ?? []
  const resourcesById = new Map<string, ResourceProfile>()
  const resourceNamesById = new Map<string, string>()
  const assignedNamesByTripSheetId = new Map<string, string[]>()
  const assignedResourcesByTripSheetId = new Map<
    string,
    Array<{
      assignmentId: string
      resourceUserId: string
      label: string
    }>
  >()

  for (const resource of activeResources) {
    resourcesById.set(resource.id, resource)
  }

  for (const resource of resources) {
    resourcesById.set(resource.id, resource)
  }

  for (const resource of resourcesById.values()) {
    resourceNamesById.set(
      resource.id,
      resource.full_name?.trim() || resource.email?.trim() || 'Unnamed resource'
    )
  }

  for (const assignment of assignments) {
    const currentNames = assignedNamesByTripSheetId.get(assignment.trip_sheet_id) ?? []
    const resolvedResource = resourcesById.get(assignment.resource_user_id)
    const label =
      resolvedResource?.full_name?.trim() ||
      resolvedResource?.email?.trim() ||
      'Unnamed resource'
    const currentAssignedResources =
      assignedResourcesByTripSheetId.get(assignment.trip_sheet_id) ?? []

    currentNames.push(label)
    assignedNamesByTripSheetId.set(assignment.trip_sheet_id, currentNames)
    currentAssignedResources.push({
      assignmentId: assignment.id,
      resourceUserId: assignment.resource_user_id,
      label,
    })
    assignedResourcesByTripSheetId.set(
      assignment.trip_sheet_id,
      currentAssignedResources
    )
  }

  const conflictingTripSheetIds = getConflictingTripSheetIds(
    tripSheets.map((tripSheet) => ({
      id: tripSheet.id,
      start_date: tripSheet.start_date,
      start_time: tripSheet.start_time,
      end_date: tripSheet.end_date,
      end_time: tripSheet.end_time,
    })),
    assignments
  )
  const conflictingDayIdsByTripId = new Map<string, Set<string>>()

  for (const tripSheet of tripSheets) {
    if (!conflictingTripSheetIds.has(tripSheet.id) || !tripSheet.trip_id) {
      continue
    }

    const currentDayIds = conflictingDayIdsByTripId.get(tripSheet.trip_id) ?? new Set<string>()

    for (const dayId of getInclusiveDateRange(tripSheet.start_date, tripSheet.end_date)) {
      currentDayIds.add(dayId)
    }

    conflictingDayIdsByTripId.set(tripSheet.trip_id, currentDayIds)
  }

  function formatAssignedLabel(names: string[]) {
    if (names.length === 0) {
      return 'Unassigned'
    }

    if (names.length === 1) {
      return names[0] ?? 'Unassigned'
    }

    return `${names[0]} +${names.length - 1}`
  }

  const monthEvents: MonthCalendarEvent[] = visibleTrips.map((trip) => {
    const colorStyle = getTripColorStyle(trip.trip_color)
    const conflictDayIds = Array.from(conflictingDayIdsByTripId.get(trip.id) ?? [])

    return {
      id: trip.id,
      title: trip.title ?? 'Untitled trip',
      start: trip.start_date ?? '',
      end: addOneDay(trip.end_date),
      allDay: true,
      url: `/dashboard/trips/${trip.id}`,
      backgroundColor: colorStyle.background,
      borderColor: colorStyle.border,
      extendedProps: {
        isArchived: trip.isArchived,
        hasConflict: conflictDayIds.length > 0,
        conflictDayIds,
        textColor: colorStyle.text,
      },
    }
  })

  const weekEvents: WeekCalendarEvent[] = tripSheets
    .filter((tripSheet) => tripSheet.start_date && tripSheet.end_date)
    .map((tripSheet) => {
      const assignedNames = assignedNamesByTripSheetId.get(tripSheet.id) ?? []
      const assignedResources = assignedResourcesByTripSheetId.get(tripSheet.id) ?? []
      const isArchived = tripSheet.is_archived === true
      const colorStyle = getTripColorStyle(tripSheet.trip_color)

      return {
        id: tripSheet.id,
        title: tripSheet.parent_trip_title ?? 'Untitled trip',
        start: tripSheet.start_date ?? '',
        end: addOneDay(tripSheet.end_date),
        allDay: true,
        url: `/dashboard/trip-sheets/${tripSheet.id}/edit`,
        backgroundColor: colorStyle.background,
        borderColor: colorStyle.border,
        extendedProps: {
          destination: tripSheet.destination ?? 'No destination',
          guestName: tripSheet.guest_name ?? 'No guest name',
          assignedLabel: formatAssignedLabel(assignedNames),
          isUnassigned: assignedNames.length === 0,
          isArchived,
          tripSheetTitle: tripSheet.trip_sheet_title ?? 'Untitled trip sheet',
          parentTripTitle: tripSheet.parent_trip_title ?? 'Untitled trip',
          startDate: tripSheet.start_date,
          startTime: tripSheet.start_time,
          endDate: tripSheet.end_date,
          endTime: tripSheet.end_time,
          hasConflict: conflictingTripSheetIds.has(tripSheet.id),
          assignedResources,
          textColor: colorStyle.text,
          mutedColor: colorStyle.muted,
          faintColor: colorStyle.faint,
          warningColor: colorStyle.warning,
        },
      }
    })

  const calendarError =
    query.error ||
    tripsError?.message ||
    tripSheetSummaryError?.message ||
    tripSheetsError?.message ||
    assignmentError?.message ||
    resourceError?.message ||
    activeResourcesError?.message ||
    null

  return (
    <>
      <AdminNav current="calendar" />

      {calendarError ? (
        <p className="app-banner-error">
          {calendarError}
        </p>
      ) : null}

      <TripSheetCalendar
        monthEvents={monthEvents}
        weekEvents={weekEvents}
        availableResources={activeResources.map((resource) => ({
          id: resource.id,
          label: formatAssignableLabel(resource),
        }))}
        initialViewMode={query.view === 'week' ? 'week' : 'month'}
        initialDateValue={query.date ?? ''}
        initialSelectedWeekEventId={query.tripSheetId ?? ''}
        title="Calendar"
        subtitle="See all trips across their scheduled date ranges."
      />
    </>
  )
}
