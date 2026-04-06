export const TRIP_COLOR_VALUES = [
  'green',
  'blue',
  'amber',
  'purple',
  'teal',
  'rose',
] as const

export type TripColorValue = (typeof TRIP_COLOR_VALUES)[number]

type TripColorStyle = {
  background: string
  border: string
  text: string
  muted: string
  faint: string
  warning: string
}

export const TRIP_COLOR_STYLES: Record<TripColorValue, TripColorStyle> = {
  green: {
    background: '#eaf6ef',
    border: '#bcdcc8',
    text: '#163525',
    muted: '#29523c',
    faint: '#58725f',
    warning: '#b45309',
  },
  blue: {
    background: '#ebf4ff',
    border: '#bfd4f4',
    text: '#18324d',
    muted: '#33506d',
    faint: '#617991',
    warning: '#b45309',
  },
  amber: {
    background: '#fff4e5',
    border: '#f0d2a8',
    text: '#4f3312',
    muted: '#6d4a1e',
    faint: '#8b7048',
    warning: '#b45309',
  },
  purple: {
    background: '#f5efff',
    border: '#d7c3ef',
    text: '#3c285a',
    muted: '#583f78',
    faint: '#766093',
    warning: '#b45309',
  },
  teal: {
    background: '#e8f7f6',
    border: '#b8dfdb',
    text: '#163c3a',
    muted: '#2a5855',
    faint: '#5a7c78',
    warning: '#b45309',
  },
  rose: {
    background: '#fff0f3',
    border: '#efc2cc',
    text: '#4b2431',
    muted: '#694050',
    faint: '#876575',
    warning: '#b45309',
  },
}

export function normalizeTripColorInput(value: string | null | undefined) {
  const normalizedValue = String(value ?? '').trim().toLowerCase()

  return TRIP_COLOR_VALUES.find((tripColor) => tripColor === normalizedValue) ?? null
}

export function getTripColorStyle(value: string | null | undefined) {
  const tripColor = normalizeTripColorInput(value) ?? 'green'
  return TRIP_COLOR_STYLES[tripColor]
}

export function getNextTripColorByIndex(index: number) {
  const nextIndex = ((index % TRIP_COLOR_VALUES.length) + TRIP_COLOR_VALUES.length) % TRIP_COLOR_VALUES.length
  return TRIP_COLOR_VALUES[nextIndex] ?? 'green'
}

export function formatTripColorLabel(tripColor: TripColorValue) {
  return `${tripColor.charAt(0).toUpperCase()}${tripColor.slice(1)}`
}
