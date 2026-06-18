'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'

import {
  replaceTripSheetAssignments,
  updateTripSheetSchedule,
} from '@/app/dashboard/trip-sheets/actions'

type AssignedResource = {
  assignmentId: string
  resourceUserId: string
  label: string
}

type StagedAssignedResource = {
  assignmentId: string | null
  resourceUserId: string
  label: string
}

type AvailableResource = {
  id: string
  label: string
}

type ScheduleDraft = {
  startDate: string
  startTime: string
  endDate: string
  endTime: string
}

type WeeklyTripSheetDrawerProps = {
  isOpen: boolean
  onClose: () => void
  tripSheet: {
    id: string
    tripSheetTitle: string
    parentTripTitle: string
    clientName: string
    parentTripStartDate: string | null
    parentTripEndDate: string | null
    startDate: string | null
    startTime: string | null
    endDate: string | null
    endTime: string | null
    assignedResources: AssignedResource[]
  } | null
  availableResources: AvailableResource[]
}

function normalizeAssignedResources(resources: AssignedResource[]): StagedAssignedResource[] {
  return resources.map((resource) => ({
    assignmentId: resource.assignmentId,
    resourceUserId: resource.resourceUserId,
    label: resource.label,
  }))
}

function haveSameResourceUserIds(
  left: StagedAssignedResource[],
  right: StagedAssignedResource[]
) {
  if (left.length !== right.length) {
    return false
  }

  const leftIds = new Set(left.map((resource) => resource.resourceUserId))

  if (leftIds.size !== right.length) {
    return false
  }

  return right.every((resource) => leftIds.has(resource.resourceUserId))
}

function buildScheduleDraft(
  tripSheet: WeeklyTripSheetDrawerProps['tripSheet']
): ScheduleDraft {
  return {
    startDate: tripSheet?.startDate ?? '',
    startTime: tripSheet?.startTime ?? '',
    endDate: tripSheet?.endDate ?? '',
    endTime: tripSheet?.endTime ?? '',
  }
}

function haveSameSchedule(left: ScheduleDraft, right: ScheduleDraft) {
  return (
    left.startDate === right.startDate &&
    left.startTime === right.startTime &&
    left.endDate === right.endDate &&
    left.endTime === right.endTime
  )
}

function parseScheduleDateParts(value: string) {
  const normalizedValue = value.trim()
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalizedValue)

  if (isoMatch) {
    return {
      year: Number(isoMatch[1]),
      month: Number(isoMatch[2]),
      day: Number(isoMatch[3]),
    }
  }

  const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(normalizedValue)

  if (slashMatch) {
    return {
      year: Number(slashMatch[3]),
      month: Number(slashMatch[2]),
      day: Number(slashMatch[1]),
    }
  }

  return null
}

function parseScheduleTimeParts(value: string) {
  const normalizedValue = value.trim()
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i.exec(normalizedValue)

  if (!match) {
    return null
  }

  let hours = Number(match[1])
  const minutes = Number(match[2])
  const meridiem = match[3]?.toUpperCase()

  if (meridiem) {
    if (hours < 1 || hours > 12) {
      return null
    }

    if (meridiem === 'AM') {
      hours = hours === 12 ? 0 : hours
    } else {
      hours = hours === 12 ? 12 : hours + 12
    }
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null
  }

  return { hours, minutes }
}

function parseScheduleDateTime(date: string, time: string) {
  const dateParts = parseScheduleDateParts(date)
  const timeParts = parseScheduleTimeParts(time)

  if (!dateParts || !timeParts) {
    return null
  }

  return new Date(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
    timeParts.hours,
    timeParts.minutes,
    0,
    0
  )
}

function validateScheduleDraft(
  draft: ScheduleDraft,
  parentTripStartDate: string | null,
  parentTripEndDate: string | null
) {
  if (!draft.startDate || !draft.startTime || !draft.endDate || !draft.endTime) {
    return 'Start date/time and end date/time are required.'
  }

  const startDateTime = parseScheduleDateTime(draft.startDate, draft.startTime)
  const endDateTime = parseScheduleDateTime(draft.endDate, draft.endTime)

  if (!startDateTime || !endDateTime || endDateTime <= startDateTime) {
    return 'End date/time must be after start date/time.'
  }

  if (
    parentTripStartDate &&
    parentTripEndDate &&
    (draft.startDate < parentTripStartDate || draft.endDate > parentTripEndDate)
  ) {
    return 'Trip Sheet schedule must stay within the parent Trip dates.'
  }

  return null
}

function splitResourceLabel(label: string) {
  const match = label.match(/^(.*)\s+\(([^)]+)\)$/)

  if (!match) {
    return {
      name: label,
      role: '',
    }
  }

  return {
    name: match[1]?.trim() || label,
    role: match[2]?.trim() || '',
  }
}

function ResourceLabel({
  name,
  role,
  nameClassName,
}: {
  name: string
  role: string
  nameClassName: string
}) {
  return (
    <>
      <span className={nameClassName}>{name}</span>
      {role ? <span className="trip-calendar-resource-role-text">({role})</span> : null}
    </>
  )
}

export default function WeeklyTripSheetDrawer({
  isOpen,
  onClose,
  tripSheet,
  availableResources,
}: WeeklyTripSheetDrawerProps) {
  const router = useRouter()
  const assignMenuRef = useRef<HTMLDivElement | null>(null)
  const [isAssignMenuOpen, setIsAssignMenuOpen] = useState(false)
  const initialAssignedResources = normalizeAssignedResources(
    tripSheet?.assignedResources ?? []
  )
  const [originalAssignedResources, setOriginalAssignedResources] = useState<
    StagedAssignedResource[]
  >(initialAssignedResources)
  const [stagedAssignedResources, setStagedAssignedResources] = useState<StagedAssignedResource[]>(
    initialAssignedResources
  )
  const initialScheduleDraft = buildScheduleDraft(tripSheet)
  const [originalScheduleDraft, setOriginalScheduleDraft] =
    useState<ScheduleDraft>(initialScheduleDraft)
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraft>(initialScheduleDraft)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSavePending, startSaveTransition] = useTransition()

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose, tripSheet?.id])

  useEffect(() => {
    if (!isAssignMenuOpen) {
      return
    }

    function handlePointerDown(event: MouseEvent) {
      if (!assignMenuRef.current?.contains(event.target as Node)) {
        setIsAssignMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [isAssignMenuOpen])

  if (!isOpen || !tripSheet) {
    return null
  }

  const activeTripSheet = tripSheet
  const activeTripSheetId = activeTripSheet.id
  const assignedResourceIds = new Set(
    stagedAssignedResources.map((resource) => resource.resourceUserId)
  )
  const assignableResources = availableResources.filter(
    (resource) => !assignedResourceIds.has(resource.id)
  )
  const isResourceDirty = !haveSameResourceUserIds(
    originalAssignedResources,
    stagedAssignedResources
  )
  const isScheduleDirty = !haveSameSchedule(originalScheduleDraft, scheduleDraft)
  const isDirty = isResourceDirty || isScheduleDirty

  function handleStageAssign(resource: AvailableResource) {
    setSaveError(null)
    setStagedAssignedResources((currentResources) => {
      if (currentResources.some((item) => item.resourceUserId === resource.id)) {
        return currentResources
      }

      return [
        ...currentResources,
        {
          assignmentId: null,
          resourceUserId: resource.id,
          label: resource.label,
        },
      ]
    })
  }

  function handleStageRemove(resourceUserId: string) {
    setSaveError(null)
    setStagedAssignedResources((currentResources) =>
      currentResources.filter((resource) => resource.resourceUserId !== resourceUserId)
    )
  }

  function handleScheduleChange(field: keyof ScheduleDraft, value: string) {
    setSaveError(null)
    setScheduleDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }))
  }

  function handleCancelChanges() {
    setSaveError(null)
    setScheduleDraft(originalScheduleDraft)
    setStagedAssignedResources(originalAssignedResources)
    setIsAssignMenuOpen(false)
    onClose()
  }

  function handleSaveChanges() {
    const parentTripStartDate = activeTripSheet.parentTripStartDate
    const parentTripEndDate = activeTripSheet.parentTripEndDate
    const validationError = validateScheduleDraft(
      scheduleDraft,
      parentTripStartDate,
      parentTripEndDate
    )

    if (validationError) {
      setSaveError(validationError)
      return
    }

    const nextOriginalResources = stagedAssignedResources.map((resource) => ({
      assignmentId: resource.assignmentId,
      resourceUserId: resource.resourceUserId,
      label: resource.label,
    }))

    startSaveTransition(async () => {
      setSaveError(null)

      if (isScheduleDirty) {
        const scheduleResult = await updateTripSheetSchedule({
          tripSheetId: activeTripSheetId,
          startDate: scheduleDraft.startDate,
          startTime: scheduleDraft.startTime,
          endDate: scheduleDraft.endDate,
          endTime: scheduleDraft.endTime,
        })

        if (!scheduleResult.ok) {
          setSaveError(scheduleResult.message)
          return
        }
      }

      if (isResourceDirty) {
        const assignmentResult = await replaceTripSheetAssignments(
          activeTripSheetId,
          nextOriginalResources.map((resource) => resource.resourceUserId)
        )

        if (!assignmentResult.ok) {
          setSaveError(assignmentResult.message)
          router.refresh()
          return
        }
      }

      setOriginalScheduleDraft(scheduleDraft)
      setOriginalAssignedResources(nextOriginalResources)
      setStagedAssignedResources(nextOriginalResources)
      setIsAssignMenuOpen(false)
      router.refresh()
    })
  }

  function handleOpenFullTripSheet() {
    if (isDirty && !window.confirm('You have unsaved changes. Continue without saving?')) {
      return
    }

    router.push(`/dashboard/trip-sheets/${activeTripSheetId}/edit`)
  }

  return (
    <>
      <div
        aria-hidden="true"
        className="trip-calendar-drawer-backdrop"
        role="presentation"
        onClick={onClose}
      />

      <aside
        className="trip-calendar-drawer"
        aria-label="Trip sheet details"
        aria-modal="true"
        role="dialog"
      >
        <div className="trip-calendar-drawer-header">
          <div className="trip-calendar-drawer-header-copy">
            <p className="trip-calendar-drawer-eyebrow">Trip sheet</p>
            <h2 className="trip-calendar-drawer-title">{tripSheet.tripSheetTitle}</h2>
            <p className="trip-calendar-drawer-subtitle">
              {tripSheet.clientName
                ? `${tripSheet.clientName} • ${tripSheet.parentTripTitle}`
                : tripSheet.parentTripTitle}
            </p>
          </div>

          <div className="trip-calendar-drawer-actions">
            <button
              type="button"
              className="trip-calendar-drawer-icon-button"
              aria-label="Open full Trip Sheet"
              title="Open full Trip Sheet"
              onClick={handleOpenFullTripSheet}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" className="trip-calendar-drawer-icon">
                <path
                  d="M13.9 3.8a1.5 1.5 0 0 1 2.1 0l.2.2a1.5 1.5 0 0 1 0 2.1l-8.6 8.6-3.1.8.8-3.1z"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.6"
                />
                <path
                  d="M11.8 5.9l2.3 2.3"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.6"
                />
              </svg>
            </button>

            <button
              type="button"
              className="trip-calendar-drawer-icon-button"
              aria-label="Close drawer"
              onClick={onClose}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" className="trip-calendar-drawer-icon">
                <path
                  d="M5 5l10 10M15 5 5 15"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="trip-calendar-drawer-section">
          <div className="trip-calendar-drawer-section-header">
            <h3 className="trip-calendar-drawer-section-title">Schedule</h3>
          </div>

          <div className="trip-calendar-drawer-schedule-grid">
            <div>
              <label htmlFor="calendar-drawer-start-date" className="ui-label">
                Start Date
              </label>
              <input
                id="calendar-drawer-start-date"
                type="date"
                value={scheduleDraft.startDate}
                min={tripSheet.parentTripStartDate ?? undefined}
                max={tripSheet.parentTripEndDate ?? undefined}
                disabled={isSavePending}
                onChange={(event) => handleScheduleChange('startDate', event.target.value)}
                className="ui-input ui-input-compact"
              />
            </div>

            <div>
              <label htmlFor="calendar-drawer-start-time" className="ui-label">
                Start Time
              </label>
              <input
                id="calendar-drawer-start-time"
                type="time"
                value={scheduleDraft.startTime}
                disabled={isSavePending}
                onChange={(event) => handleScheduleChange('startTime', event.target.value)}
                className="ui-input ui-input-compact"
              />
            </div>

            <div>
              <label htmlFor="calendar-drawer-end-date" className="ui-label">
                End Date
              </label>
              <input
                id="calendar-drawer-end-date"
                type="date"
                value={scheduleDraft.endDate}
                min={tripSheet.parentTripStartDate ?? undefined}
                max={tripSheet.parentTripEndDate ?? undefined}
                disabled={isSavePending}
                onChange={(event) => handleScheduleChange('endDate', event.target.value)}
                className="ui-input ui-input-compact"
              />
            </div>

            <div>
              <label htmlFor="calendar-drawer-end-time" className="ui-label">
                End Time
              </label>
              <input
                id="calendar-drawer-end-time"
                type="time"
                value={scheduleDraft.endTime}
                disabled={isSavePending}
                onChange={(event) => handleScheduleChange('endTime', event.target.value)}
                className="ui-input ui-input-compact"
              />
            </div>
          </div>
        </div>

        <div className="trip-calendar-drawer-section trip-calendar-drawer-section-scroll">
          <div className="trip-calendar-drawer-section-header">
            <h3 className="trip-calendar-drawer-section-title">Resources</h3>
          </div>

          <div className="trip-calendar-drawer-resource-toolbar">
            {stagedAssignedResources.length > 0 ? (
              <div className="trip-calendar-drawer-chip-list">
                {stagedAssignedResources.map((resource) => {
                  const parsedResource = splitResourceLabel(resource.label)

                  return (
                    <div
                      key={resource.resourceUserId}
                      className="trip-calendar-drawer-chip-form"
                    >
                      <div className="trip-calendar-drawer-chip">
                        <span className="trip-calendar-drawer-chip-copy">
                          <ResourceLabel
                            name={parsedResource.name}
                            role={parsedResource.role}
                            nameClassName="trip-calendar-drawer-chip-name"
                          />
                        </span>
                        <button
                          type="button"
                          className="trip-calendar-drawer-chip-remove"
                          aria-label={`Remove ${resource.label}`}
                          disabled={isSavePending}
                          aria-disabled={isSavePending}
                          onClick={() => handleStageRemove(resource.resourceUserId)}
                        >
                          <svg
                            viewBox="0 0 20 20"
                            aria-hidden="true"
                            className="trip-calendar-drawer-chip-remove-icon"
                          >
                            <path
                              d="M5 5l10 10M15 5 5 15"
                              fill="none"
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="1.7"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="trip-calendar-drawer-empty-copy">Unassigned</p>
            )}

            <div ref={assignMenuRef} className="trip-calendar-drawer-add-resource">
              <button
                type="button"
                className="trip-calendar-drawer-add-button"
                onClick={() => setIsAssignMenuOpen((currentValue) => !currentValue)}
                aria-expanded={isAssignMenuOpen}
                aria-haspopup="menu"
                disabled={assignableResources.length === 0 || isSavePending}
              >
                <span className="trip-calendar-drawer-add-button-plus" aria-hidden="true">
                  +
                </span>
                <span>Add resource</span>
                <span
                  className={`trip-calendar-drawer-add-button-caret${
                    isAssignMenuOpen ? ' trip-calendar-drawer-add-button-caret--open' : ''
                  }`}
                  aria-hidden="true"
                >
                  ▾
                </span>
              </button>

              {isAssignMenuOpen ? (
                <div className="trip-calendar-drawer-add-menu" role="menu">
                  {assignableResources.length > 0 ? (
                    <div className="trip-calendar-drawer-add-menu-list">
                      {assignableResources.map((resource) => {
                        const parsedResource = splitResourceLabel(resource.label)

                        return (
                          <div
                            key={resource.id}
                            className="trip-calendar-drawer-resource-form"
                          >
                            <button
                              type="button"
                              className="trip-calendar-drawer-add-option"
                              role="menuitem"
                              disabled={isSavePending}
                              aria-disabled={isSavePending}
                              onClick={() => handleStageAssign(resource)}
                            >
                              <span className="trip-calendar-drawer-add-option-copy">
                                <ResourceLabel
                                  name={parsedResource.name}
                                  role={parsedResource.role}
                                  nameClassName="trip-calendar-drawer-add-option-name"
                                />
                              </span>
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="trip-calendar-drawer-add-empty">
                      No more active resources available.
                    </p>
                  )}
                </div>
              ) : null}

            </div>
          </div>
        </div>

        <div className="trip-calendar-drawer-footer">
          {saveError ? (
            <p className="trip-calendar-drawer-inline-error" role="alert">
              {saveError}
            </p>
          ) : null}

          <div className="trip-calendar-drawer-footer-actions">
            <button
              type="button"
              className="ui-button ui-button-secondary ui-button-compact"
              onClick={handleCancelChanges}
              disabled={isSavePending}
            >
              Cancel
            </button>
            <button
              type="button"
              className="ui-button ui-button-primary ui-button-compact"
              onClick={handleSaveChanges}
              disabled={isSavePending || !isDirty}
              aria-disabled={isSavePending || !isDirty}
            >
              {isSavePending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
