export type DestinationRelation =
  | {
      name: string | null
    }
  | Array<{
      name: string | null
    }>
  | null
  | undefined

export type LookupNameRelation = DestinationRelation

export type TripParentRecord = {
  id: string
  title: string | null
  trip_type: string | null
  destination_id: string | null
  destination_ref: DestinationRelation
  company_id?: string | null
  school_id?: string | null
  company_ref?: LookupNameRelation
  school_ref?: LookupNameRelation
}

export type TripParentRelation = TripParentRecord | TripParentRecord[] | null | undefined

export type TripType = 'educational' | 'private'

export function getDestinationName(
  destinationRelation: DestinationRelation,
  fallback: string | null = null
) {
  if (Array.isArray(destinationRelation)) {
    return destinationRelation[0]?.name ?? fallback
  }

  return destinationRelation?.name ?? fallback
}

export function getLookupName(
  lookupRelation: LookupNameRelation,
  fallback: string | null = null
) {
  return getDestinationName(lookupRelation, fallback)
}

export function getTripSchoolCustomerName(
  trip: {
    school_id?: string | null
    school_ref?: LookupNameRelation
    guest_name?: string | null
  },
  fallback: string | null = null
) {
  if (trip.school_id) {
    const schoolName = getLookupName(trip.school_ref)

    if (schoolName?.trim()) {
      return schoolName.trim()
    }
  }

  return trip.guest_name?.trim() || fallback
}

export function getTripCompanyPartnerName(
  trip: {
    company_id?: string | null
    company_ref?: LookupNameRelation
    company?: string | null
  },
  fallback: string | null = null
) {
  if (trip.company_id) {
    const companyName = getLookupName(trip.company_ref)

    if (companyName?.trim()) {
      return companyName.trim()
    }
  }

  return trip.company?.trim() || fallback
}

export function formatTripCustomerSummary(
  trip: {
    school_id?: string | null
    school_ref?: LookupNameRelation
    guest_name?: string | null
    company_id?: string | null
    company_ref?: LookupNameRelation
    company?: string | null
  },
  fallback = '-'
) {
  const schoolCustomerName = getTripSchoolCustomerName(trip)
  const companyPartnerName = getTripCompanyPartnerName(trip)

  if (schoolCustomerName && companyPartnerName) {
    return `${schoolCustomerName} · ${companyPartnerName}`
  }

  return schoolCustomerName || companyPartnerName || fallback
}

export function normalizeTripTypeInput(value: string): TripType | '' {
  const normalizedValue = value.trim().toLowerCase()

  if (normalizedValue === 'educational') {
    return 'educational'
  }

  if (normalizedValue === 'private') {
    return 'private'
  }

  return ''
}

export function toTripTypeFormValue(value: string | null | undefined) {
  return normalizeTripTypeInput(value ?? '')
}

export function getTripParent<T>(relation: T | T[] | null | undefined): T | null {
  if (Array.isArray(relation)) {
    return relation[0] ?? null
  }

  return relation ?? null
}

export function formatTripTypeLabel(value: string | null | undefined) {
  const normalized = normalizeTripTypeInput(value ?? '')

  if (normalized === 'educational') {
    return 'Educational'
  }

  if (normalized === 'private') {
    return 'Private'
  }

  return '-'
}

export function buildDuplicatedTripSheetTitle(value: string | null | undefined) {
  const trimmedValue = (value ?? '').trim()

  if (!trimmedValue) {
    return 'Copy of Untitled trip sheet'
  }

  if (trimmedValue.toLowerCase().startsWith('copy of ')) {
    return trimmedValue
  }

  return `Copy of ${trimmedValue}`
}

export function buildDuplicatedTripTitle(value: string | null | undefined) {
  const trimmedValue = (value ?? '').trim()

  if (!trimmedValue) {
    return 'Copy of Untitled trip'
  }

  if (trimmedValue.toLowerCase().startsWith('copy of ')) {
    return trimmedValue
  }

  return `Copy of ${trimmedValue}`
}
