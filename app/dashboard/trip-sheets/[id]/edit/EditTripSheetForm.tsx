'use client'

import Link from 'next/link'
import { useState } from 'react'

import ActionLinkButton from '@/app/components/ActionLinkButton'
import ActionSubmitButton from '@/app/components/ActionSubmitButton'
import { updateTripSheet } from '../../actions'
import {
  guestOrCompanyRequiredMessage,
  hasGuestOrCompany,
} from '../../validation'

type TripSheet = {
  id: string
  title: string | null
  destination: string | null
  start_date: string | null
  end_date: string | null
  guest_name: string | null
  company: string | null
  phone_number: string | null
  body_text: string | null
}

type EditTripSheetFormProps = {
  tripSheet: TripSheet
  errorMessage?: string
}

type TripSheetDraft = {
  title: string
  destination: string
  start_date: string
  end_date: string
  guest_name: string
  company: string
  phone_number: string
  body: string
}

export default function EditTripSheetForm({
  tripSheet,
  errorMessage,
}: EditTripSheetFormProps) {
  const [draft, setDraft] = useState<TripSheetDraft>({
    title: tripSheet.title ?? '',
    destination: tripSheet.destination ?? '',
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

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!hasGuestOrCompany(draft.guest_name, draft.company)) {
      event.preventDefault()
      setFieldError(guestOrCompanyRequiredMessage)
    }
  }

  return (
    <form action={updateTripSheet} onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="id" value={tripSheet.id} />

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
        <label htmlFor="destination" className="mb-1 block text-sm font-medium text-gray-700">
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
          Guest / School Name
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
        {fieldError ? (
          <p className="mt-2 text-sm text-red-700">{fieldError}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="phone_number" className="mb-1 block text-sm font-medium text-gray-700">
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
        <label htmlFor="body" className="mb-1 block text-sm font-medium text-gray-700">
          Body
        </label>
        <textarea
          id="body"
          name="body"
          rows={14}
          value={draft.body}
          onChange={updateDraftField}
          required
          className="w-full rounded border border-zinc-300 px-3 py-2 text-gray-900 placeholder:text-gray-400"
        />
      </div>

      <div className="flex items-center gap-3">
        <ActionSubmitButton
          idleLabel="Save Changes"
          pendingLabel="Saving…"
          className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-gray-900"
        />
        <ActionLinkButton
          href={`/dashboard/trip-sheets/new?duplicateFrom=${tripSheet.id}`}
          idleLabel="Duplicate"
          pendingLabel="Duplicating…"
          className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-gray-900"
        />
        <Link
          href="/dashboard/trip-sheets"
          className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-gray-900"
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}
