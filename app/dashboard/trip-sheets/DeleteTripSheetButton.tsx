'use client'

import ActionSubmitButton from '@/app/components/ActionSubmitButton'

import { deleteTripSheet } from './actions'

type DeleteTripSheetButtonProps = {
  tripSheetId: string
  tripId?: string
  className?: string
}

export default function DeleteTripSheetButton({
  tripSheetId,
  tripId,
  className = 'ui-button-danger ui-button-compact whitespace-nowrap',
}: DeleteTripSheetButtonProps) {
  return (
    <form
      className="shrink-0"
      action={deleteTripSheet}
      onSubmit={(event) => {
        if (!window.confirm('Delete this trip sheet permanently? This cannot be undone.')) {
          event.preventDefault()
        }
      }}
    >
      <input type="hidden" name="id" value={tripSheetId} />
      {tripId ? <input type="hidden" name="trip_id" value={tripId} /> : null}
      <ActionSubmitButton
        idleLabel="Delete"
        pendingLabel="Deleting…"
        className={className}
      />
    </form>
  )
}
