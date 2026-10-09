import Link from 'next/link'

import { formatTaskDue, relationOne, type TaskListItem } from '@/lib/trip-tasks'

import { deleteTripTask, saveTripTask } from './actions'
import TaskCommentForm from './TaskCommentForm'
import TaskEditorFields from './TaskEditorFields'
import TaskStatusBadge from './TaskStatusBadge'
import TaskStatusButton from './TaskStatusButton'
import type { TaskAssignee, TaskComment, TaskTrip, TaskTripSheet } from './types'

function personLabel(person: { full_name: string | null; email: string | null } | null, fallback = 'Unassigned') {
  return person?.full_name?.trim() || person?.email?.trim() || fallback
}

export default function TaskDetailPanel({
  task,
  comments,
  trips,
  tripSheets,
  assignees,
  isAdmin,
  returnTo,
  closeHref,
  lockedTripId,
}: {
  task?: TaskListItem | null
  comments: TaskComment[]
  trips: TaskTrip[]
  tripSheets: TaskTripSheet[]
  assignees: TaskAssignee[]
  isAdmin: boolean
  returnTo: string
  closeHref: string
  lockedTripId?: string
}) {
  const trip = task ? relationOne(task.trip) : null
  const sheet = task ? relationOne(task.trip_sheet) : null
  const assignee = task ? relationOne(task.assignee) : null
  const isNew = !task

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label={isNew ? 'Create task' : `Task: ${task.title}`}>
      <Link href={closeHref} aria-label="Close task details" className="absolute inset-0 bg-gray-950/30" />
      <aside className="relative z-10 h-full w-full overflow-y-auto bg-white shadow-2xl md:max-w-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 sm:px-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{isNew ? 'New task' : 'Task details'}</p>
            <h2 className="text-lg font-semibold text-gray-900">{isNew ? 'Create task' : task.title}</h2>
          </div>
          <Link href={closeHref} className="ui-button ui-button-secondary" aria-label="Close task details">Close</Link>
        </div>

        <div className="space-y-6 p-4 sm:p-6">
          {isAdmin ? (
            <form action={saveTripTask} className="space-y-5">
              <input type="hidden" name="return_to" value={returnTo} />
              <TaskEditorFields key={task ? `${task.id}:${task.status}` : 'new'} task={task} trips={trips} tripSheets={tripSheets} assignees={assignees} lockedTripId={lockedTripId} />
              <div className="flex flex-wrap gap-2">
                <button className="ui-button ui-button-primary">{isNew ? 'Create task' : 'Save changes'}</button>
                <Link href={closeHref} className="ui-button ui-button-secondary">Cancel</Link>
              </div>
            </form>
          ) : task ? (
            <section className="space-y-4">
              <div className="flex items-center gap-2"><TaskStatusBadge task={task} /><span className="text-sm text-gray-600">{formatTaskDue(task.due_at)}</span></div>
              {task.description ? <p className="whitespace-pre-wrap text-sm leading-6 text-gray-800">{task.description}</p> : <p className="text-sm text-gray-500">No description.</p>}
              <dl className="grid gap-4 rounded-xl bg-zinc-50 p-4 text-sm sm:grid-cols-2">
                <div><dt className="text-gray-500">Trip</dt><dd className="mt-1 font-medium text-gray-900">{trip?.title || 'Untitled trip'}</dd></div>
                <div><dt className="text-gray-500">Trip Sheet</dt><dd className="mt-1 font-medium text-gray-900">{sheet?.title || 'None'}</dd></div>
                <div><dt className="text-gray-500">Assigned to</dt><dd className="mt-1 font-medium text-gray-900">{personLabel(assignee)}</dd></div>
              </dl>
            </section>
          ) : null}

          {task ? (
            <>
              <section className="border-t border-zinc-200 pt-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><p className="text-sm font-medium text-gray-900">Task status</p><p className="text-xs text-gray-500">Completion details are recorded automatically.</p></div>
                  <TaskStatusButton taskId={task.id} status={task.status} />
                </div>
              </section>

              <section className="space-y-4 border-t border-zinc-200 pt-5">
                <div><h3 className="font-semibold text-gray-900">Comments</h3><p className="text-sm text-gray-500">Comments are permanent and cannot be edited or deleted.</p></div>
                <TaskCommentForm taskId={task.id} />
                <div className="space-y-3">
                  {comments.length ? comments.map((comment) => {
                    const author = relationOne(comment.author)
                    return <article key={comment.id} className="rounded-xl border border-zinc-200 p-3"><div className="flex flex-wrap justify-between gap-2 text-xs text-gray-500"><span className="font-medium text-gray-700">{personLabel(author, 'Team member')}</span><time>{new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(new Date(comment.created_at))}</time></div><p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{comment.body}</p></article>
                  }) : <p className="text-sm text-gray-500">No comments yet.</p>}
                </div>
              </section>

              {isAdmin ? (
                <section className="border-t border-zinc-200 pt-5">
                  <form action={deleteTripTask}>
                    <input type="hidden" name="id" value={task.id} />
                    <input type="hidden" name="return_to" value={returnTo} />
                    <button className="ui-button ui-button-danger">Delete task</button>
                  </form>
                </section>
              ) : null}
            </>
          ) : null}
        </div>
      </aside>
    </div>
  )
}
