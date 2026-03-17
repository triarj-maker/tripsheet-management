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
        className="rounded border border-zinc-300 bg-white px-3 py-1 text-sm text-gray-900"
      />
    </form>
  )
}
