'use client'

import ActionLinkButton from '@/app/components/ActionLinkButton'

type DuplicateTripSheetButtonProps = {
  tripSheetId: string
  tripId: string
  className?: string
}

export default function DuplicateTripSheetButton({
  tripSheetId,
  tripId,
  className = 'ui-button-secondary ui-button-compact',
}: DuplicateTripSheetButtonProps) {
  return (
    <ActionLinkButton
      href={`/dashboard/trip-sheets/new?tripId=${tripId}&duplicateFrom=${tripSheetId}`}
      idleLabel="Duplicate"
      pendingLabel="Opening…"
      className={className}
    />
  )
}
