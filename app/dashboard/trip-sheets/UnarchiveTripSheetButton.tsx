'use client'

import ActionSubmitButton from '@/app/components/ActionSubmitButton'
import { unarchiveTripSheet } from '@/app/dashboard/trip-sheets/actions'

type UnarchiveTripSheetButtonProps = {
  tripSheetId: string
}

export default function UnarchiveTripSheetButton({
  tripSheetId,
}: UnarchiveTripSheetButtonProps) {
  return (
    <form action={unarchiveTripSheet}>
      <input type="hidden" name="id" value={tripSheetId} />
      <ActionSubmitButton
        idleLabel="Unarchive"
        pendingLabel="Saving…"
        className="ui-button-secondary ui-button-compact"
      />
    </form>
  )
}
