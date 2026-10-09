import { sortTasks, type TaskListItem } from '@/lib/trip-tasks'

import TaskTableRow from './TaskTableRow'

export default function TaskList({ tasks, hrefForTask }: { tasks: TaskListItem[]; hrefForTask: (id: string) => string }) {
  const sorted = sortTasks(tasks)
  return (
    <div className="app-table-wrap">
      <table className="app-table">
        <thead><tr><th><span className="sr-only">Complete</span></th><th>Task</th><th>Trip</th><th>Assignee</th><th>Due</th><th>Status</th></tr></thead>
        <tbody>
          {sorted.length ? sorted.map((task) => (
            <TaskTableRow key={`${task.id}:${task.status}`} task={task} detailHref={hrefForTask(task.id)} />
          )) : <tr><td colSpan={6} className="text-gray-500">No tasks match these filters.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
