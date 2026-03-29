import Link from 'next/link'

export type AssignedTripCardTripSheet = {
  id: string
  title: string | null
  destination: string | null
  start_date: string | null
  end_date: string | null
  guest_name: string | null
}

type AssignedTripCardsProps = {
  tripSheets: AssignedTripCardTripSheet[]
  emptyMessage?: string
  className?: string
  from?: string
}

function formatValue(value: string | null) {
  return value ?? '-'
}

function buildViewHref(id: string, from?: string) {
  if (!from) {
    return `/trip-sheets/${id}`
  }

  const params = new URLSearchParams({ from })
  return `/trip-sheets/${id}?${params.toString()}`
}

export default function AssignedTripCards({
  tripSheets,
  emptyMessage = 'No trip sheets assigned yet.',
  className = 'space-y-4',
  from,
}: AssignedTripCardsProps) {
  return (
    <div className={className}>
      {tripSheets.length === 0 ? (
        <div className="app-section-card text-base text-gray-700">
          {emptyMessage}
        </div>
      ) : (
        tripSheets.map((tripSheet) => (
          <article
            key={tripSheet.id}
            className="app-section-card space-y-3"
          >
            <div className="space-y-2">
              <p className="text-lg font-bold leading-7 text-gray-900">
                {formatValue(tripSheet.title)}
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Destination</p>
                <p className="text-base text-gray-900">
                  {formatValue(tripSheet.destination)}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Start</p>
                <p className="text-base text-gray-900">
                  {formatValue(tripSheet.start_date)}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">End</p>
                <p className="text-base text-gray-900">
                  {formatValue(tripSheet.end_date)}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Customer</p>
                <p className="text-base text-gray-900">
                  {formatValue(tripSheet.guest_name)}
                </p>
              </div>
            </div>

            <Link
              href={buildViewHref(tripSheet.id, from)}
              className="ui-button ui-button-neutral block w-full text-base"
            >
              View
            </Link>
          </article>
        ))
      )}
    </div>
  )
}
