import ActionSubmitButton from '@/app/components/ActionSubmitButton'

import {
  TEMPLATE_BODY_MAX_LENGTH,
  TEMPLATE_TITLE_MAX_LENGTH,
} from './validation'

type TemplateFormProps = {
  action: (formData: FormData) => void | Promise<void>
  submitLabel: string
  initialTitle?: string
  initialBody?: string
  templateId?: string
}

export default function TemplateForm({
  action,
  submitLabel,
  initialTitle = '',
  initialBody = '',
  templateId,
}: TemplateFormProps) {
  return (
    <form action={action} className="app-section-card space-y-4">
      {templateId ? <input type="hidden" name="id" value={templateId} /> : null}

      <div>
        <label htmlFor="title" className="ui-label">
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          defaultValue={initialTitle}
          required
          maxLength={TEMPLATE_TITLE_MAX_LENGTH}
          className="ui-input"
        />
      </div>

      <div>
        <label htmlFor="body" className="ui-label">
          Body
        </label>
        <textarea
          id="body"
          name="body"
          rows={14}
          defaultValue={initialBody}
          required
          maxLength={TEMPLATE_BODY_MAX_LENGTH}
          className="ui-textarea"
        />
      </div>

      <ActionSubmitButton
        idleLabel={submitLabel}
        pendingLabel="Saving…"
        className="ui-button-primary"
      />
    </form>
  )
}
