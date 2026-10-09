export type TaskStatus = 'pending' | 'completed'

export type TaskListItem = {
  id: string
  title: string
  description: string | null
  trip_id: string
  trip_sheet_id: string | null
  assigned_to: string | null
  due_at: string | null
  status: TaskStatus
  completed_at: string | null
  trip: { id: string; title: string | null } | Array<{ id: string; title: string | null }> | null
  trip_sheet: { id: string; title: string | null } | Array<{ id: string; title: string | null }> | null
  assignee: { id: string; full_name: string | null; email: string | null } | Array<{ id: string; full_name: string | null; email: string | null }> | null
}

export function relationOne<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

export function isTaskOverdue(task: Pick<TaskListItem, 'status' | 'due_at'>, now=Date.now()) {
  return task.status === 'pending' && Boolean(task.due_at) && new Date(task.due_at!).getTime()<now
}

export function sortTasks(tasks: TaskListItem[], now=Date.now()) {
  return [...tasks].sort((a,b)=>{
    const rank=(task:TaskListItem)=>task.status==='completed'?3:isTaskOverdue(task,now)?0:task.due_at?1:2
    const difference=rank(a)-rank(b)
    if(difference) return difference
    if(a.due_at && b.due_at) return new Date(a.due_at).getTime()-new Date(b.due_at).getTime()
    return a.title.localeCompare(b.title)
  })
}

export function groupPersonalTasks(tasks: TaskListItem[], now=Date.now()) {
  const sorted=sortTasks(tasks,now)
  return {
    overdue:sorted.filter(task=>isTaskOverdue(task,now)),
    upcoming:sorted.filter(task=>task.status==='pending'&&!isTaskOverdue(task,now)),
    completed:sorted.filter(task=>task.status==='completed'),
  }
}

export function formatTaskDue(value:string|null) {
  if(!value) return 'No due date'
  return new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(new Date(value))
}
