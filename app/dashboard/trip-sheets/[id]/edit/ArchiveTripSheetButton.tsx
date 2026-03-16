'use client'

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
      <button
        type="submit"
        className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-gray-900"
      >
        Archive
      </button>
    </form>
  )
}
