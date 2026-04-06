'use client'

import ActionSubmitButton from '@/app/components/ActionSubmitButton'

import { deleteTripFromList } from './actions'

type DeleteTripButtonProps = {
  tripId: string
  returnPath: string
}

export default function DeleteTripButton({
  tripId,
  returnPath,
}: DeleteTripButtonProps) {
  return (
    <form
      className="shrink-0"
      action={deleteTripFromList}
      onSubmit={(event) => {
        if (!window.confirm('Delete this trip permanently? This cannot be undone.')) {
          event.preventDefault()
        }
      }}
    >
      <input type="hidden" name="id" value={tripId} />
      <input type="hidden" name="return_path" value={returnPath} />
      <ActionSubmitButton
        idleLabel="Delete"
        pendingLabel="Deleting…"
        className="ui-button-danger ui-button-compact whitespace-nowrap"
      />
    </form>
  )
}
