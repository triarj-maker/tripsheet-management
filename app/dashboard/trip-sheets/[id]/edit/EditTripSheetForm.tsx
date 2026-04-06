'use client'

import Link from 'next/link'
import { useState } from 'react'

import ActionSubmitButton from '@/app/components/ActionSubmitButton'
import { formatTripTypeLabel } from '@/lib/trip-sheets'
import { updateTripSheet } from '../../actions'

type TripSheet = {
  id: string
  trip_id: string
  title: string | null
  start_date: string | null
  start_time: string | null
  end_date: string | null
  end_time: string | null
  body_text: string | null
  templateTitle: string | null
}

type EditTripSheetFormProps = {
  tripSheet: TripSheet
  trip: {
    id: string
    title: string | null
    trip_type: string | null
    destination: string
  }
}

type TripSheetDraft = {
  title: string
  start_date: string
  start_time: string
  end_date: string
  end_time: string
  body: string
}

export default function EditTripSheetForm({
  tripSheet,
  trip,
}: EditTripSheetFormProps) {
  const [draft, setDraft] = useState<TripSheetDraft>({
    title: tripSheet.title ?? '',
    start_date: tripSheet.start_date ?? '',
    start_time: tripSheet.start_time ?? '',
    end_date: tripSheet.end_date ?? '',
    end_time: tripSheet.end_time ?? '',
    body: tripSheet.body_text ?? '',
  })

  function updateDraftField(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const name = event.target.name as keyof TripSheetDraft
    const { value } = event.target

    setDraft((currentDraft) => ({
      ...currentDraft,
      [name]: value,
    }))
  }

  return (
    <form action={updateTripSheet} className="space-y-4">
      <input type="hidden" name="id" value={tripSheet.id} />
      <input type="hidden" name="trip_id" value={tripSheet.trip_id} />

      <section className="app-section-card space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Trip Sheet Details</h2>
          <p className="mt-1 text-sm text-gray-600">
            Update the execution-specific details for this trip sheet.
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

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
              value={draft.end_date}
              onChange={updateDraftField}
              required
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

          <div className="md:col-span-2">
            <label htmlFor="template_id" className="ui-label">Template</label>
            <select
              id="template_id"
              disabled
              className="ui-select ui-select-compact"
              defaultValue=""
            >
              <option value="">
                {tripSheet.templateTitle ?? 'No template selected'}
              </option>
            </select>
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
        <Link
          href={`/dashboard/trips/${tripSheet.trip_id}`}
          className="ui-button ui-button-secondary ui-button-compact"
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}
