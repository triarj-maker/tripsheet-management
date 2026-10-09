import Link from 'next/link'

import AdminNav from '@/app/dashboard/AdminNav'
import { requireAdmin } from '@/app/dashboard/lib'
import { getTaskPageData } from '@/app/tasks/data'
import TaskDetailPanel from '@/app/tasks/TaskDetailPanel'
import TaskList from '@/app/tasks/TaskList'
import type { TaskComment } from '@/app/tasks/types'
import { isTaskOverdue } from '@/lib/trip-tasks'

type Query = { q?: string; trip?: string; assignee?: string; status?: string; task?: string; new?: string; error?: string; success?: string }

function listParams(query: Query) {
  const params = new URLSearchParams()
  for (const key of ['q', 'trip', 'assignee', 'status'] as const) if (query[key]) params.set(key, query[key]!)
  return params
}

export default async function TasksPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams
  const { supabase } = await requireAdmin()
  const { data, error } = await getTaskPageData(supabase)
  const params = listParams(query)
  const listHref = `/dashboard/tasks${params.size ? `?${params}` : ''}`
  const needle = query.q?.trim().toLocaleLowerCase() ?? ''
  const filtered = data.tasks.filter((task) => {
    const searchable = [task.title, task.description].filter(Boolean).join(' ').toLocaleLowerCase()
    const statusMatches = !query.status ||
      (query.status === 'overdue' && isTaskOverdue(task)) ||
      (query.status === 'pending' && task.status === 'pending' && !isTaskOverdue(task)) ||
      (query.status === 'completed' && task.status === 'completed')
    return (!needle || searchable.includes(needle)) &&
      (!query.trip || task.trip_id === query.trip) &&
      (!query.assignee || (query.assignee === 'unassigned' ? !task.assigned_to : task.assigned_to === query.assignee)) &&
      statusMatches
  })
  const selectedTask = query.task ? data.tasks.find((task) => task.id === query.task) ?? null : null
  const commentsResult = selectedTask
    ? await supabase.from('trip_task_comments').select('id, body, created_at, author:profiles!trip_task_comments_author_id_fkey(id, full_name, email)').eq('task_id', selectedTask.id).order('created_at')
    : { data: [], error: null }
  const panelError = query.task && !selectedTask ? 'Task not found or unavailable.' : commentsResult.error?.message
  const panelParams = (key: string, value: string) => { const next = new URLSearchParams(params); next.set(key, value); return `/dashboard/tasks?${next}` }

  return (
    <>
      <AdminNav current="tasks" />
      <div className="app-page-header">
        <div><h1 className="app-page-title">Tasks</h1><p className="app-page-subtitle">Manage operational work linked to Trips and Trip Sheets.</p></div>
        <Link href={panelParams('new', '1')} className="ui-button ui-button-primary">Create task</Link>
      </div>
      {query.error || error || panelError ? <p className="app-banner-error">{query.error || error || panelError}</p> : null}
      {query.success ? <p className="app-banner-success">{query.success}</p> : null}
      <form method="get" className="app-filter-panel grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div><label className="ui-label" htmlFor="task-search">Search</label><input id="task-search" name="q" className="ui-input" defaultValue={query.q} placeholder="Title or description" /></div>
        <div><label className="ui-label" htmlFor="task-trip-filter">Trip</label><select id="task-trip-filter" name="trip" className="ui-select" defaultValue={query.trip ?? ''}><option value="">All Trips</option>{data.trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.title || 'Untitled trip'}</option>)}</select></div>
        <div><label className="ui-label" htmlFor="task-assignee-filter">Assignee</label><select id="task-assignee-filter" name="assignee" className="ui-select" defaultValue={query.assignee ?? ''}><option value="">All assignees</option><option value="unassigned">Unassigned</option>{data.assignees.map((person) => <option key={person.id} value={person.id}>{person.full_name || person.email || person.id}</option>)}</select></div>
        <div><label className="ui-label" htmlFor="task-status-filter">Status</label><select id="task-status-filter" name="status" className="ui-select" defaultValue={query.status ?? ''}><option value="">All statuses</option><option value="overdue">Overdue</option><option value="pending">Pending</option><option value="completed">Completed</option></select></div>
        <div className="flex items-end gap-2"><button className="ui-button ui-button-primary">Apply</button><Link href="/dashboard/tasks" className="ui-button ui-button-secondary">Clear</Link></div>
      </form>
      <TaskList tasks={filtered} hrefForTask={(id) => panelParams('task', id)} />
      {(query.new === '1' || selectedTask) ? <TaskDetailPanel task={selectedTask} comments={(commentsResult.data as TaskComment[] | null) ?? []} trips={data.trips} tripSheets={data.tripSheets} assignees={data.assignees} isAdmin returnTo={listHref} closeHref={listHref} /> : null}
    </>
  )
}
