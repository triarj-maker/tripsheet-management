'use client'

import { useEffect, useRef, useState } from 'react'

import {
  assignResourceToTripSheet,
  removeResourceFromTripSheet,
} from '@/app/dashboard/trip-sheets/actions'

type AssignedResource = {
  assignmentId: string
  label: string
}

type AvailableResource = {
  id: string
  label: string
}

type TripSheetAssignmentPopoverProps = {
  tripSheetId: string
  assignedResources: AssignedResource[]
  availableResources: AvailableResource[]
  returnPath: string
}

function formatAssignmentSummary(assignedResources: AssignedResource[]) {
  if (assignedResources.length === 0) {
    return 'Unassigned'
  }

  if (assignedResources.length === 1) {
    return assignedResources[0]?.label ?? 'Assigned'
  }

  const firstLabel = assignedResources[0]?.label ?? 'Assigned'

  return `${firstLabel} +${assignedResources.length - 1}`
}

export default function TripSheetAssignmentPopover({
  tripSheetId,
  assignedResources,
  availableResources,
  returnPath,
}: TripSheetAssignmentPopoverProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const summary = formatAssignmentSummary(assignedResources)
  const summaryTitle =
    assignedResources.length > 0
      ? assignedResources.map((resource) => resource.label).join(', ')
      : 'Unassigned'

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div ref={containerRef} className="relative inline-block min-w-0">
      <button
        type="button"
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        aria-expanded={isOpen}
        className={`flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-sm font-medium transition hover:bg-zinc-100 ${
          assignedResources.length === 0 ? 'text-red-600' : 'text-gray-900'
        }`}
        title={summaryTitle}
      >
        <span className="max-w-[11rem] truncate">{summary}</span>
        <span className={`text-[10px] text-gray-500 transition ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {isOpen ? (
        <div className="absolute left-0 top-full z-20 mt-2 w-72 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg">
          {assignedResources.length > 0 ? (
            <div className="border-b border-zinc-100 pb-2">
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Current
              </p>
              <div className="space-y-1">
                {assignedResources.map((resource) => (
                  <form
                    key={resource.assignmentId}
                    action={removeResourceFromTripSheet}
                  >
                    <input type="hidden" name="trip_sheet_id" value={tripSheetId} />
                    <input
                      type="hidden"
                      name="assignment_id"
                      value={resource.assignmentId}
                    />
                    <input type="hidden" name="return_path" value={returnPath} />
                    <button
                      type="submit"
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm text-gray-700 transition hover:bg-zinc-100"
                    >
                      <span className="truncate">{resource.label}</span>
                      <span className="text-xs text-red-600">Remove</span>
                    </button>
                  </form>
                ))}
              </div>
            </div>
          ) : null}

          <div className={assignedResources.length > 0 ? 'pt-2' : ''}>
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              {assignedResources.length === 0 ? 'Assign' : 'Assign Another'}
            </p>

            {availableResources.length > 0 ? (
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {availableResources.map((resource) => (
                  <form
                    key={resource.id}
                    action={assignResourceToTripSheet}
                  >
                    <input type="hidden" name="trip_sheet_id" value={tripSheetId} />
                    <input type="hidden" name="resource_user_id" value={resource.id} />
                    <input type="hidden" name="return_path" value={returnPath} />
                    <button
                      type="submit"
                      className="block w-full rounded-lg px-2 py-1.5 text-left text-sm text-gray-700 transition hover:bg-zinc-100"
                    >
                      {resource.label}
                    </button>
                  </form>
                ))}
              </div>
            ) : (
              <p className="px-2 py-1.5 text-sm text-gray-500">
                No more active resources available.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
