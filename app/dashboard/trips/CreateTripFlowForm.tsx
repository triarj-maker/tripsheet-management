'use client'

import Link from 'next/link'
import { useState } from 'react'

import ActionSubmitButton from '@/app/components/ActionSubmitButton'
import {
  guestOrCompanyRequiredMessage,
  hasGuestOrCompany,
} from '@/app/dashboard/trip-sheets/validation'
import {
  isDateRangeOrdered,
  isTripSheetWithinTripRange,
  tripDateRangeMessage,
} from '@/lib/trip-date-validation'
import { toTripTypeFormValue } from '@/lib/trip-sheets'
import { normalizeTripWorkflowState, type TripWorkflowState } from '@/lib/trip-workflow'

import TripColorSelector from './TripColorSelector'

type DestinationOption = {
  id: string
  name: string
}

type LookupOption = {
  id: string
  name: string
}

type CreateTripFlowFormProps = {
  destinations: DestinationOption[]
  schools: LookupOption[]
  companies: LookupOption[]
  submitAction: (formData: FormData) => void
  cancelHref: string
  errorMessage?: string
  initialTripValues?: TripDraft
  cloneSource?: {
    tripId: string
    originalStartDate: string
    tripSheets: Array<{
      id: string
      title: string
      start_date: string
      start_time: string
      end_date: string
      end_time: string
    }>
  }
}

type TripDraft = {
  title: string
  trip_type: string
  destination_id: string
  trip_color: string
  adult_count: string
  kid_count: string
  guest_name: string
  company: string
  company_id?: string
  school_id?: string
  phone_number: string
  start_date: string
  end_date: string
  workflow_state: TripWorkflowState
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)

  if (!year || !month || !day) {
    return null
  }

  return new Date(Date.UTC(year, month - 1, day))
}

function addDays(value: string, offsetInDays: number) {
  const parsedDate = parseIsoDate(value)

  if (!parsedDate) {
    return ''
  }

  parsedDate.setUTCDate(parsedDate.getUTCDate() + offsetInDays)

  const year = parsedDate.getUTCFullYear()
  const month = String(parsedDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(parsedDate.getUTCDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getDateOffsetInDays(baseDate: string, nextDate: string) {
  const parsedBaseDate = parseIsoDate(baseDate)
  const parsedNextDate = parseIsoDate(nextDate)

  if (!parsedBaseDate || !parsedNextDate) {
    return 0
  }

  return Math.round(
    (parsedNextDate.getTime() - parsedBaseDate.getTime()) / 86400000
  )
}

function formatDateLabel(value: string) {
  const parsedDate = parseIsoDate(value)

  if (!parsedDate) {
    return value || '-'
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsedDate)
}

function formatTimeLabel(value: string) {
  const [hoursText, minutesText] = value.split(':')
  const hours = Number(hoursText)
  const minutes = Number(minutesText)

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return value || ''
  }

  const period = hours >= 12 ? 'PM' : 'AM'
  const hourValue = hours % 12 || 12

  return `${hourValue}:${String(minutes).padStart(2, '0')} ${period}`
}

function buildScheduleLabel({
  startDate,
  startTime,
  endDate,
  endTime,
}: {
  startDate: string
  startTime: string
  endDate: string
  endTime: string
}) {
  const startLabel = startTime
    ? `${formatDateLabel(startDate)}, ${formatTimeLabel(startTime)}`
    : formatDateLabel(startDate)
  const endLabel = endTime
    ? `${formatDateLabel(endDate)}, ${formatTimeLabel(endTime)}`
    : formatDateLabel(endDate)

  return `${startLabel} to ${endLabel}`
}

const cloneTripSheetsOutsideRangeMessage =
  'Cloned trip sheet dates fall outside the new trip date range. Adjust the trip dates and try again.'

export default function CreateTripFlowForm({
  destinations,
  schools,
  companies,
  submitAction,
  cancelHref,
  errorMessage,
  initialTripValues,
  cloneSource,
}: CreateTripFlowFormProps) {
  const isCloneMode = Boolean(cloneSource)
  const [tripDraft, setTripDraft] = useState<TripDraft>({
    title: initialTripValues?.title ?? '',
    trip_type: initialTripValues?.trip_type ?? toTripTypeFormValue(''),
    destination_id: initialTripValues?.destination_id ?? '',
    trip_color: initialTripValues?.trip_color ?? '',
    adult_count: initialTripValues?.adult_count ?? '0',
    kid_count: initialTripValues?.kid_count ?? '0',
    guest_name: initialTripValues?.guest_name ?? '',
    company: initialTripValues?.company ?? '',
    company_id: initialTripValues?.company_id ?? '',
    school_id: initialTripValues?.school_id ?? '',
    phone_number: initialTripValues?.phone_number ?? '',
    start_date: initialTripValues?.start_date ?? '',
    end_date: initialTripValues?.end_date ?? '',
    workflow_state: normalizeTripWorkflowState(initialTripValues?.workflow_state ?? 'tentative'),
  })
  const hasCustomerOrLookup = Boolean(
    hasGuestOrCompany(tripDraft.guest_name, tripDraft.company) ||
      tripDraft.company_id ||
      tripDraft.school_id
  )
  const isEducationalTrip = tripDraft.trip_type === 'educational'
  const companyLookupLabel = isEducationalTrip
    ? 'Partner / Company'
    : 'Company'
  const phoneLabel = isEducationalTrip ? 'Coordinator Phone Number' : 'Phone Number'
  const [tripError, setTripError] = useState(
    errorMessage === guestOrCompanyRequiredMessage ? errorMessage : ''
  )

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

  function updateTripField(
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name } = event.target
    const fieldName =
      name === 'trip_start_date'
        ? 'start_date'
        : name === 'trip_end_date'
          ? 'end_date'
          : name
    const value =
      fieldName === 'adult_count' || fieldName === 'kid_count'
        ? normalizeCountInput(event.target.value)
        : event.target.value

    setTripDraft((currentDraft) => {
      const nextDraft = {
        ...currentDraft,
        [fieldName]: value,
      }

      if (
        tripError &&
        (fieldName === 'guest_name' ||
          fieldName === 'company' ||
          fieldName === 'company_id' ||
          fieldName === 'school_id') &&
        (hasGuestOrCompany(nextDraft.guest_name, nextDraft.company) ||
          nextDraft.company_id ||
          nextDraft.school_id)
      ) {
        setTripError('')
      }

      if (fieldName === 'start_date' || fieldName === 'end_date') {
        setTripError('')
      }

      return nextDraft
    })
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!hasCustomerOrLookup) {
      event.preventDefault()
      setTripError(guestOrCompanyRequiredMessage)
      return
    }

    if (!isDateRangeOrdered(tripDraft.start_date, tripDraft.end_date)) {
      event.preventDefault()
      setTripError(tripDateRangeMessage)
      return
    }

    if (isCloneMode) {
      const hasOutOfRangeClone = cloneTripSheets.some((tripSheet) => {
        if (
          !tripSheet.shiftedStartDate ||
          !tripSheet.shiftedEndDate ||
          !isDateRangeOrdered(tripSheet.shiftedStartDate, tripSheet.shiftedEndDate)
        ) {
          return true
        }

        return !isTripSheetWithinTripRange({
          tripStartDate: tripDraft.start_date,
          tripEndDate: tripDraft.end_date,
          tripSheetStartDate: tripSheet.shiftedStartDate,
          tripSheetEndDate: tripSheet.shiftedEndDate,
        })
      })

      if (hasOutOfRangeClone) {
        event.preventDefault()
        setTripError(cloneTripSheetsOutsideRangeMessage)
      }

      return
    }
  }

  const cloneTripSheets =
    cloneSource?.tripSheets.map((tripSheet) => {
      const startOffset = getDateOffsetInDays(
        cloneSource.originalStartDate,
        tripSheet.start_date
      )
      const endOffset = getDateOffsetInDays(
        cloneSource.originalStartDate,
        tripSheet.end_date
      )
      const shiftedStartDate =
        cloneSource.originalStartDate && tripDraft.start_date
          ? addDays(tripDraft.start_date, startOffset)
          : tripSheet.start_date
      const shiftedEndDate =
        cloneSource.originalStartDate && tripDraft.start_date
          ? addDays(tripDraft.start_date, endOffset)
          : tripSheet.end_date

      return {
        ...tripSheet,
        shiftedStartDate,
        shiftedEndDate,
      }
    }) ?? []

  return (
    <form action={submitAction} onSubmit={handleSubmit} className="space-y-5">
      {cloneSource ? (
        <input type="hidden" name="clone_source_trip_id" value={cloneSource.tripId} />
      ) : null}
      <section className="app-section-card space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Trip Details</h2>
          <p className="mt-1 text-sm text-gray-600">
            {isCloneMode
              ? 'Use the source trip as a base, adjust the parent trip details, then save to create a new trip and cloned child trip sheets.'
              : 'Create the parent trip record with the shared customer and destination context.'}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="title" className="ui-label">Title</label>
            <input
              id="title"
              name="title"
              type="text"
              value={tripDraft.title}
              onChange={updateTripField}
              required
              className="ui-input ui-input-compact"
            />
          </div>

          <div>
            <label htmlFor="workflow_state" className="ui-label">Workflow State</label>
            <select
              id="workflow_state"
              name="workflow_state"
              value={tripDraft.workflow_state}
              onChange={updateTripField}
              className="ui-select ui-select-compact"
            >
              <option value="tentative">Tentative</option>
              <option value="active">Active</option>
            </select>
          </div>

          <div>
            <label htmlFor="trip_type" className="ui-label">Trip Type</label>
            <select
              id="trip_type"
              name="trip_type"
              value={tripDraft.trip_type}
              onChange={updateTripField}
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
              value={tripDraft.destination_id}
              onChange={updateTripField}
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
            <label htmlFor="adult_count" className="ui-label">Adult Numbers</label>
            <input
              id="adult_count"
              name="adult_count"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={tripDraft.adult_count}
              onChange={updateTripField}
              className="ui-input ui-input-compact"
            />
          </div>

          <div>
            <label htmlFor="kid_count" className="ui-label">Kid Numbers</label>
            <input
              id="kid_count"
              name="kid_count"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={tripDraft.kid_count}
              onChange={updateTripField}
              className="ui-input ui-input-compact"
            />
          </div>

          {isEducationalTrip ? (
            <div>
              <label htmlFor="school_id" className="ui-label">School</label>
              <select
                id="school_id"
                name="school_id"
                value={tripDraft.school_id ?? ''}
                onChange={updateTripField}
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
          ) : tripDraft.school_id ? (
            <input type="hidden" name="school_id" value={tripDraft.school_id} />
          ) : null}

          <div>
            <label htmlFor="company_id" className="ui-label">{companyLookupLabel}</label>
            <select
              id="company_id"
              name="company_id"
              value={tripDraft.company_id ?? ''}
              onChange={updateTripField}
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
            <input type="hidden" name="guest_name" value={tripDraft.guest_name} />
          ) : (
            <div>
              <label htmlFor="guest_name" className="ui-label">Guest Name</label>
              <input
                id="guest_name"
                name="guest_name"
                type="text"
                value={tripDraft.guest_name}
                onChange={updateTripField}
                className="ui-input ui-input-compact"
              />
            </div>
          )}

          <input type="hidden" name="company" value={tripDraft.company} />

          <div>
            <label htmlFor="phone_number" className="ui-label">{phoneLabel}</label>
            <input
              id="phone_number"
              name="phone_number"
              type="tel"
              value={tripDraft.phone_number}
              onChange={updateTripField}
              className="ui-input ui-input-compact"
            />
          </div>

          <div className="grid gap-4 md:col-span-2 md:grid-cols-2">
            <div>
              <label htmlFor="trip_start_date" className="ui-label">Trip Start Date</label>
              <input
                id="trip_start_date"
                name="trip_start_date"
                type="date"
                value={tripDraft.start_date}
                onChange={updateTripField}
                required
                className="ui-input ui-input-compact"
              />
            </div>

            <div>
              <label htmlFor="trip_end_date" className="ui-label">Trip End Date</label>
              <input
                id="trip_end_date"
                name="trip_end_date"
                type="date"
                min={tripDraft.start_date || undefined}
                value={tripDraft.end_date}
                onChange={updateTripField}
                required
                className="ui-input ui-input-compact"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="trip_color" className="ui-label">Trip Color</label>
            <TripColorSelector
              id="trip_color"
              name="trip_color"
              value={tripDraft.trip_color}
              onChange={(value) =>
                setTripDraft((currentDraft) => ({
                  ...currentDraft,
                  trip_color: value,
                }))
              }
              allowAuto
              autoLabel="Auto-assign next color"
            />
          </div>
        </div>

        {tripError ? <p className="text-sm text-red-700">{tripError}</p> : null}
      </section>

      {isCloneMode ? (
        <section className="app-section-card space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Trip Sheets to Clone</h2>
            <p className="mt-1 text-sm text-gray-600">
              These child trip sheets will be duplicated under the new trip when you save.
              Assignments and archived state will not be copied.
            </p>
          </div>

          {cloneTripSheets.length === 0 ? (
            <p className="text-sm text-gray-700">No child trip sheets are available to clone.</p>
          ) : (
            <div className="space-y-2.5">
              {cloneTripSheets.map((tripSheet) => (
                <div
                  key={tripSheet.id}
                  className="rounded-lg border border-zinc-200 px-3 py-2.5"
                >
                  <p className="text-sm font-medium text-gray-900">{tripSheet.title}</p>
                  <p className="mt-1 text-xs text-gray-600">
                    {buildScheduleLabel({
                      startDate: tripSheet.shiftedStartDate,
                      startTime: tripSheet.start_time,
                      endDate: tripSheet.shiftedEndDate,
                      endTime: tripSheet.end_time,
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-2.5">
        <ActionSubmitButton
          idleLabel="Create Trip"
          pendingLabel="Creating…"
          className="ui-button-primary ui-button-compact"
        />
        <Link href={cancelHref} className="ui-button ui-button-secondary ui-button-compact">
          Cancel
        </Link>
      </div>
    </form>
  )
}
