'use client'

import ActionSubmitButton from '@/app/components/ActionSubmitButton'

import { archiveTripFromList } from './actions'

type ArchiveTripButtonProps = {
  tripId: string
  returnPath: string
}

export default function ArchiveTripButton({
  tripId,
  returnPath,
}: ArchiveTripButtonProps) {
  return (
    <form
      action={archiveTripFromList}
      onSubmit={(event) => {
        if (!window.confirm('Archive this trip and all of its child trip sheets?')) {
          event.preventDefault()
        }
      }}
    >
      <input type="hidden" name="id" value={tripId} />
      <input type="hidden" name="return_path" value={returnPath} />
      <ActionSubmitButton
        idleLabel="Archive"
        pendingLabel="Archiving…"
        className="ui-button-secondary ui-button-compact"
      />
    </form>
  )
}
