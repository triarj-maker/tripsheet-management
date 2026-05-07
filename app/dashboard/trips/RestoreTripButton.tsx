'use client'

import ActionSubmitButton from '@/app/components/ActionSubmitButton'

import { restoreTripFromList } from './actions'

type RestoreTripButtonProps = {
  tripId: string
  returnPath: string
  idleLabel?: string
  pendingLabel?: string
  confirmMessage?: string
}

export default function RestoreTripButton({
  tripId,
  returnPath,
  idleLabel = 'Restore',
  pendingLabel = 'Restoring…',
  confirmMessage,
}: RestoreTripButtonProps) {
  return (
    <form
      action={restoreTripFromList}
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault()
        }
      }}
    >
      <input type="hidden" name="id" value={tripId} />
      <input type="hidden" name="return_path" value={returnPath} />
      <ActionSubmitButton
        idleLabel={idleLabel}
        pendingLabel={pendingLabel}
        className="ui-button-primary ui-button-compact whitespace-nowrap"
      />
    </form>
  )
}
