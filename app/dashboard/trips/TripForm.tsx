'use client'

import Link from 'next/link'
import { type ReactNode, useState } from 'react'

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

type ChildTripSheetPreview = {
  id: string
  title: string
  start_date: string
  end_date: string
}

type TripFormInitialValues = {
  id?: string
  original_start_date?: string
  original_end_date?: string
  title: string
  trip_type: string
  destination_id: string
  trip_color: string
  adult_count: string
  kid_count: string
  start_date: string
  end_date: string
  guest_name: string
  company: string
  company_id?: string
  school_id?: string
  phone_number: string
  workflow_state: TripWorkflowState
  has_child_trip_sheets: boolean
  child_trip_sheets?: ChildTripSheetPreview[]
}

type TripFormProps = {
  mode: 'create' | 'edit'
  destinations: DestinationOption[]
  schools: LookupOption[]
  companies: LookupOption[]
  initialValues?: TripFormInitialValues
  submitAction: (formData: FormData) => void
  cancelHref: string
  footerLeadingContent?: ReactNode
}

type TripDraft = {
  title: string
  trip_type: string
  destination_id: string
  trip_color: string
  adult_count: string
  kid_count: string
  start_date: string
  end_date: string
  guest_name: string
  company: string
  company_id: string
  school_id: string
  phone_number: string
  workflow_state: TripWorkflowState
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)

  if (!year || !month || !day) {
    return null
  }

  return new Date(Date.UTC(year, month - 1, day))
}

function getDateOffsetInDays(baseDate: string, nextDate: string) {
  const parsedBaseDate = parseIsoDate(baseDate)
  const parsedNextDate = parseIsoDate(nextDate)

  if (!parsedBaseDate || !parsedNextDate) {
    return null
  }

  return Math.round(
    (parsedNextDate.getTime() - parsedBaseDate.getTime()) / 86400000
  )
}

function addDaysToDateString(value: string, offsetInDays: number) {
  const parsedDate = parseIsoDate(value)

  if (!parsedDate) {
    return null
  }

  parsedDate.setUTCDate(parsedDate.getUTCDate() + offsetInDays)

  const year = parsedDate.getUTCFullYear()
  const month = String(parsedDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(parsedDate.getUTCDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatPreviewDateRange(startDate: string, endDate: string) {
  if (!startDate || !endDate) {
    return 'Date TBD'
  }

  if (startDate === endDate) {
    return startDate
  }

  return `${startDate} -> ${endDate}`
}

export default function TripForm({
  mode,
  destinations,
  schools,
  companies,
  initialValues,
  submitAction,
  cancelHref,
  footerLeadingContent,
}: TripFormProps) {
  const [draft, setDraft] = useState<TripDraft>({
    title: initialValues?.title ?? '',
    trip_type: toTripTypeFormValue(initialValues?.trip_type),
    destination_id: initialValues?.destination_id ?? '',
    trip_color: initialValues?.trip_color ?? '',
    adult_count: initialValues?.adult_count ?? '0',
    kid_count: initialValues?.kid_count ?? '0',
    start_date: initialValues?.start_date ?? '',
    end_date: initialValues?.end_date ?? '',
    guest_name: initialValues?.guest_name ?? '',
    company: initialValues?.company ?? '',
    company_id: initialValues?.company_id ?? '',
    school_id: initialValues?.school_id ?? '',
    phone_number: initialValues?.phone_number ?? '',
    workflow_state: normalizeTripWorkflowState(initialValues?.workflow_state),
  })
  const [fieldError, setFieldError] = useState('')
  const originalTripStartDate = initialValues?.original_start_date ?? ''
  const originalTripEndDate = initialValues?.original_end_date ?? ''
  const childTripSheets = initialValues?.child_trip_sheets ?? []
  const hasCustomerOrLookup = Boolean(
    hasGuestOrCompany(draft.guest_name, draft.company) ||
      draft.company_id ||
      draft.school_id
  )
  const isEducationalTrip = draft.trip_type === 'educational'
  const companyLookupLabel = isEducationalTrip
    ? 'Partner / Company'
    : 'Company'
  const phoneLabel = isEducationalTrip ? 'Coordinator Phone Number' : 'Phone Number'
  const isTripDateShiftPreviewActive =
    mode === 'edit' &&
    childTripSheets.length > 0 &&
    Boolean(originalTripStartDate && originalTripEndDate) &&
    (draft.start_date !== originalTripStartDate || draft.end_date !== originalTripEndDate)

  const tripShiftPreview = isTripDateShiftPreviewActive
    ? childTripSheets.map((tripSheet) => {
        const startOffset = getDateOffsetInDays(
          originalTripStartDate,
          tripSheet.start_date
        )
        const endOffset = getDateOffsetInDays(
          originalTripStartDate,
          tripSheet.end_date
        )

        if (startOffset === null || endOffset === null) {
          return {
            id: tripSheet.id,
            title: tripSheet.title,
            start_date: null,
            end_date: null,
            fallsOutsideRange: true,
            hasShiftError: true,
          }
        }

        const shiftedStartDate = addDaysToDateString(draft.start_date, startOffset)
        const shiftedEndDate = addDaysToDateString(draft.start_date, endOffset)

        if (!shiftedStartDate || !shiftedEndDate) {
          return {
            id: tripSheet.id,
            title: tripSheet.title,
            start_date: null,
            end_date: null,
            fallsOutsideRange: true,
            hasShiftError: true,
          }
        }

        const fallsOutsideRange = !isTripSheetWithinTripRange({
          tripStartDate: draft.start_date,
          tripEndDate: draft.end_date,
          tripSheetStartDate: shiftedStartDate,
          tripSheetEndDate: shiftedEndDate,
        })

        return {
          id: tripSheet.id,
          title: tripSheet.title,
          start_date: shiftedStartDate,
          end_date: shiftedEndDate,
          fallsOutsideRange,
          hasShiftError: false,
        }
      })
    : []
  const outOfRangeShiftPreview = tripShiftPreview.filter(
    (tripSheet) => tripSheet.fallsOutsideRange
  )
  const previewExamples = tripShiftPreview.slice(0, 3)
  const formId =
    mode === 'edit' && initialValues?.id
      ? `trip-form-${initialValues.id}`
      : 'trip-form-create'

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

  function updateField(
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name } = event.target
    const value =
      name === 'adult_count' || name === 'kid_count'
        ? normalizeCountInput(event.target.value)
        : event.target.value

    setDraft((currentDraft) => {
      const nextDraft = {
        ...currentDraft,
        [name]: value,
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
    <div className="space-y-5">
      <form
        id={formId}
        action={submitAction}
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        {initialValues?.id !== undefined ? (
          <input type="hidden" name="id" value={initialValues.id} />
        ) : null}
        {mode === 'edit' ? (
          <input
            type="hidden"
            name="original_start_date"
            value={initialValues?.original_start_date ?? ''}
          />
        ) : null}
        {mode === 'edit' ? (
          <input
            type="hidden"
            name="original_end_date"
            value={initialValues?.original_end_date ?? ''}
          />
        ) : null}
      <section className="app-section-card space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Trip Details</h2>
          <p className="mt-1 text-sm text-gray-600">
            Set the shared trip metadata that child trip sheets will execute against.
          </p>
          {mode === 'edit' && initialValues?.has_child_trip_sheets ? (
            <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              If you change the trip dates, child trip sheet dates will shift automatically
              relative to the new trip start date when you save.
            </p>
          ) : null}
          {isTripDateShiftPreviewActive ? (
            <div className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800">
              <p className="font-medium">
                Preview: {tripShiftPreview.length} child trip sheet
                {tripShiftPreview.length === 1 ? '' : 's'} will shift with the new trip
                dates.
              </p>
              {previewExamples.length > 0 ? (
                <div className="space-y-1 text-xs text-slate-600">
                  {previewExamples.map((tripSheet) => (
                    <p key={tripSheet.id}>
                      {tripSheet.title}: {formatPreviewDateRange(
                        tripSheet.start_date ?? '',
                        tripSheet.end_date ?? ''
                      )}
                    </p>
                  ))}
                  {tripShiftPreview.length > previewExamples.length ? (
                    <p>
                      +{tripShiftPreview.length - previewExamples.length} more trip sheet
                      {tripShiftPreview.length - previewExamples.length === 1 ? '' : 's'}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {outOfRangeShiftPreview.length > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                  <p className="font-medium">
                    Warning: {outOfRangeShiftPreview.length} shifted child trip sheet
                    {outOfRangeShiftPreview.length === 1 ? '' : 's'} would fall outside the
                    new trip range.
                  </p>
                  <div className="mt-1 space-y-1 text-xs">
                    {outOfRangeShiftPreview.slice(0, 3).map((tripSheet) => (
                      <p key={tripSheet.id}>
                        {tripSheet.title}: {formatPreviewDateRange(
                          tripSheet.start_date ?? '',
                          tripSheet.end_date ?? ''
                        )}
                      </p>
                    ))}
                    {outOfRangeShiftPreview.length > 3 ? (
                      <p>
                        +{outOfRangeShiftPreview.length - 3} more outside the new trip range
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="title" className="ui-label">Title</label>
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

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="start_date" className="ui-label">Trip Start Date</label>
              <input
                id="start_date"
                name="start_date"
                type="date"
                value={draft.start_date}
                onChange={updateField}
                required
                className="ui-input ui-input-compact"
              />
            </div>

            <div>
              <label htmlFor="end_date" className="ui-label">Trip End Date</label>
              <input
                id="end_date"
                name="end_date"
                type="date"
                min={draft.start_date || undefined}
                value={draft.end_date}
                onChange={updateField}
                required
                className="ui-input ui-input-compact"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="trip_type" className="ui-label">Trip Type</label>
              <select
                id="trip_type"
                name="trip_type"
                value={draft.trip_type}
                onChange={updateField}
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
                onChange={updateField}
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
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {isEducationalTrip ? (
              <div>
                <label htmlFor="school_id" className="ui-label">School</label>
                <select
                  id="school_id"
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
              <label htmlFor="company_id" className="ui-label">{companyLookupLabel}</label>
              <select
                id="company_id"
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
          </div>

          <div className="grid gap-4 md:grid-cols-3">
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

            <input type="hidden" name="company" value={draft.company} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="adult_count" className="ui-label">Adult Numbers</label>
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
              <label htmlFor="kid_count" className="ui-label">Kid Numbers</label>
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

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="workflow_state" className="ui-label">Workflow State</label>
              <select
                id="workflow_state"
                name="workflow_state"
                value={draft.workflow_state}
                onChange={updateField}
                className="ui-select ui-select-compact"
              >
                <option value="tentative">Tentative</option>
                <option value="active">Active</option>
              </select>
            </div>

            <div>
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
              />
            </div>
          </div>
        </div>

        {fieldError ? <p className="text-sm text-red-700">{fieldError}</p> : null}
      </section>

        {!footerLeadingContent ? (
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <Link href={cancelHref} className="ui-button ui-button-secondary ui-button-compact">
              Cancel
            </Link>
            <ActionSubmitButton
              idleLabel={mode === 'create' ? 'Create Trip' : 'Save Changes'}
              pendingLabel={mode === 'create' ? 'Creating…' : 'Saving…'}
              className="ui-button-primary ui-button-compact"
            />
          </div>
        ) : null}
      </form>

      {footerLeadingContent ? (
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            {footerLeadingContent}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link href={cancelHref} className="ui-button ui-button-secondary ui-button-compact">
              Cancel
            </Link>
            <button
              type="submit"
              form={formId}
              className="ui-button ui-button-primary ui-button-compact"
            >
              {mode === 'create' ? 'Create Trip' : 'Save Changes'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
