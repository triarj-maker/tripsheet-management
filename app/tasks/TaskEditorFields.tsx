'use client'

import { useMemo, useState } from 'react'

import type { TaskListItem } from '@/lib/trip-tasks'

import type { TaskAssignee, TaskTrip, TaskTripSheet } from './types'

function toLocalInput(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`
}

export default function TaskEditorFields({
  task,
  trips,
  tripSheets,
  assignees,
  lockedTripId,
}: {
  task?: TaskListItem | null
  trips: TaskTrip[]
  tripSheets: TaskTripSheet[]
  assignees: TaskAssignee[]
  lockedTripId?: string
}) {
  const [tripId, setTripId] = useState(lockedTripId ?? task?.trip_id ?? trips[0]?.id ?? '')
  const [dueLocal, setDueLocal] = useState(task?.due_at ? toLocalInput(task.due_at) : '')
  const eligibleSheets = useMemo(
    () => tripSheets.filter((sheet) => sheet.trip_id === tripId),
    [tripId, tripSheets]
  )
  const dueAt = dueLocal ? new Date(`${dueLocal}:00+05:30`).toISOString() : ''

  return (
    <div className="space-y-4">
      <input type="hidden" name="id" value={task?.id ?? ''} />
      <input type="hidden" name="due_at" value={dueAt} />
      <div>
        <label className="ui-label" htmlFor="task-title">Title</label>
        <input id="task-title" name="title" className="ui-input" maxLength={200} required defaultValue={task?.title ?? ''} />
      </div>
      <div>
        <label className="ui-label" htmlFor="task-description">Description</label>
        <textarea id="task-description" name="description" className="ui-textarea min-h-28" maxLength={10000} defaultValue={task?.description ?? ''} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="ui-label" htmlFor="task-trip">Trip</label>
          {lockedTripId ? <input type="hidden" name="trip_id" value={lockedTripId} /> : null}
          <select id="task-trip" name={lockedTripId ? undefined : 'trip_id'} className="ui-select" value={tripId} disabled={Boolean(lockedTripId)} onChange={(event) => setTripId(event.target.value)} required>
            <option value="">Select Trip</option>
            {trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.title?.trim() || 'Untitled trip'}</option>)}
          </select>
        </div>
        <div>
          <label className="ui-label" htmlFor="task-sheet">Trip Sheet</label>
          <select id="task-sheet" name="trip_sheet_id" className="ui-select" defaultValue={task?.trip_sheet_id ?? ''} key={`${tripId}:${task?.trip_sheet_id ?? ''}`}>
            <option value="">No Trip Sheet</option>
            {eligibleSheets.map((sheet) => <option key={sheet.id} value={sheet.id}>{sheet.title?.trim() || 'Untitled trip sheet'}</option>)}
          </select>
        </div>
        <div>
          <label className="ui-label" htmlFor="task-assignee">Assigned to</label>
          <select id="task-assignee" name="assigned_to" className="ui-select" defaultValue={task?.assigned_to ?? ''}>
            <option value="">Unassigned</option>
            {assignees.map((person) => <option key={person.id} value={person.id}>{person.full_name?.trim() || person.email?.trim() || person.id}</option>)}
          </select>
        </div>
        <div>
          <label className="ui-label" htmlFor="task-due">Due date and time (IST)</label>
          <input id="task-due" type="datetime-local" className="ui-input" value={dueLocal} onChange={(event) => setDueLocal(event.target.value)} />
        </div>
      </div>
      <div>
        <label className="ui-label" htmlFor="task-status">Status</label>
        <select id="task-status" name="status" className="ui-select" defaultValue={task?.status ?? 'pending'}>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
        </select>
      </div>
    </div>
  )
}
