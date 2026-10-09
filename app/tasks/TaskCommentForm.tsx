'use client'

import { useActionState, useEffect, useRef } from 'react'

import { addTripTaskComment, type CommentState } from './actions'

const initialState: CommentState = { error: null, success: 0 }

export default function TaskCommentForm({ taskId }: { taskId: string }) {
  const [state, action, pending] = useActionState(addTripTaskComment, initialState)
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => { if (state.success) formRef.current?.reset() }, [state.success])
  return (
    <form ref={formRef} action={action} className="space-y-2">
      <input type="hidden" name="task_id" value={taskId} />
      <label className="ui-label" htmlFor="task-comment">Add comment</label>
      <textarea id="task-comment" name="body" className="ui-textarea min-h-24" maxLength={4000} required placeholder="Add context or an update…" />
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      <button className="ui-button ui-button-primary" disabled={pending}>{pending ? 'Adding…' : 'Add comment'}</button>
    </form>
  )
}
