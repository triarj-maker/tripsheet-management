'use client'

import ActionSubmitButton from '@/app/components/ActionSubmitButton'

import { archiveTripFromList } from './actions'

type ArchiveTripButtonProps = {
  tripId: string
  returnPath: string
  idleLabel?: string
  pendingLabel?: string
  confirmMessage?: string
}

export default function ArchiveTripButton({
  tripId,
  returnPath,
  idleLabel = 'Archive',
  pendingLabel = 'Archiving…',
  confirmMessage = 'Archive this trip and all of its child trip sheets?',
}: ArchiveTripButtonProps) {
  return (
    <form
      action={archiveTripFromList}
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault()
        }
      }}
    >
      <input type="hidden" name="id" value={tripId} />
      <input type="hidden" name="return_path" value={returnPath} />
      <ActionSubmitButton
        idleLabel={idleLabel}
        pendingLabel={pendingLabel}
        className="ui-button-secondary ui-button-compact whitespace-nowrap"
      />
    </form>
  )
}
