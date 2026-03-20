'use client'

import ActionSubmitButton from '@/app/components/ActionSubmitButton'
import { archiveTripSheet } from '@/app/dashboard/trip-sheets/actions'

type ArchiveTripSheetButtonProps = {
  tripSheetId: string
}

export default function ArchiveTripSheetButton({
  tripSheetId,
}: ArchiveTripSheetButtonProps) {
  return (
    <form
      action={archiveTripSheet}
      onSubmit={(event) => {
        if (!window.confirm('Archive this trip sheet?')) {
          event.preventDefault()
        }
      }}
    >
      <input type="hidden" name="id" value={tripSheetId} />
      <ActionSubmitButton
        idleLabel="Archive"
        pendingLabel="Archiving…"
        className="ui-button-secondary ui-button-compact"
      />
    </form>
  )
}
