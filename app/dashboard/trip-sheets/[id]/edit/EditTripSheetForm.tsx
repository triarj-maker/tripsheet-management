'use client'

import Link from 'next/link'
import { useState } from 'react'

import ActionLinkButton from '@/app/components/ActionLinkButton'
import ActionSubmitButton from '@/app/components/ActionSubmitButton'
import { toTripTypeFormValue, type DestinationRelation } from '@/lib/trip-sheets'
import { updateTripSheet } from '../../actions'
import {
  guestOrCompanyRequiredMessage,
  hasGuestOrCompany,
} from '../../validation'

type DestinationOption = {
  id: string
  name: string
}

type TripSheet = {
  id: string
  title: string | null
  trip_type: string | null
  destination_id: string | null
  destination_ref: DestinationRelation
  start_date: string | null
  end_date: string | null
  guest_name: string | null
  company: string | null
  phone_number: string | null
  body_text: string | null
}

type EditTripSheetFormProps = {
  tripSheet: TripSheet
  templateName: string | null
  destinations: DestinationOption[]
  errorMessage?: string
}

type TripSheetDraft = {
  title: string
  trip_type: string
  destination_id: string
  start_date: string
  end_date: string
  guest_name: string
  company: string
  phone_number: string
  body: string
}

export default function EditTripSheetForm({
  tripSheet,
  templateName,
  destinations,
  errorMessage,
}: EditTripSheetFormProps) {
  const [draft, setDraft] = useState<TripSheetDraft>({
    title: tripSheet.title ?? '',
    trip_type: toTripTypeFormValue(tripSheet.trip_type),
    destination_id: tripSheet.destination_id ?? '',
    start_date: tripSheet.start_date ?? '',
    end_date: tripSheet.end_date ?? '',
    guest_name: tripSheet.guest_name ?? '',
    company: tripSheet.company ?? '',
    phone_number: tripSheet.phone_number ?? '',
    body: tripSheet.body_text ?? '',
  })
  const [fieldError, setFieldError] = useState(
    errorMessage === guestOrCompanyRequiredMessage ? errorMessage : ''
  )

  function updateDraftField(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
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

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!hasGuestOrCompany(draft.guest_name, draft.company)) {
      event.preventDefault()
      setFieldError(guestOrCompanyRequiredMessage)
    }
  }

  return (
    <form
      action={updateTripSheet}
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      <input type="hidden" name="id" value={tripSheet.id} />

      <section className="app-section-card space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Trip Details</h2>
          <p className="mt-1 text-sm text-gray-600">
            Update the core trip information and contact details.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
            <label htmlFor="trip_type" className="ui-label">Trip Type</label>
            <select
              id="trip_type"
              name="trip_type"
              value={draft.trip_type}
              onChange={updateDraftField}
              required
              className="ui-select ui-select-compact"
            >
              <option value="">Select trip type</option>
              <option value="educational">Educational</option>
              <option value="private">Private</option>
            </select>
          </div>

          <div>
            <label htmlFor="destination_id" className="ui-label">Destination</label>
            <select
              id="destination_id"
              name="destination_id"
              value={draft.destination_id}
              onChange={updateDraftField}
              required
              className="ui-select ui-select-compact"
            >
              <option value="">Select a destination</option>
              {destinations.map((destination) => (
                <option key={destination.id} value={destination.id}>
                  {destination.name}
                </option>
              ))}
            </select>
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
            <label htmlFor="template_name" className="ui-label">Template</label>
            <input
              id="template_name"
              type="text"
              value={templateName ?? 'Locked template'}
              readOnly
              disabled
              className="ui-input ui-input-compact bg-zinc-50 text-gray-500"
            />
          </div>
        </div>
      </section>

      <section className="app-section-card space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Trip Sheet Body</h2>
          <p className="mt-1 text-sm text-gray-600">
            Edit the final trip sheet content shown to assigned resources.
          </p>
        </div>

        <div>
          <label htmlFor="body" className="ui-label">Body</label>
          <textarea
            id="body"
            name="body"
            rows={14}
            value={draft.body}
            onChange={updateDraftField}
            required
            className="ui-textarea"
          />
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2.5">
        <ActionSubmitButton
          idleLabel="Save Changes"
          pendingLabel="Saving…"
          className="ui-button-primary ui-button-compact"
        />
        <ActionLinkButton
          href={`/dashboard/trip-sheets/new?duplicateFrom=${tripSheet.id}`}
          idleLabel="Duplicate"
          pendingLabel="Duplicating…"
          className="ui-button-secondary ui-button-compact"
        />
        <Link
          href="/dashboard/trip-sheets"
          className="ui-button ui-button-secondary ui-button-compact"
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}
