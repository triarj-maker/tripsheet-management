'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'

import { replaceTripSheetAssignments } from '@/app/dashboard/trip-sheets/actions'

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

type WeeklyTripSheetDrawerProps = {
  isOpen: boolean
  onClose: () => void
  tripSheet: {
    id: string
    tripSheetTitle: string
    parentTripTitle: string
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

function formatDate(value: string | null) {
  if (!value) {
    return 'TBD'
  }

  const [yearText, monthText, dayText] = value.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)

  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return value
  }

  const date = new Date(year, month - 1, day)

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatTime(value: string | null) {
  if (!value) {
    return 'Time TBD'
  }

  const [hoursText, minutesText] = value.split(':')
  const hours = Number(hoursText)
  const minutes = Number(minutesText)

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return value
  }

  const date = new Date()
  date.setHours(hours, minutes, 0, 0)

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

function formatDateTime(date: string | null, time: string | null) {
  const formattedDate = formatDate(date)
  const formattedTime = formatTime(time)

  if (!date && !time) {
    return 'TBD'
  }

  if (!date) {
    return formattedTime
  }

  if (!time) {
    return formattedDate
  }

  return `${formattedDate}, ${formattedTime}`
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

  const activeTripSheetId = tripSheet.id
  const assignedResourceIds = new Set(
    stagedAssignedResources.map((resource) => resource.resourceUserId)
  )
  const assignableResources = availableResources.filter(
    (resource) => !assignedResourceIds.has(resource.id)
  )
  const isDirty = !haveSameResourceUserIds(
    originalAssignedResources,
    stagedAssignedResources
  )

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

  function handleCancelChanges() {
    setSaveError(null)
    setStagedAssignedResources(originalAssignedResources)
    setIsAssignMenuOpen(false)
  }

  function handleSaveChanges() {
    const nextOriginalResources = stagedAssignedResources.map((resource) => ({
      assignmentId: resource.assignmentId,
      resourceUserId: resource.resourceUserId,
      label: resource.label,
    }))

    startSaveTransition(async () => {
      setSaveError(null)

      const result = await replaceTripSheetAssignments(
        activeTripSheetId,
        nextOriginalResources.map((resource) => resource.resourceUserId)
      )

      if (!result.ok) {
        setSaveError(result.message)
        return
      }

      setOriginalAssignedResources(nextOriginalResources)
      setStagedAssignedResources(nextOriginalResources)
      setIsAssignMenuOpen(false)
      router.refresh()
    })
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
            <p className="trip-calendar-drawer-subtitle">{tripSheet.parentTripTitle}</p>
          </div>

          <div className="trip-calendar-drawer-actions">
            <button
              type="button"
              className="trip-calendar-drawer-icon-button"
              aria-label="Edit trip sheet"
              onClick={() => router.push(`/dashboard/trip-sheets/${tripSheet.id}/edit`)}
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
          <div className="trip-calendar-drawer-meta-grid">
            <div className="trip-calendar-drawer-meta-item">
              <p className="trip-calendar-drawer-meta-label">Start</p>
              <p className="trip-calendar-drawer-meta-value">
                {formatDateTime(tripSheet.startDate, tripSheet.startTime)}
              </p>
            </div>

            <div className="trip-calendar-drawer-meta-item">
              <p className="trip-calendar-drawer-meta-label">End</p>
              <p className="trip-calendar-drawer-meta-value">
                {formatDateTime(tripSheet.endDate, tripSheet.endTime)}
              </p>
            </div>
          </div>
        </div>

        <div className="trip-calendar-drawer-section">
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

              {isDirty ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-amber-900">
                      You have unsaved resource changes.
                    </p>
                    <div className="flex items-center gap-2">
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
                  {saveError ? (
                    <p className="mt-2 text-xs font-medium text-red-700" role="alert">
                      {saveError}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
