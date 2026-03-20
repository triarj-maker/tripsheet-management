'use client'

import { useState } from 'react'

import ActionSubmitButton from '@/app/components/ActionSubmitButton'
import { createTripSheet } from '@/app/dashboard/trip-sheets/actions'
import {
  guestOrCompanyRequiredMessage,
  hasGuestOrCompany,
} from '@/app/dashboard/trip-sheets/validation'

type TripTemplate = {
  id: string
  title: string | null
  body: string | null
}

type ResourceProfile = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
}

type TripSheetFormInitialValues = {
  title: string
  destination: string
  start_date: string
  end_date: string
  guest_name: string
  company: string
  phone_number: string
  template_id: string
  body: string
}

type TripSheetFormProps = {
  tripTemplates: TripTemplate[]
  availableResources: ResourceProfile[]
  errorMessage?: string
  initialValues?: TripSheetFormInitialValues
}

type TripSheetDraft = {
  title: string
  destination: string
  start_date: string
  end_date: string
  guest_name: string
  company: string
  phone_number: string
}

function formatDateForGeneratedBody(dateString: string) {
  if (!dateString) {
    return ''
  }

  const [year, month, day] = dateString.split('-').map(Number)

  if (!year || !month || !day) {
    return dateString
  }

  const date = new Date(Date.UTC(year, month - 1, day))

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function buildGeneratedBody(templateBody: string, draft: TripSheetDraft) {
  const formattedStartDate = formatDateForGeneratedBody(draft.start_date)
  const formattedEndDate = formatDateForGeneratedBody(draft.end_date)
  const formattedDateRange = [formattedStartDate, formattedEndDate]
    .filter(Boolean)
    .join(' to ')

  const headerBlock = [
    `TRIP: ${draft.title}`,
    `DATES: ${formattedDateRange}`,
    `CUSTOMER: ${draft.guest_name}`,
    `CONTACT: ${draft.phone_number}`,
    `COMPANY: ${draft.company}`,
    'NO OF GUESTS:',
    'OTHER DETAILS:',
    '',
    '--------------------------------',
  ].join('\n')

  return [headerBlock, templateBody.trim()].filter(Boolean).join('\n\n')
}

export default function TripSheetForm({
  tripTemplates,
  availableResources,
  errorMessage,
  initialValues,
}: TripSheetFormProps) {
  const [draft, setDraft] = useState<TripSheetDraft>({
    title: initialValues?.title ?? '',
    destination: initialValues?.destination ?? '',
    start_date: initialValues?.start_date ?? '',
    end_date: initialValues?.end_date ?? '',
    guest_name: initialValues?.guest_name ?? '',
    company: initialValues?.company ?? '',
    phone_number: initialValues?.phone_number ?? '',
  })
  const [templateId, setTemplateId] = useState(initialValues?.template_id ?? '')
  const [body, setBody] = useState(initialValues?.body ?? '')
  const [hasLoadedTemplateBody, setHasLoadedTemplateBody] = useState(
    Boolean(initialValues?.body.trim())
  )
  const [fieldError, setFieldError] = useState(
    errorMessage === guestOrCompanyRequiredMessage ? errorMessage : ''
  )
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([])
  const [nextResourceId, setNextResourceId] = useState('')

  function updateDraftField(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const name = event.target.name as keyof TripSheetDraft
    const { value } = event.target

    setDraft((currentDraft) => {
      const nextDraft = {
        ...currentDraft,
        [name]: value,
      }

      if (
        fieldError &&
        (name === 'guest_name' || name === 'company') &&
        hasGuestOrCompany(nextDraft.guest_name, nextDraft.company)
      ) {
        setFieldError('')
      }

      return nextDraft
    })
  }

  function handleTemplateChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextTemplateId = event.target.value

    setTemplateId(nextTemplateId)

    if (!hasLoadedTemplateBody && nextTemplateId) {
      const selectedTemplate = tripTemplates.find(
        (template) => template.id === nextTemplateId
      )

      setBody(buildGeneratedBody(selectedTemplate?.body ?? '', draft))
      setHasLoadedTemplateBody(true)
    }
  }

  function handleAddResource() {
    if (!nextResourceId || selectedResourceIds.includes(nextResourceId)) {
      return
    }

    setSelectedResourceIds((currentIds) => [...currentIds, nextResourceId])
    setNextResourceId('')
  }

  function handleRemoveResource(resourceId: string) {
    setSelectedResourceIds((currentIds) =>
      currentIds.filter((currentId) => currentId !== resourceId)
    )
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!hasGuestOrCompany(draft.guest_name, draft.company)) {
      event.preventDefault()
      setFieldError(guestOrCompanyRequiredMessage)
    }
  }

  const selectedResources = selectedResourceIds
    .map((resourceId) =>
      availableResources.find((resource) => resource.id === resourceId) ?? null
    )
    .filter((resource): resource is ResourceProfile => resource !== null)
  const unselectedResources = availableResources.filter(
    (resource) => !selectedResourceIds.includes(resource.id)
  )

  return (
    <form
      action={createTripSheet}
      onSubmit={handleSubmit}
      className="space-y-5"
    >
      <section className="app-section-card space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Trip Details</h2>
          <p className="mt-1 text-sm text-gray-600">
            Enter the core trip information before generating or editing the trip sheet body.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="title" className="ui-label">Title</label>
            <input
              id="title"
              name="title"
              type="text"
              value={draft.title}
              onChange={updateDraftField}
              required
              className="ui-input ui-input-compact"
            />
          </div>

          <div>
            <label htmlFor="destination" className="ui-label">Destination</label>
            <input
              id="destination"
              name="destination"
              type="text"
              value={draft.destination}
              onChange={updateDraftField}
              required
              className="ui-input ui-input-compact"
            />
          </div>

          <div>
            <label htmlFor="start_date" className="ui-label">Start Date</label>
            <input
              id="start_date"
              name="start_date"
              type="date"
              value={draft.start_date}
              onChange={updateDraftField}
              required
              className="ui-input ui-input-compact"
            />
          </div>

          <div>
            <label htmlFor="end_date" className="ui-label">End Date</label>
            <input
              id="end_date"
              name="end_date"
              type="date"
              value={draft.end_date}
              onChange={updateDraftField}
              required
              className="ui-input ui-input-compact"
            />
          </div>

          <div>
            <label htmlFor="guest_name" className="ui-label">Guest / School Name</label>
            <input
              id="guest_name"
              name="guest_name"
              type="text"
              value={draft.guest_name}
              onChange={updateDraftField}
              className="ui-input ui-input-compact"
            />
          </div>

          <div>
            <label htmlFor="company" className="ui-label">Company</label>
            <input
              id="company"
              name="company"
              type="text"
              value={draft.company}
              onChange={updateDraftField}
              className="ui-input ui-input-compact"
            />
            {fieldError ? (
              <p className="mt-2 text-sm text-red-700">{fieldError}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="phone_number" className="ui-label">Phone Number</label>
            <input
              id="phone_number"
              name="phone_number"
              type="tel"
              value={draft.phone_number}
              onChange={updateDraftField}
              className="ui-input ui-input-compact"
            />
          </div>

          <div>
            <label htmlFor="template_id" className="ui-label">Template</label>
            <select
              id="template_id"
              name="template_id"
              value={templateId}
              onChange={handleTemplateChange}
              required
              className="ui-select ui-select-compact"
            >
              <option value="">Select a template</option>
              {tripTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.title ?? template.id}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="app-section-card space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Trip Sheet Body</h2>
          <p className="mt-1 text-sm text-gray-600">
            This content is prefilled once from the selected template and can be edited before save.
          </p>
        </div>

        <div>
          <label htmlFor="body" className="ui-label">Body</label>
          <textarea
            id="body"
            name="body"
            rows={14}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            required
            className="ui-textarea"
          />
        </div>
      </section>

      <section className="app-section-card space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Assigned Resources</h2>
          <p className="mt-1 text-sm text-gray-600">
            Optional. Add resource assignments now, or leave this blank and assign later.
          </p>
        </div>

        <div className="space-y-2.5">
          {selectedResources.length === 0 ? (
            <p className="text-sm text-gray-700">No resources selected yet.</p>
          ) : (
            selectedResources.map((resource) => (
              <div
                key={resource.id}
                className="flex items-start justify-between gap-4 rounded-lg border border-zinc-200 px-3 py-2.5"
              >
                <div className="space-y-1 text-sm text-gray-900">
                  <p>{resource.full_name ?? '-'}</p>
                  <p>{resource.email ?? '-'}</p>
                  <p>{resource.phone ?? '-'}</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveResource(resource.id)}
                  className="ui-button ui-button-secondary ui-button-compact"
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>

        {selectedResourceIds.map((resourceId) => (
          <input
            key={resourceId}
            type="hidden"
            name="resource_user_ids"
            value={resourceId}
          />
        ))}

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <label htmlFor="resource_user_id" className="ui-label">Assign Resource</label>
            <select
              id="resource_user_id"
              value={nextResourceId}
              onChange={(event) => setNextResourceId(event.target.value)}
              className="ui-select ui-select-compact"
            >
              <option value="">Select a resource</option>
              {unselectedResources.map((resource) => (
                <option key={resource.id} value={resource.id}>
                  {resource.full_name ?? resource.email ?? resource.id}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleAddResource}
            className="ui-button ui-button-secondary ui-button-compact md:min-w-[9rem]"
          >
            Assign Resource
          </button>
        </div>
      </section>

      <ActionSubmitButton
        idleLabel="Save Trip Sheet"
        pendingLabel="Saving…"
        className="ui-button-primary"
      />
    </form>
  )
}
