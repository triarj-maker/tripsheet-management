'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAdmin, requireAdminOrResource } from '@/app/dashboard/lib'
import { appendToastParam } from '@/app/lib/action-feedback'
import type { TaskStatus } from '@/lib/trip-tasks'

function safeReturnPath(value:FormDataEntryValue|null) {
  const path=String(value??'').trim()
  if (!(path.startsWith('/dashboard/tasks') || path.startsWith('/dashboard/trips/') || path.startsWith('/my-tasks'))) return '/dashboard/tasks'
  const parsed = new URL(path, 'https://echo.invalid')
  return `${parsed.pathname}${parsed.search}`
}
function withError(path:string,error:string) {
  const parsed = new URL(path, 'https://echo.invalid')
  parsed.searchParams.set('error', error)
  return `${parsed.pathname}?${parsed.searchParams}`
}
function optional(value:FormDataEntryValue|null){const text=String(value??'').trim();return text||null}
function dueValue(value:FormDataEntryValue|null){const text=String(value??'').trim();if(!text)return null;const date=new Date(text);return Number.isNaN(date.getTime())?undefined:date.toISOString()}

export async function saveTripTask(formData:FormData) {
  const {supabase,user}=await requireAdmin()
  const returnPath=safeReturnPath(formData.get('return_to'))
  const id=optional(formData.get('id'))
  const title=String(formData.get('title')??'').trim()
  const tripId=String(formData.get('trip_id')??'').trim()
  const tripSheetId=optional(formData.get('trip_sheet_id'))
  const assignedTo=optional(formData.get('assigned_to'))
  const description=optional(formData.get('description'))
  const dueAt=dueValue(formData.get('due_at'))
  const status=formData.get('status')==='completed'?'completed':'pending'
  if(!title||title.length>200||!tripId||dueAt===undefined) redirect(withError(returnPath,'Enter a valid task title, Trip, and due date.'))
  if(description && description.length>10000) redirect(withError(returnPath,'Description must be 10,000 characters or fewer.'))
  if(tripSheetId) {
    const {data}=await supabase.from('trip_sheets').select('id').eq('id',tripSheetId).eq('trip_id',tripId).maybeSingle()
    if(!data) redirect(withError(returnPath,'The selected Trip Sheet does not belong to this Trip.'))
  }
  if(assignedTo) {
    const {data}=await supabase.from('profiles').select('id').eq('id',assignedTo).eq('is_active',true).maybeSingle()
    if(!data) redirect(withError(returnPath,'Select an active assignee.'))
  }
  const payload={title,trip_id:tripId,trip_sheet_id:tripSheetId,assigned_to:assignedTo,description,due_at:dueAt,status}
  const result=id
    ? await supabase.from('trip_tasks').update(payload).eq('id',id).select('id').single()
    : await supabase.from('trip_tasks').insert({...payload,created_by:user.id}).select('id').single()
  if(result.error) redirect(withError(returnPath,result.error.message))
  revalidatePath('/dashboard/tasks');revalidatePath('/my-tasks');revalidatePath(`/dashboard/trips/${tripId}`)
  redirect(appendToastParam(returnPath,'Task saved'))
}

export type TaskStatusResult = {
  ok: boolean
  error: string | null
  status: TaskStatus
}

export async function setTripTaskStatus(formData:FormData):Promise<TaskStatusResult> {
  const {supabase}=await requireAdminOrResource()
  const id=String(formData.get('id')??'').trim()
  const status:TaskStatus=formData.get('status')==='completed'?'completed':'pending'
  const preserveCurrentRow=formData.get('inline')==='true'
  if(!id) return {ok:false,error:'Task not found.',status}
  const {data,error}=await supabase.from('trip_tasks').update({status}).eq('id',id).select('id').maybeSingle()
  if(error||!data) return {ok:false,error:error?.message??'You cannot update that task.',status}
  if(!preserveCurrentRow) {
    revalidatePath('/dashboard/tasks');revalidatePath('/my-tasks');revalidatePath('/dashboard/trips','layout')
  }
  return {ok:true,error:null,status}
}

export async function deleteTripTask(formData:FormData) {
  const {supabase}=await requireAdmin();const id=String(formData.get('id')??'').trim();const returnPath=safeReturnPath(formData.get('return_to'))
  const {data,error}=await supabase.from('trip_tasks').delete().eq('id',id).select('id').maybeSingle()
  if(error||!data) redirect(withError(returnPath,error?.message??'Task not found.'))
  revalidatePath('/dashboard/tasks');revalidatePath('/my-tasks');revalidatePath('/dashboard/trips','layout');redirect(appendToastParam(returnPath,'Task deleted'))
}

export type CommentState={error:string|null;success:number}
export async function addTripTaskComment(_state:CommentState,formData:FormData):Promise<CommentState> {
  const {supabase,user}=await requireAdminOrResource();const taskId=String(formData.get('task_id')??'').trim();const body=String(formData.get('body')??'').trim()
  if(!taskId||!body) return {error:'Comment cannot be empty.',success:0}
  if(body.length>4000) return {error:'Comment must be 4,000 characters or fewer.',success:0}
  const {error}=await supabase.from('trip_task_comments').insert({task_id:taskId,author_id:user.id,body})
  if(error)return {error:error.message,success:0}
  revalidatePath('/dashboard/tasks');revalidatePath('/my-tasks');revalidatePath('/dashboard/trips','layout');return {error:null,success:Date.now()}
}
