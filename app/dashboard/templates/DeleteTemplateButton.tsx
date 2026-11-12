'use client'

import ActionSubmitButton from '@/app/components/ActionSubmitButton'
import { deleteTemplate } from '@/app/dashboard/templates/actions'

type DeleteTemplateButtonProps = {
  returnTo?: string
  className?: string
  templateId: string
}

export default function DeleteTemplateButton({
  templateId,
  returnTo,
  className = 'ui-button-danger',
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
      {returnTo ? <input type="hidden" name="return_to" value={returnTo} /> : null}
      <ActionSubmitButton
        idleLabel="Delete"
        pendingLabel="Deleting…"
        className={className}
      />
    </form>
  )
}
