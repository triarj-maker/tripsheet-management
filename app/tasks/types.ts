import type { TaskListItem } from '@/lib/trip-tasks'

export type TaskTrip={id:string;title:string|null}
export type TaskTripSheet={id:string;trip_id:string|null;title:string|null}
export type TaskAssignee={id:string;full_name:string|null;email:string|null}
export type TaskComment={id:string;body:string;created_at:string;author:{id:string;full_name:string|null;email:string|null}|Array<{id:string;full_name:string|null;email:string|null}>|null}
export type TaskPageData={tasks:TaskListItem[];trips:TaskTrip[];tripSheets:TaskTripSheet[];assignees:TaskAssignee[]}
