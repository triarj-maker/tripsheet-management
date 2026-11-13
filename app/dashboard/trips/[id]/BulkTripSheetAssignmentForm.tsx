'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { unstable_rethrow, useRouter } from 'next/navigation'
import ActionSubmitButton from '@/app/components/ActionSubmitButton'
import GroupedTripSheets from './GroupedTripSheets'
import { submitBulkTripSheetAssignments } from './bulk-assignment-submit'
import { filterOperationalTripSheets, matchingTripSheetSelection, updateTripSheetSelection, type OperationalTripSheet } from './trip-detail-presentation'

type BulkTripSheetAssignmentFormProps = {
  tripId: string
  returnPath: string
  availableResources: Array<{ id: string; label: string }>
  tripSheets: OperationalTripSheet[]
}

export default function BulkTripSheetAssignmentForm({ tripId, returnPath, availableResources, tripSheets }: BulkTripSheetAssignmentFormProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set())
  const [resourceId, setResourceId] = useState('')
  const [replaceExisting, setReplaceExisting] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = useRef(false)
  const selectAll = useRef<HTMLInputElement>(null)
  const matching = filterOperationalTripSheets(tripSheets, search)
  const matchingIds = matching.map(sheet => sheet.id)
  const selectionState = matchingTripSheetSelection(selected, matchingIds)
  const unassignedCount = tripSheets.filter(sheet => !sheet.assignedUsers.length).length
  const scheduledDays = new Set(tripSheets.map(sheet => sheet.start_date).filter(Boolean)).size
  const hiddenSelectedCount = [...selected].filter(id => !matchingIds.includes(id)).length
  const selectedCountLabel = `${selected.size} selected${hiddenSelectedCount ? ` (${hiddenSelectedCount} outside this search)` : ''}`

  useEffect(() => {
    if (selectAll.current) selectAll.current.indeterminate = selectionState.indeterminate
  }, [selectionState.indeterminate])

  async function submit(formData: FormData) {
    if (busy.current) return
    busy.current = true
    setPending(true)
    setError(null)
    try {
      const result = await submitBulkTripSheetAssignments(formData)
      if (!result.ok) {
        setError(result.error ?? 'Assignments could not be saved.')
        router.refresh() // Also reflects any partial writes made by the existing action.
        return
      }
      setSelected(new Set())
      setReplaceExisting(false)
      setResourceId('')
      if (`${window.location.pathname}${window.location.search}` === result.redirectTo) router.refresh()
      else router.push(result.redirectTo)
    } catch (caught) {
      unstable_rethrow(caught) // Preserve authentication/framework redirects.
      setError('Assignments could not be saved. Please try again.')
      router.refresh()
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  function confirmClear(event: React.FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    if (submitter?.value === 'clear_selected' && !window.confirm(`Clear all assignments from ${selected.size} selected trip sheet${selected.size === 1 ? '' : 's'}?`)) event.preventDefault()
  }

  function resourceOptions() {
    return <><option value="">Select a resource</option>{availableResources.map(resource => <option key={resource.id} value={resource.id}>{resource.label}</option>)}</>
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Trip Sheets</h2>
          <p className="text-sm text-gray-600">{tripSheets.length} Trip Sheets · {scheduledDays} scheduled days · {unassignedCount} unassigned</p>
        </div>
        <Link href={`/dashboard/trip-sheets/new?tripId=${tripId}`} className="ui-button ui-button-primary ui-button-compact">Add Trip Sheet</Link>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full sm:max-w-md">
          <label htmlFor="trip-sheet-search" className="ui-label-compact">Search activities or assigned users</label>
          <div className="flex gap-2">
            <input id="trip-sheet-search" type="search" value={search} onChange={event => setSearch(event.target.value)} className="ui-input ui-input-compact" placeholder="Activity or assigned name…" />
            {search ? <button type="button" className="ui-button ui-button-secondary ui-button-compact" onClick={() => setSearch('')}>Clear search</button> : null}
          </div>
        </div>
        {search.trim() ? <p className="text-sm text-gray-600" role="status">{matching.length} matching Trip Sheets</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2 font-medium">
          <input ref={selectAll} type="checkbox" checked={selectionState.checked} disabled={pending || !matchingIds.length}
            aria-label="Select all matching Trip Sheets" className="h-4 w-4 rounded border-zinc-300"
            onChange={event => { const checked = event.currentTarget.checked; setSelected(previous => updateTripSheetSelection(previous, matchingIds, checked)) }} />
          Select all matching ({matching.length})
        </label>
        {selectionState.checked || selectionState.indeterminate ? <button type="button" disabled={pending} className="ui-button ui-button-secondary ui-button-compact" onClick={() => setSelected(previous => updateTripSheetSelection(previous, matchingIds, false))}>Clear Matching Selection</button> : null}
      </div>
      {error ? <p role="alert" className="app-banner-error">{error}</p> : null}
      {selected.size > 0 ? (
        <form action={submit} onSubmit={confirmClear} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <input type="hidden" name="trip_id" value={tripId} /><input type="hidden" name="return_path" value={returnPath} />
          {[...selected].map(id => <input key={id} type="hidden" name="selected_trip_sheet_ids" value={id} />)}
          <fieldset disabled={pending} className="flex flex-wrap items-end gap-3">
            <legend className="mb-2 text-sm font-semibold" aria-live="polite">{selectedCountLabel}</legend>
            <div className="w-full sm:w-auto sm:min-w-56">
              <label htmlFor="bulk_resource_user_id" className="ui-label-compact">Resource</label>
              <select id="bulk_resource_user_id" name="resource_user_id" value={resourceId} onChange={event => setResourceId(event.target.value)} className="ui-select ui-select-compact">{resourceOptions()}</select>
            </div>
            <label className="flex min-h-9 items-center gap-2 text-sm"><input type="checkbox" name="replace_existing" value="true" checked={replaceExisting} onChange={event => setReplaceExisting(event.target.checked)} />Replace existing assignments</label>
            <ActionSubmitButton name="action_type" value="assign_selected" idleLabel="Assign to Selected" pendingLabel="Assigning…" className="ui-button-primary ui-button-compact" />
            <ActionSubmitButton name="action_type" value="clear_selected" idleLabel="Clear Selected Assignments" pendingLabel="Clearing…" className="ui-button-danger ui-button-compact" />
            <button type="button" className="ui-button ui-button-secondary ui-button-compact" aria-label="Clear all selection" onClick={() => setSelected(new Set())}>Clear Selection</button>
          </fieldset>
        </form>
      ) : null}
      <GroupedTripSheets trip={{ id: tripId }} tripSheets={matching} selectedIds={selected} pending={pending}
        onSelect={(id, checked) => setSelected(previous => updateTripSheetSelection(previous, [id], checked))}
        collapsedDays={collapsedDays} onDayToggle={(day, open) => setCollapsedDays(previous => {
          if (previous.has(day) === !open) return previous
          const next = new Set(previous)
          if (open) next.delete(day); else next.add(day)
          return next
        })} />
    </div>
  )
}
