'use client'

import ActionSubmitButton from '@/app/components/ActionSubmitButton'
import { deleteArchivedTripSheet } from '@/app/dashboard/trip-sheets/actions'

type DeleteArchivedTripSheetButtonProps = {
  tripSheetId: string
}

export default function DeleteArchivedTripSheetButton({
  tripSheetId,
}: DeleteArchivedTripSheetButtonProps) {
  return (
    <form
      action={deleteArchivedTripSheet}
      onSubmit={(event) => {
        if (
          !window.confirm(
            'Permanently delete this archived trip sheet? This cannot be undone.'
          )
        ) {
          event.preventDefault()
        }
      }}
    >
      <input type="hidden" name="id" value={tripSheetId} />
      <ActionSubmitButton
        idleLabel="Delete"
        pendingLabel="Deleting…"
        className="ui-button-danger ui-button-compact"
      />
    </form>
  )
}
