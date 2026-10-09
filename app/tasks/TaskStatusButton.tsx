'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

import type { TaskStatus } from '@/lib/trip-tasks'

import { setTripTaskStatus } from './actions'

export default function TaskStatusButton({ taskId, status }: { taskId: string; status: TaskStatus }) {
  const router = useRouter()
  const [currentStatus, setCurrentStatus] = useState(status)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const savingRef = useRef(false)

  async function toggleStatus() {
    if (savingRef.current) return
    const previousStatus = currentStatus
    const nextStatus: TaskStatus = currentStatus === 'completed' ? 'pending' : 'completed'
    savingRef.current = true
    setSaving(true)
    setError(null)
    setCurrentStatus(nextStatus)
    const formData = new FormData()
    formData.set('id', taskId)
    formData.set('status', nextStatus)

    try {
      const result = await setTripTaskStatus(formData)
      if (!result.ok) {
        setCurrentStatus(previousStatus)
        setError(result.error ?? 'Task status could not be updated.')
      } else {
        router.refresh()
      }
    } catch {
      setCurrentStatus(previousStatus)
      setError('Task status could not be updated. Please try again.')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={toggleStatus} disabled={saving} className="ui-button ui-button-secondary">
        {saving ? 'Saving…' : currentStatus === 'completed' ? 'Reopen task' : 'Mark complete'}
      </button>
      {error ? <span className="max-w-64 text-right text-xs text-red-700" role="alert">{error}</span> : null}
    </div>
  )
}
