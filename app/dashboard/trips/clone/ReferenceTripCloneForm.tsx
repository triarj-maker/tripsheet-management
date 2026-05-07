'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import ActionSubmitButton from '@/app/components/ActionSubmitButton'
import {
  guestOrCompanyRequiredMessage,
  hasGuestOrCompany,
} from '@/app/dashboard/trip-sheets/validation'
import {
  isDateRangeOrdered,
  tripDateRangeMessage,
} from '@/lib/trip-date-validation'
import type { TripWorkflowState } from '@/lib/trip-workflow'

import TripColorSelector from '../TripColorSelector'
import { createTripFromReference } from '../actions'

type ReferenceTripOption = {
  id: string
  title: string
  tripType: 'educational' | 'private' | ''
  tripTypeLabel: string
  destinationName: string
  companyId: string
  schoolId: string
}

type LookupOption = {
  id: string
  name: string
}

type ReferenceTripCloneFormProps = {
  referenceTrips: ReferenceTripOption[]
  schools: LookupOption[]
  companies: LookupOption[]
  errorMessage?: string
}

type TripDraft = {
  title: string
  start_date: string
  end_date: string
  guest_name: string
  company: string
  company_id: string
  school_id: string
  phone_number: string
  adult_count: string
  kid_count: string
  workflow_state: TripWorkflowState
  trip_color: string
}

function normalizeCountInput(value: string) {
  if (value.trim() === '') {
    return '0'
  }

  const parsedValue = Number.parseInt(value, 10)

  if (Number.isNaN(parsedValue) || parsedValue < 0) {
    return '0'
  }

  return String(parsedValue)
}

export default function ReferenceTripCloneForm({
  referenceTrips,
  schools,
  companies,
  errorMessage,
}: ReferenceTripCloneFormProps) {
  const [referenceSearch, setReferenceSearch] = useState('')
  const [selectedReferenceTripId, setSelectedReferenceTripId] = useState('')
  const [draft, setDraft] = useState<TripDraft>({
    title: '',
    start_date: '',
    end_date: '',
    guest_name: '',
    company: '',
    company_id: '',
    school_id: '',
    phone_number: '',
    adult_count: '0',
    kid_count: '0',
    workflow_state: 'tentative',
    trip_color: '',
  })
  const [fieldError, setFieldError] = useState('')
  const selectedReferenceTrip = useMemo(
    () => referenceTrips.find((trip) => trip.id === selectedReferenceTripId) ?? null,
    [referenceTrips, selectedReferenceTripId]
  )
  const hasCustomerOrLookup = Boolean(
    hasGuestOrCompany(draft.guest_name, draft.company) ||
      draft.company_id ||
      draft.school_id
  )
  const isEducationalTrip = selectedReferenceTrip?.tripType === 'educational'
  const companyLookupLabel = isEducationalTrip
    ? 'Partner / Company'
    : 'Company'
  const phoneLabel = isEducationalTrip ? 'Coordinator Phone Number' : 'Phone Number'

  function handleReferenceSearchChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextValue = event.target.value
    const matchingTrip =
      referenceTrips.find((trip) => trip.title === nextValue) ?? null

    setReferenceSearch(nextValue)
    setSelectedReferenceTripId(matchingTrip?.id ?? '')
    setDraft((currentDraft) => ({
      ...currentDraft,
      company_id: matchingTrip?.companyId ?? '',
      school_id: matchingTrip?.schoolId ?? '',
    }))

    if (matchingTrip && fieldError) {
      setFieldError('')
    }
  }

  function updateField(event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target
    const nextValue =
      name === 'adult_count' || name === 'kid_count'
        ? normalizeCountInput(value)
        : value

    setDraft((currentDraft) => {
      const nextDraft = {
        ...currentDraft,
        [name]: nextValue,
      }

      if (
        fieldError &&
        (name === 'guest_name' ||
          name === 'company' ||
          name === 'company_id' ||
          name === 'school_id') &&
        (hasGuestOrCompany(nextDraft.guest_name, nextDraft.company) ||
          nextDraft.company_id ||
          nextDraft.school_id)
      ) {
        setFieldError('')
      }

      if (name === 'start_date' || name === 'end_date') {
        setFieldError('')
      }

      return nextDraft
    })
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!selectedReferenceTripId) {
      event.preventDefault()
      setFieldError('Select an archived reference trip.')
      return
    }

    if (!hasCustomerOrLookup) {
      event.preventDefault()
      setFieldError(guestOrCompanyRequiredMessage)
      return
    }

    if (!isDateRangeOrdered(draft.start_date, draft.end_date)) {
      event.preventDefault()
      setFieldError(tripDateRangeMessage)
    }
  }

  return (
    <form action={createTripFromReference} onSubmit={handleSubmit} className="space-y-5">
      <input type="hidden" name="reference_trip_id" value={selectedReferenceTripId} />

      <section className="app-section-card space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Reference Trip</h2>
          <p className="mt-1 text-sm text-gray-600">
            Copies child trip sheets from an archived trip and shifts them to the new trip dates.
          </p>
        </div>

        <div>
          <label htmlFor="reference_trip_search" className="ui-label">
            Archived Reference Trip
          </label>
          <input
            id="reference_trip_search"
            type="search"
            list="reference_trip_options"
            value={referenceSearch}
            onChange={handleReferenceSearchChange}
            required
            placeholder="Search archived trips"
            className="ui-input ui-input-compact"
          />
          <datalist id="reference_trip_options">
            {referenceTrips.map((trip) => (
              <option key={trip.id} value={trip.title} />
            ))}
          </datalist>
        </div>

        {selectedReferenceTrip ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-gray-700">
            <p>
              <span className="font-medium text-gray-900">Trip Type:</span>{' '}
              {selectedReferenceTrip.tripTypeLabel}
            </p>
            <p className="mt-1">
              <span className="font-medium text-gray-900">Destination:</span>{' '}
              {selectedReferenceTrip.destinationName}
            </p>
          </div>
        ) : null}
      </section>

      <section className="app-section-card space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">New Trip Details</h2>
          <p className="mt-1 text-sm text-gray-600">
            Enter fresh parent trip details. Trip type and destination come from the
            archived reference trip.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="title" className="ui-label">New Trip Title</label>
            <input
              id="title"
              name="title"
              type="text"
              value={draft.title}
              onChange={updateField}
              required
              className="ui-input ui-input-compact"
            />
          </div>

          <div>
            <label htmlFor="trip_start_date" className="ui-label">Start Date</label>
            <input
              id="trip_start_date"
              name="trip_start_date"
              type="date"
              value={draft.start_date}
              onChange={updateField}
              required
              className="ui-input ui-input-compact"
            />
          </div>

          <div>
            <label htmlFor="trip_end_date" className="ui-label">End Date</label>
            <input
              id="trip_end_date"
              name="trip_end_date"
              type="date"
              min={draft.start_date || undefined}
              value={draft.end_date}
              onChange={updateField}
              required
              className="ui-input ui-input-compact"
            />
          </div>

          {isEducationalTrip ? (
            <div>
              <label htmlFor="school_id_select" className="ui-label">School</label>
              <select
                id="school_id_select"
                name="school_id"
                value={draft.school_id}
                onChange={updateField}
                className="ui-select ui-select-compact"
              >
                <option value="">No school selected</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
            </div>
          ) : draft.school_id ? (
            <input type="hidden" name="school_id" value={draft.school_id} />
          ) : null}

          <div>
            <label htmlFor="company_id_select" className="ui-label">{companyLookupLabel}</label>
            <select
              id="company_id_select"
              name="company_id"
              value={draft.company_id}
              onChange={updateField}
              className="ui-select ui-select-compact"
            >
              <option value="">No company selected</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>

          {isEducationalTrip ? (
            <input type="hidden" name="guest_name" value={draft.guest_name} />
          ) : (
            <div>
              <label htmlFor="guest_name" className="ui-label">Guest Name</label>
              <input
                id="guest_name"
                name="guest_name"
                type="text"
                value={draft.guest_name}
                onChange={updateField}
                className="ui-input ui-input-compact"
              />
            </div>
          )}

          <input type="hidden" name="company" value={draft.company} />

          <div>
            <label htmlFor="phone_number" className="ui-label">{phoneLabel}</label>
            <input
              id="phone_number"
              name="phone_number"
              type="tel"
              value={draft.phone_number}
              onChange={updateField}
              className="ui-input ui-input-compact"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="adult_count" className="ui-label">Adults</label>
              <input
                id="adult_count"
                name="adult_count"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={draft.adult_count}
                onChange={updateField}
                className="ui-input ui-input-compact"
              />
            </div>

            <div>
              <label htmlFor="kid_count" className="ui-label">Kids</label>
              <input
                id="kid_count"
                name="kid_count"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={draft.kid_count}
                onChange={updateField}
                className="ui-input ui-input-compact"
              />
            </div>
          </div>

          <div>
            <label htmlFor="workflow_state" className="ui-label">Workflow State</label>
            <select
              id="workflow_state"
              name="workflow_state"
              value={draft.workflow_state}
              onChange={(event) =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  workflow_state: event.target.value === 'active' ? 'active' : 'tentative',
                }))
              }
              className="ui-input ui-input-compact"
            >
              <option value="tentative">Tentative</option>
              <option value="active">Active</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="trip_color" className="ui-label">Trip Color</label>
            <TripColorSelector
              id="trip_color"
              name="trip_color"
              value={draft.trip_color}
              onChange={(value) =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  trip_color: value,
                }))
              }
              allowAuto
              autoLabel="Auto-assign next color"
            />
          </div>
        </div>

        {fieldError ? <p className="text-sm text-red-700">{fieldError}</p> : null}
        {errorMessage ? <p className="text-sm text-red-700">{errorMessage}</p> : null}
      </section>

      <div className="flex flex-wrap items-center gap-2.5">
        <ActionSubmitButton
          idleLabel="Create from Reference"
          pendingLabel="Creating…"
          className="ui-button-primary ui-button-compact"
        />
        <Link href="/dashboard/trips" className="ui-button ui-button-secondary ui-button-compact">
          Cancel
        </Link>
      </div>
    </form>
  )
}

export type { ReferenceTripOption }
