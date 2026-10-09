import Link from 'next/link'

import AdminNav from '@/app/dashboard/AdminNav'
import { requireAdminOrResource } from '@/app/dashboard/lib'
import { getTaskPageData } from '@/app/tasks/data'
import TaskDetailPanel from '@/app/tasks/TaskDetailPanel'
import TaskStatusBadge from '@/app/tasks/TaskStatusBadge'
import type { TaskComment } from '@/app/tasks/types'
import { formatTaskDue, groupPersonalTasks, relationOne, type TaskListItem } from '@/lib/trip-tasks'
import { isAdminRole } from '@/lib/roles'

function TaskCard({ task }: { task: TaskListItem }) {
  const trip = relationOne(task.trip)
  const sheet = relationOne(task.trip_sheet)
  return <Link href={`/my-tasks?task=${task.id}`} className="block rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300 hover:shadow-md"><div className="flex items-start justify-between gap-3"><h3 className="font-semibold text-gray-900">{task.title}</h3><TaskStatusBadge task={task} /></div><p className="mt-2 text-sm text-gray-700">{trip?.title || 'Untitled trip'}{sheet ? ` · ${sheet.title || 'Untitled trip sheet'}` : ''}</p><p className="mt-2 text-sm font-medium text-gray-600">{formatTaskDue(task.due_at)}</p></Link>
}

function TaskGroup({ title, tasks }: { title: string; tasks: TaskListItem[] }) {
  return <section className="space-y-3"><div><h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">{title}</h2><p className="mt-1 text-xs text-gray-500">{tasks.length} task{tasks.length === 1 ? '' : 's'}</p></div>{tasks.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{tasks.map((task) => <TaskCard key={task.id} task={task} />)}</div> : <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-sm text-gray-500">No {title.toLocaleLowerCase()} tasks.</div>}</section>
}

export default async function MyTasksPage({ searchParams }: { searchParams: Promise<{ task?: string; error?: string; success?: string }> }) {
  const query = await searchParams
  const { supabase, user, profile } = await requireAdminOrResource()
  const { data, error } = await getTaskPageData(supabase, { assignedTo: user.id, includeEditorData: isAdminRole(profile) })
  const grouped = groupPersonalTasks(data.tasks)
  const selectedTask = query.task ? data.tasks.find((task) => task.id === query.task) ?? null : null
  const commentsResult = selectedTask ? await supabase.from('trip_task_comments').select('id, body, created_at, author:profiles!trip_task_comments_author_id_fkey(id, full_name, email)').eq('task_id', selectedTask.id).order('created_at') : { data: [], error: null }

  return <main className="app-page"><div className="app-shell app-card"><AdminNav current="my-tasks" profile={profile} view="resource" /><div className="app-page-header"><div><h1 className="app-page-title">My Tasks</h1><p className="app-page-subtitle">Work assigned directly to you.</p></div></div>{query.error || error || commentsResult.error ? <p className="app-banner-error">{query.error || error || commentsResult.error?.message}</p> : null}{query.success ? <p className="app-banner-success">{query.success}</p> : null}<div className="space-y-7"><TaskGroup title="Overdue" tasks={grouped.overdue} /><TaskGroup title="Upcoming" tasks={grouped.upcoming} /><TaskGroup title="Completed" tasks={grouped.completed} /></div>{selectedTask ? <TaskDetailPanel task={selectedTask} comments={(commentsResult.data as TaskComment[] | null) ?? []} trips={data.trips} tripSheets={data.tripSheets} assignees={data.assignees} isAdmin={isAdminRole(profile)} returnTo="/my-tasks" closeHref="/my-tasks" /> : null}</div></main>
}
