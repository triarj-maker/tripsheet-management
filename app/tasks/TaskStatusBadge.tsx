import { isTaskOverdue, type TaskListItem } from '@/lib/trip-tasks'

export default function TaskStatusBadge({ task }: { task: Pick<TaskListItem, 'status' | 'due_at'> }) {
  if (task.status === 'completed') return <span className="ui-badge bg-green-100 text-green-700">Completed</span>
  if (isTaskOverdue(task)) return <span className="ui-badge bg-red-100 text-red-700">Overdue</span>
  return <span className="ui-badge bg-amber-100 text-amber-700">Pending</span>
}
