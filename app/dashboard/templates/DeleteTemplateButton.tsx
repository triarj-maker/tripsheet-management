'use client'

import ActionSubmitButton from '@/app/components/ActionSubmitButton'
import { deleteTemplate } from '@/app/dashboard/templates/actions'

type DeleteTemplateButtonProps = {
  templateId: string
}

export default function DeleteTemplateButton({
  templateId,
}: DeleteTemplateButtonProps) {
  return (
    <form
      action={deleteTemplate}
      onSubmit={(event) => {
        if (!window.confirm('Delete this template?')) {
          event.preventDefault()
        }
      }}
    >
      <input type="hidden" name="id" value={templateId} />
      <ActionSubmitButton
        idleLabel="Delete"
        pendingLabel="Deleting…"
        className="rounded border border-zinc-300 px-3 py-1 text-sm text-gray-900"
      />
    </form>
  )
}
