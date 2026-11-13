import type { CSSProperties, ReactNode } from 'react'

export default function TripHeader({ title, state, badgeClass, colorStyle, customer, destination, dates, adults, childrenCount, actions, secondaryDetails }: {
  title: string
  state: string
  badgeClass: string
  colorStyle: CSSProperties
  customer: string
  destination: string
  dates: string
  adults: number
  childrenCount: number
  actions: ReactNode
  secondaryDetails: ReactNode
}) {
  return (
    <header className="app-section-card mb-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="app-page-title flex flex-wrap items-center gap-2">
            <span aria-hidden="true" className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border" style={colorStyle} />
            <span className="break-words">{title}</span><span className={badgeClass}>{state}</span>
          </h1>
          <p className="mt-1 text-sm font-medium text-gray-800">{customer} · {destination}</p>
          <p className="mt-1 text-sm text-gray-600">{dates} · {adults} adults · {childrenCount} children</p>
        </div>
        <div className="flex flex-wrap items-start gap-2">{actions}</div>
      </div>
      <details className="border-t border-zinc-200 pt-2">
        <summary className="cursor-pointer rounded text-sm font-medium text-gray-700 focus-visible:outline-2 focus-visible:outline-emerald-700">Trip details and notification history</summary>
        <div className="mt-3 space-y-3">{secondaryDetails}</div>
      </details>
    </header>
  )
}
