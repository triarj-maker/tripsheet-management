'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

import ActionSubmitButton from '@/app/components/ActionSubmitButton'

import { bulkAssignTripSheets } from '../actions'

type BulkAssignableResource = {
  id: string
  label: string
}

type BulkTripSheetAssignmentFormProps = {
  tripId: string
  returnPath: string
  availableResources: BulkAssignableResource[]
  tripSheetCount: number
  children: ReactNode
}

export default function BulkTripSheetAssignmentForm({
  tripId,
  returnPath,
  availableResources,
  tripSheetCount,
  children,
}: BulkTripSheetAssignmentFormProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [selectedTripSheetIds, setSelectedTripSheetIds] = useState<string[]>([])
  const selectedCount = selectedTripSheetIds.length

  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    function getRowCheckboxes() {
      return Array.from(
        container?.querySelectorAll<HTMLInputElement>('input[data-bulk-row="true"]') ?? []
      )
    }

    function getSelectAllCheckbox() {
      return container?.querySelector<HTMLInputElement>('input[data-bulk-select-all="true"]') ?? null
    }

    function syncSelectionState() {
      const rowCheckboxes = getRowCheckboxes()
      const selectedIds = rowCheckboxes
        .filter((checkbox) => checkbox.checked)
        .map((checkbox) => checkbox.value)
      const selectAllCheckbox = getSelectAllCheckbox()

      if (selectAllCheckbox && rowCheckboxes.length > 0) {
        selectAllCheckbox.checked =
          selectedIds.length > 0 && selectedIds.length === rowCheckboxes.length
        selectAllCheckbox.indeterminate =
          selectedIds.length > 0 && selectedIds.length < rowCheckboxes.length
      }

      setSelectedTripSheetIds(selectedIds)
    }

    function handleChange(event: Event) {
      const target = event.target as HTMLInputElement | null

      if (target?.dataset.bulkSelectAll === 'true') {
        for (const checkbox of getRowCheckboxes()) {
          checkbox.checked = target.checked
        }
      }

      syncSelectionState()
    }

    container.addEventListener('change', handleChange)
    syncSelectionState()

    return () => {
      container.removeEventListener('change', handleChange)
    }
  }, [])

  function handleBulkSubmit(event: React.FormEvent<HTMLFormElement>) {
    const nativeEvent = event.nativeEvent as SubmitEvent
    const submitter = nativeEvent.submitter as HTMLButtonElement | null

    if (submitter?.value !== 'clear_selected') {
      return
    }

    if (
      !window.confirm(
        `Clear all assignments from ${selectedCount} selected trip sheet${
          selectedCount === 1 ? '' : 's'
        }?`
      )
    ) {
      event.preventDefault()
    }
  }

  return (
    <div ref={containerRef} className="space-y-3">
      <form
        action={bulkAssignTripSheets}
        onSubmit={handleBulkSubmit}
        className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3"
      >
        <input type="hidden" name="trip_id" value={tripId} />
        <input type="hidden" name="return_path" value={returnPath} />
        {selectedTripSheetIds.map((tripSheetId) => (
          <input
            key={tripSheetId}
            type="hidden"
            name="selected_trip_sheet_ids"
            value={tripSheetId}
          />
        ))}

        <div className="grid gap-3 lg:grid-cols-[minmax(14rem,1fr)_auto_auto_auto] lg:items-end">
          <div>
            <label htmlFor="bulk_resource_user_id" className="ui-label">
              Bulk Assign Resource
            </label>
            <select
              id="bulk_resource_user_id"
              name="resource_user_id"
              className="ui-select ui-select-compact"
              required
            >
              <option value="">Select a resource</option>
              {availableResources.map((resource) => (
                <option key={resource.id} value={resource.id}>
                  {resource.label}
                </option>
              ))}
            </select>
          </div>

          <label className="flex min-h-9 items-center gap-2 text-sm font-medium text-gray-700">
            <input type="checkbox" name="replace_existing" value="true" />
            <span>Replace existing assignments</span>
          </label>

          <ActionSubmitButton
            name="bulk_action"
            value="selected"
            idleLabel={`Assign to Selected${selectedCount > 0 ? ` (${selectedCount})` : ''}`}
            pendingLabel="Assigning..."
            className="ui-button-secondary ui-button-compact"
            disabled={selectedCount === 0}
          />

          <ActionSubmitButton
            name="bulk_action"
            value="all_unassigned"
            idleLabel="Assign to All Unassigned"
            pendingLabel="Assigning..."
            className="ui-button-primary ui-button-compact"
            disabled={tripSheetCount === 0}
          />
        </div>
        <div className="mt-3 border-t border-zinc-200 pt-3">
          <ActionSubmitButton
            name="bulk_action"
            value="clear_selected"
            idleLabel="Clear Selected Assignments"
            pendingLabel="Clearing..."
            className="ui-button-danger ui-button-compact"
            disabled={selectedCount === 0}
          />
        </div>
      </form>

      {children}
    </div>
  )
}
