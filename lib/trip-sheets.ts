export type DestinationRelation =
  | {
      name: string | null
    }
  | Array<{
      name: string | null
    }>
  | null
  | undefined

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
