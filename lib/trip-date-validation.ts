export const tripDateRequiredMessage = 'Trip start date and end date are required.'
export const tripDateRangeMessage = 'Trip end date must be on or after trip start date.'
export const tripSheetDateRequiredMessage =
  'Trip sheet start date and end date are required.'
export const tripSheetDateRangeMessage =
  'Trip sheet end date must be on or after its start date.'
export const tripSheetWithinTripRangeMessage =
  'Trip sheet dates must fall within the parent trip date range.'

export function isDateRangeOrdered(startDate: string, endDate: string) {
  return Boolean(startDate && endDate && startDate <= endDate)
}

export function isTripSheetWithinTripRange({
  tripStartDate,
  tripEndDate,
  tripSheetStartDate,
  tripSheetEndDate,
}: {
  tripStartDate: string
  tripEndDate: string
  tripSheetStartDate: string
  tripSheetEndDate: string
}) {
  if (
    !tripStartDate ||
    !tripEndDate ||
    !tripSheetStartDate ||
    !tripSheetEndDate
  ) {
    return false
  }

  if (!isDateRangeOrdered(tripStartDate, tripEndDate)) {
    return false
  }

  if (!isDateRangeOrdered(tripSheetStartDate, tripSheetEndDate)) {
    return false
  }

  return (
    tripSheetStartDate >= tripStartDate && tripSheetEndDate <= tripEndDate
  )
}
