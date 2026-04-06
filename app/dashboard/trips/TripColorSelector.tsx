'use client'

import {
  formatTripColorLabel,
  getTripColorStyle,
  TRIP_COLOR_VALUES,
} from '@/lib/trip-colors'

type TripColorSelectorProps = {
  id: string
  name: string
  value: string
  onChange: (value: string) => void
  allowAuto?: boolean
  autoLabel?: string
}

function Swatch({
  background,
  border,
}: {
  background: string
  border: string
}) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border"
      style={{
        backgroundColor: background,
        borderColor: border,
      }}
    />
  )
}

export default function TripColorSelector({
  id,
  name,
  value,
  onChange,
  allowAuto = false,
  autoLabel = 'Auto-assign next color',
}: TripColorSelectorProps) {
  return (
    <div className="space-y-2">
      <input type="hidden" id={id} name={name} value={value} />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {allowAuto ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
              value === ''
                ? 'border-zinc-900 bg-zinc-50 text-zinc-900'
                : 'border-zinc-200 bg-white text-gray-700 hover:border-zinc-300 hover:bg-zinc-50'
            }`}
            aria-pressed={value === ''}
          >
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-dashed border-zinc-400 bg-white"
            />
            <span className="font-medium">{autoLabel}</span>
          </button>
        ) : null}

        {TRIP_COLOR_VALUES.map((tripColor) => {
          const colorStyle = getTripColorStyle(tripColor)
          const isSelected = value === tripColor

          return (
            <button
              key={tripColor}
              type="button"
              onClick={() => onChange(tripColor)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                isSelected
                  ? 'border-zinc-900 bg-zinc-50 text-zinc-900'
                  : 'border-zinc-200 bg-white text-gray-700 hover:border-zinc-300 hover:bg-zinc-50'
              }`}
              aria-pressed={isSelected}
            >
              <Swatch
                background={colorStyle.background}
                border={colorStyle.border}
              />
              <span className="font-medium">{formatTripColorLabel(tripColor)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
