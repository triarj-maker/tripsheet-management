'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'

import { formatTaskDue, relationOne, type TaskListItem } from '@/lib/trip-tasks'

import { setTripTaskStatus } from './actions'
import TaskStatusBadge from './TaskStatusBadge'

function label(
  value: { full_name?: string | null; email?: string | null; title?: string | null } | null,
  fallback: string
) {
  return value?.full_name?.trim() || value?.email?.trim() || value?.title?.trim() || fallback
}

export default function TaskTableRow({ task, detailHref }: { task: TaskListItem; detailHref: string }) {
  const [completed, setCompleted] = useState(task.status === 'completed')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const savingRef = useRef(false)

  async function updateCompletion(nextCompleted: boolean) {
    if (savingRef.current) return
    const previousCompleted = completed
    savingRef.current = true
    setSaving(true)
    setError(null)
    setCompleted(nextCompleted)

    const formData = new FormData()
    formData.set('id', task.id)
    formData.set('status', nextCompleted ? 'completed' : 'pending')
    formData.set('inline', 'true')

    try {
      const result = await setTripTaskStatus(formData)
      if (!result.ok) {
        setCompleted(previousCompleted)
        setError(result.error ?? 'Task status could not be updated.')
      }
    } catch {
      setCompleted(previousCompleted)
      setError('Task status could not be updated. Please try again.')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <tr>
      <td className="w-14">
        <label className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg hover:bg-zinc-100">
          <span className="sr-only">Complete task: {task.title}</span>
          <input
            type="checkbox"
            checked={completed}
            disabled={saving}
            onChange={(event) => updateCompletion(event.currentTarget.checked)}
            className="h-5 w-5 rounded border-zinc-300 accent-gray-900"
          />
        </label>
      </td>
      <td>
        <Link href={detailHref} className="font-semibold text-gray-900 underline decoration-transparent underline-offset-2 hover:decoration-zinc-400">
          {task.title}
        </Link>
      </td>
      <td>
        <Link href={`/dashboard/trips/${task.trip_id}`} className="font-medium text-gray-900 underline decoration-transparent underline-offset-2 hover:decoration-zinc-400">
          {label(relationOne(task.trip), 'Untitled trip')}
        </Link>
        {relationOne(task.trip_sheet) ? (
          <p className="mt-1 text-xs">
            <Link href={`/dashboard/trip-sheets/${task.trip_sheet_id}/edit`} className="text-gray-500 underline decoration-transparent underline-offset-2 hover:decoration-zinc-400">
              {label(relationOne(task.trip_sheet), 'Untitled trip sheet')}
            </Link>
          </p>
        ) : null}
      </td>
      <td>{label(relationOne(task.assignee), 'Unassigned')}</td>
      <td className="whitespace-nowrap">{formatTaskDue(task.due_at)}</td>
      <td>
        <div className="flex min-w-28 flex-col items-start gap-1">
          <TaskStatusBadge task={{ status: completed ? 'completed' : 'pending', due_at: task.due_at }} />
          {saving ? <span className="text-xs text-gray-500" aria-live="polite">Saving…</span> : null}
          {error ? <span className="max-w-52 text-xs text-red-700" role="alert">{error}</span> : null}
        </div>
      </td>
    </tr>
  )
}
