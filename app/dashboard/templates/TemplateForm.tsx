import ActionSubmitButton from '@/app/components/ActionSubmitButton'

import {
  TEMPLATE_BODY_MAX_LENGTH,
  TEMPLATE_TITLE_MAX_LENGTH,
} from './validation'

type TemplateFormProps = {
  action: (formData: FormData) => void | Promise<void>
  submitLabel: string
  initialTitle?: string
  initialHeading?: string
  initialDefaultStartTime?: string
  initialDefaultEndTime?: string
  initialBody?: string
  templateId?: string
}

export default function TemplateForm({
  action,
  submitLabel,
  initialTitle = '',
  initialHeading = '',
  initialDefaultStartTime = '',
  initialDefaultEndTime = '',
  initialBody = '',
  templateId,
}: TemplateFormProps) {
  return (
    <form action={action} className="app-section-card space-y-4">
      {templateId ? <input type="hidden" name="id" value={templateId} /> : null}

      <div>
        <label htmlFor="title" className="ui-label">
          Template Title
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
        <label htmlFor="heading" className="ui-label">
          Default Trip Sheet Heading
        </label>
        <input
          id="heading"
          name="heading"
          type="text"
          defaultValue={initialHeading}
          className="ui-input"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="default_start_time" className="ui-label">
            Default Start Time
          </label>
          <input
            id="default_start_time"
            name="default_start_time"
            type="time"
            defaultValue={initialDefaultStartTime}
            className="ui-input"
          />
        </div>

        <div>
          <label htmlFor="default_end_time" className="ui-label">
            Default End Time
          </label>
          <input
            id="default_end_time"
            name="default_end_time"
            type="time"
            defaultValue={initialDefaultEndTime}
            className="ui-input"
          />
        </div>
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
