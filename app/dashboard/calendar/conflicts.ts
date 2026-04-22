export type CalendarConflictTripSheet = {
  id: string
  start_date: string | null
  start_time: string | null
  end_date: string | null
  end_time: string | null
}

export type CalendarConflictAssignment = {
  trip_sheet_id: string
  resource_user_id: string
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
  left: CalendarConflictTripSheet,
  right: CalendarConflictTripSheet
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

export function getConflictingTripSheetIds(
  tripSheets: CalendarConflictTripSheet[],
  assignments: CalendarConflictAssignment[]
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
