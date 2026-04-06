export type DestinationRelation =
  | {
      name: string | null
    }
  | Array<{
      name: string | null
    }>
  | null
  | undefined

export type TripParentRecord = {
  id: string
  title: string | null
  trip_type: string | null
  destination_id: string | null
  destination_ref: DestinationRelation
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
