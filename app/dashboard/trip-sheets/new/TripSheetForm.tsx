'use client'

import { useState } from 'react'

import ActionSubmitButton from '@/app/components/ActionSubmitButton'
import { createTripSheet } from '@/app/dashboard/trip-sheets/actions'
import { formatTripTypeLabel } from '@/lib/trip-sheets'
import {
  isDateRangeOrdered,
  isTripSheetWithinTripRange,
  tripSheetDateRangeMessage,
  tripSheetWithinTripRangeMessage,
} from '@/lib/trip-date-validation'

type TripTemplate = {
  id: string
  title: string | null
  heading: string | null
  default_start_time: string | null
  default_end_time: string | null
  body: string | null
}

type ResourceProfile = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  role: string | null
}

type TripSheetFormInitialValues = {
  title: string
  start_date: string
  start_time: string
  end_date: string
  end_time: string
  template_id: string
  body: string
  transportation_info: string
}

type TripSheetFormProps = {
  trip: {
    id: string
    title: string | null
    trip_type: string | null
    start_date: string | null
    end_date: string | null
    destination: string
    guest_name: string | null
    company: string | null
    phone_number: string | null
  }
  tripTemplates: TripTemplate[]
  availableResources: ResourceProfile[]
  initialValues?: TripSheetFormInitialValues
}

type TripSheetDraft = {
  title: string
  start_date: string
  start_time: string
  end_date: string
  end_time: string
}

function formatTemplateTime(value: string | null) {
  return value?.slice(0, 5) ?? ''
}

function shouldApplyTemplateValue({
  currentValue,
  previousTemplateValue,
  isEdited,
}: {
  currentValue: string
  previousTemplateValue: string
  isEdited: boolean
}) {
  return (
    !isEdited ||
    !currentValue ||
    (!!previousTemplateValue && currentValue === previousTemplateValue)
  )
}

function formatAssignableLabel(resource: ResourceProfile) {
  const baseLabel = resource.full_name ?? resource.email ?? resource.id
  const roleLabel = resource.role === 'admin' ? 'Admin' : 'Resource'

  return `${baseLabel} (${roleLabel})`
}

export default function TripSheetForm({
  trip,
  tripTemplates,
  availableResources,
  initialValues,
}: TripSheetFormProps) {
  const defaultStartDate = initialValues?.start_date ?? trip.start_date ?? ''
  const initialTitle = initialValues?.title ?? ''
  const initialStartTime = initialValues?.start_time ?? '09:00'
  const initialEndTime = initialValues?.end_time ?? '17:30'
  const initialBody = initialValues?.body ?? ''

  const [draft, setDraft] = useState<TripSheetDraft>({
    title: initialTitle,
    start_date: defaultStartDate,
    start_time: initialStartTime,
    end_date: initialValues?.end_date ?? '',
    end_time: initialEndTime,
  })
  const [templateId, setTemplateId] = useState(initialValues?.template_id ?? '')
  const [body, setBody] = useState(initialBody)
  const [transportationInfo, setTransportationInfo] = useState(
    initialValues?.transportation_info ?? ''
  )
  const [editedTemplateFields, setEditedTemplateFields] = useState({
    title: false,
    start_time: false,
    end_time: false,
    body: false,
  })
  const [fieldError, setFieldError] = useState('')
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([])
  const [nextResourceId, setNextResourceId] = useState('')

  const effectiveEndDate = draft.end_date || draft.start_date

  function updateDraftField(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const name = event.target.name as keyof TripSheetDraft
    const { value } = event.target

    if (name === 'start_date' || name === 'end_date') {
      setFieldError('')
    }

    if (name === 'title' || name === 'start_time' || name === 'end_time') {
      setEditedTemplateFields((currentFields) => ({
        ...currentFields,
        [name]: true,
      }))
    }

    setDraft((currentDraft) => ({
      ...currentDraft,
      [name]: value,
    }))
  }

  function handleTemplateChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextTemplateId = event.target.value
    const currentTemplate = tripTemplates.find((template) => template.id === templateId)
    const nextTemplate = tripTemplates.find((template) => template.id === nextTemplateId)
    const currentTemplateHeading = currentTemplate?.heading?.trim() ?? ''
    const currentTemplateStartTime = formatTemplateTime(currentTemplate?.default_start_time ?? null)
    const currentTemplateEndTime = formatTemplateTime(currentTemplate?.default_end_time ?? null)
    const currentTemplateBody = currentTemplate?.body ?? ''

    setTemplateId(nextTemplateId)

    if (!nextTemplateId) {
      setDraft((currentDraft) => ({
        ...currentDraft,
        title: currentDraft.title === currentTemplateHeading ? '' : currentDraft.title,
        start_time:
          currentDraft.start_time === currentTemplateStartTime
            ? initialStartTime
            : currentDraft.start_time,
        end_time:
          currentDraft.end_time === currentTemplateEndTime
            ? initialEndTime
            : currentDraft.end_time,
      }))

      if (body === currentTemplateBody) {
        setBody('')
      }

      return
    }

    const nextTemplateHeading = nextTemplate?.heading?.trim() ?? ''
    const nextTemplateStartTime = formatTemplateTime(nextTemplate?.default_start_time ?? null)
    const nextTemplateEndTime = formatTemplateTime(nextTemplate?.default_end_time ?? null)
    const nextTemplateBody = nextTemplate?.body ?? ''

    setDraft((currentDraft) => ({
      ...currentDraft,
      title:
        nextTemplateHeading &&
        shouldApplyTemplateValue({
          currentValue: currentDraft.title,
          previousTemplateValue: currentTemplateHeading,
          isEdited: editedTemplateFields.title,
        })
          ? nextTemplateHeading
          : currentDraft.title,
      start_time:
        nextTemplateStartTime &&
        shouldApplyTemplateValue({
          currentValue: currentDraft.start_time,
          previousTemplateValue: currentTemplateStartTime,
          isEdited: editedTemplateFields.start_time,
        })
          ? nextTemplateStartTime
          : currentDraft.start_time,
      end_time:
        nextTemplateEndTime &&
        shouldApplyTemplateValue({
          currentValue: currentDraft.end_time,
          previousTemplateValue: currentTemplateEndTime,
          isEdited: editedTemplateFields.end_time,
        })
          ? nextTemplateEndTime
          : currentDraft.end_time,
    }))

    if (
      shouldApplyTemplateValue({
        currentValue: body,
        previousTemplateValue: currentTemplateBody,
        isEdited: editedTemplateFields.body,
      })
    ) {
      setBody(nextTemplateBody)
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
    if (!isDateRangeOrdered(draft.start_date, effectiveEndDate)) {
      event.preventDefault()
      setFieldError(tripSheetDateRangeMessage)
      return
    }

    if (
      !isTripSheetWithinTripRange({
        tripStartDate: trip.start_date ?? '',
        tripEndDate: trip.end_date ?? '',
        tripSheetStartDate: draft.start_date,
        tripSheetEndDate: effectiveEndDate,
      })
    ) {
      event.preventDefault()
      setFieldError(tripSheetWithinTripRangeMessage)
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
      <input type="hidden" name="trip_id" value={trip.id} />

      <section className="app-section-card space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Trip Sheet Details</h2>
          <p className="mt-1 text-sm text-gray-600">
            Add the execution-specific title, schedule, and template for this trip sheet.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3">
            <p className="text-xs font-medium text-gray-500">Trip</p>
            <p className="mt-1 text-sm font-medium text-gray-900">{trip.title ?? '-'}</p>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3">
            <p className="text-xs font-medium text-gray-500">Trip Type</p>
            <p className="mt-1 text-sm font-medium text-gray-900">
              {formatTripTypeLabel(trip.trip_type)}
            </p>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3">
            <p className="text-xs font-medium text-gray-500">Destination</p>
            <p className="mt-1 text-sm font-medium text-gray-900">{trip.destination}</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="template_id" className="ui-label">Template</label>
            <select
              id="template_id"
              name="template_id"
              value={templateId}
              onChange={handleTemplateChange}
              className="ui-select ui-select-compact"
            >
              <option value="">Start from blank body</option>
              {tripTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.title ?? template.id}
                </option>
              ))}
            </select>
            <p className="mt-1 text-sm text-gray-600">
              Select a template to auto-fill title, time, and content.
            </p>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="title" className="ui-label">Trip Sheet Title</label>
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
            <label htmlFor="start_date" className="ui-label">Start Date</label>
            <input
              id="start_date"
              name="start_date"
              type="date"
              min={trip.start_date ?? undefined}
              max={trip.end_date ?? undefined}
              value={draft.start_date}
              onChange={updateDraftField}
              required
              className="ui-input ui-input-compact"
            />
          </div>

          <div>
            <label htmlFor="start_time" className="ui-label">Start Time</label>
            <input
              id="start_time"
              name="start_time"
              type="time"
              value={draft.start_time}
              onChange={updateDraftField}
              className="ui-input ui-input-compact"
            />
          </div>

          <div>
            <label htmlFor="end_date" className="ui-label">End Date</label>
            <input
              id="end_date"
              name="end_date"
              type="date"
              min={trip.start_date ?? undefined}
              max={trip.end_date ?? undefined}
              value={effectiveEndDate}
              onChange={updateDraftField}
              className="ui-input ui-input-compact"
            />
          </div>

          <div>
            <label htmlFor="end_time" className="ui-label">End Time</label>
            <input
              id="end_time"
              name="end_time"
              type="time"
              value={draft.end_time}
              onChange={updateDraftField}
              className="ui-input ui-input-compact"
            />
          </div>
        </div>

        {fieldError ? (
          <p className="text-sm text-red-700">{fieldError}</p>
        ) : null}
      </section>

      <section className="app-section-card space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Trip Sheet Body</h2>
          <p className="mt-1 text-sm text-gray-600">
            Start from a blank body or load template content, then edit it freely before save.
          </p>
        </div>

        <div>
          <label htmlFor="body" className="ui-label">Body</label>
          <textarea
            id="body"
            name="body"
            rows={14}
            value={body}
            onChange={(event) => {
              setEditedTemplateFields((currentFields) => ({
                ...currentFields,
                body: true,
              }))
              setBody(event.target.value)
            }}
            required
            className="ui-textarea"
          />
        </div>

        <div>
          <label htmlFor="transportation_info" className="ui-label">Transportation Details</label>
          <p className="mb-2 text-sm text-gray-600">
            Optional. Add driver name, phone number, vehicle details, or other transport notes.
          </p>
          <textarea
            id="transportation_info"
            name="transportation_info"
            rows={4}
            value={transportationInfo}
            onChange={(event) => setTransportationInfo(event.target.value)}
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
                  {formatAssignableLabel(resource)}
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
