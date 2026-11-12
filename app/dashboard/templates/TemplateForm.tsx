import Link from 'next/link'

import ActionSubmitButton from '@/app/components/ActionSubmitButton'

import {
  TEMPLATE_BODY_MAX_LENGTH,
  TEMPLATE_TITLE_MAX_LENGTH,
} from './validation'

type TemplateFormProps = {
  action: (formData: FormData) => void | Promise<void>
  submitLabel: string
  destinations: Array<{ id: string; name: string | null }>
  initialDestinationId?: string
  duplicateFrom?: string
  initialTitle?: string
  initialHeading?: string
  initialDefaultStartTime?: string
  initialDefaultEndTime?: string
  initialBody?: string
  templateId?: string
  closeHref?: string
}

export default function TemplateForm({
  action,
  submitLabel,
  destinations,
  initialDestinationId = '',
  duplicateFrom,
  initialTitle = '',
  initialHeading = '',
  initialDefaultStartTime = '',
  initialDefaultEndTime = '',
  initialBody = '',
  templateId,
  closeHref,
}: TemplateFormProps) {
  return (
    <form id="template-details" action={action} className="app-section-card space-y-4">
      {duplicateFrom ? <input type="hidden" name="duplicate_from" value={duplicateFrom} /> : null}
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
        <label htmlFor="destination_id" className="ui-label">Destination</label>
        <select id="destination_id" name="destination_id" defaultValue={initialDestinationId} className="ui-select">
          <option value="">No destination</option>
          {destinations.map(destination => (
            <option key={destination.id} value={destination.id}>{destination.name ?? 'Unnamed destination'}</option>
          ))}
        </select>
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
        <p className="mt-2 text-xs text-gray-500">
          Supports Markdown: **bold**, - bullets, 1. numbered lists, ## headings.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <ActionSubmitButton
          idleLabel={submitLabel}
          pendingLabel="Saving…"
          className="ui-button-primary"
        />

        {closeHref ? (
          <Link href={closeHref} className="ui-button ui-button-secondary">
            Back to Templates
          </Link>
        ) : null}
      </div>
    </form>
  )
}
