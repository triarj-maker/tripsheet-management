'use client'

import { useState } from 'react'

import { createTripSheet } from '@/app/dashboard/trip-sheets/actions'

type TripTemplate = {
  id: string
  title: string | null
  body: string | null
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

function buildGeneratedBody(templateBody: string, draft: TripSheetDraft) {
  const headerBlock = [
    `TRIP: ${draft.title}`,
    `DATES: ${draft.start_date} to ${draft.end_date}`,
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

  function updateDraftField(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const name = event.target.name as keyof TripSheetDraft
    const { value } = event.target

    setDraft((currentDraft) => ({
      ...currentDraft,
      [name]: value,
    }))
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

  return (
    <form action={createTripSheet} className="space-y-4">
      <div>
        <label htmlFor="title" className="mb-1 block text-sm font-medium text-gray-700">
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          value={draft.title}
          onChange={updateDraftField}
          required
          className="w-full rounded border border-zinc-300 px-3 py-2 text-gray-900 placeholder:text-gray-400"
        />
      </div>

      <div>
        <label
          htmlFor="destination"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Destination
        </label>
        <input
          id="destination"
          name="destination"
          type="text"
          value={draft.destination}
          onChange={updateDraftField}
          required
          className="w-full rounded border border-zinc-300 px-3 py-2 text-gray-900 placeholder:text-gray-400"
        />
      </div>

      <div>
        <label htmlFor="start_date" className="mb-1 block text-sm font-medium text-gray-700">
          Start Date
        </label>
        <input
          id="start_date"
          name="start_date"
          type="date"
          value={draft.start_date}
          onChange={updateDraftField}
          required
          className="w-full rounded border border-zinc-300 px-3 py-2 text-gray-900 placeholder:text-gray-400"
        />
      </div>

      <div>
        <label htmlFor="end_date" className="mb-1 block text-sm font-medium text-gray-700">
          End Date
        </label>
        <input
          id="end_date"
          name="end_date"
          type="date"
          value={draft.end_date}
          onChange={updateDraftField}
          required
          className="w-full rounded border border-zinc-300 px-3 py-2 text-gray-900 placeholder:text-gray-400"
        />
      </div>

      <div>
        <label htmlFor="guest_name" className="mb-1 block text-sm font-medium text-gray-700">
          Guest Name
        </label>
        <input
          id="guest_name"
          name="guest_name"
          type="text"
          value={draft.guest_name}
          onChange={updateDraftField}
          className="w-full rounded border border-zinc-300 px-3 py-2 text-gray-900 placeholder:text-gray-400"
        />
      </div>

      <div>
        <label htmlFor="company" className="mb-1 block text-sm font-medium text-gray-700">
          Company
        </label>
        <input
          id="company"
          name="company"
          type="text"
          value={draft.company}
          onChange={updateDraftField}
          className="w-full rounded border border-zinc-300 px-3 py-2 text-gray-900 placeholder:text-gray-400"
        />
      </div>

      <div>
        <label
          htmlFor="phone_number"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Phone Number
        </label>
        <input
          id="phone_number"
          name="phone_number"
          type="tel"
          value={draft.phone_number}
          onChange={updateDraftField}
          className="w-full rounded border border-zinc-300 px-3 py-2 text-gray-900 placeholder:text-gray-400"
        />
      </div>

      <div>
        <label
          htmlFor="template_id"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Template
        </label>
        <select
          id="template_id"
          name="template_id"
          value={templateId}
          onChange={handleTemplateChange}
          required
          className="w-full rounded border border-zinc-300 px-3 py-2 text-gray-900"
        >
          <option value="">Select a template</option>
          {tripTemplates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.title ?? template.id}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="body" className="mb-1 block text-sm font-medium text-gray-700">
          Body
        </label>
        <textarea
          id="body"
          name="body"
          rows={12}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          required
          className="w-full rounded border border-zinc-300 px-3 py-2 text-gray-900 placeholder:text-gray-400"
        />
      </div>

      <button
        type="submit"
        className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-gray-900"
      >
        Save Trip Sheet
      </button>
    </form>
  )
}
