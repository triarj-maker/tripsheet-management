'use client'

import ActionSubmitButton from '@/app/components/ActionSubmitButton'

import { restoreTripFromList } from './actions'

type RestoreTripButtonProps = {
  tripId: string
  returnPath: string
}

export default function RestoreTripButton({
  tripId,
  returnPath,
}: RestoreTripButtonProps) {
  return (
    <form action={restoreTripFromList}>
      <input type="hidden" name="id" value={tripId} />
      <input type="hidden" name="return_path" value={returnPath} />
      <ActionSubmitButton
        idleLabel="Restore"
        pendingLabel="Restoring…"
        className="ui-button-primary ui-button-compact whitespace-nowrap"
      />
    </form>
  )
}
