-- Trip Task Management V1. Additive and safe for the currently deployed app.
begin;

-- Supports a database-level same-Trip composite foreign key without changing rows.
create unique index if not exists trip_sheets_id_trip_id_key
  on public.trip_sheets(id,trip_id);

create table if not exists public.trip_tasks (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  trip_sheet_id uuid,
  title text not null,
  description text,
  assigned_to uuid references public.profiles(id),
  due_at timestamptz,
  status text not null default 'pending',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_by uuid references public.profiles(id),
  completed_at timestamptz,
  constraint trip_tasks_sheet_same_trip_fkey
    foreign key(trip_sheet_id,trip_id) references public.trip_sheets(id,trip_id),
  constraint trip_tasks_title_check check(btrim(title)<>'' and char_length(title)<=200),
  constraint trip_tasks_description_check check(description is null or char_length(description)<=10000),
  constraint trip_tasks_status_check check(status in ('pending','completed')),
  constraint trip_tasks_completion_check check(
    (status='pending' and completed_by is null and completed_at is null) or
    (status='completed' and completed_by is not null and completed_at is not null)
  )
);

create table if not exists public.trip_task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.trip_tasks(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now(),
  constraint trip_task_comments_body_check check(btrim(body)<>'' and char_length(body)<=4000)
);

create index if not exists idx_trip_tasks_trip_id on public.trip_tasks(trip_id);
create index if not exists idx_trip_tasks_trip_sheet_id on public.trip_tasks(trip_sheet_id);
create index if not exists idx_trip_tasks_assigned_status_due on public.trip_tasks(assigned_to,status,due_at);
create index if not exists idx_trip_tasks_status_due on public.trip_tasks(status,due_at);
create index if not exists idx_trip_task_comments_task_created on public.trip_task_comments(task_id,created_at);

create or replace function multi_role_private.guard_trip_task_write()
returns trigger language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=auth.uid(); actor_admin boolean:=public.is_admin();
begin
  if actor is null then raise exception 'Authenticated user required' using errcode='42501'; end if;
  if new.assigned_to is not null and (tg_op='INSERT' or new.assigned_to is distinct from old.assigned_to)
    and not exists(
      select 1 from public.profiles p
      where p.id=new.assigned_to and p.is_active is true
        and (p.is_admin is true or exists(
          select 1 from public.profile_operational_roles r
          where r.profile_id=p.id and r.role_code in ('facilitator','expert')
        ))
    )
  then
    raise exception 'Tasks may only be assigned to an active Team member' using errcode='23514';
  end if;
  if tg_op='INSERT' then
    if not actor_admin or new.created_by is distinct from actor then
      raise exception 'Only an active Administrator may create tasks' using errcode='42501';
    end if;
    if new.status='completed' then new.completed_by:=actor; new.completed_at:=now();
    else new.completed_by:=null; new.completed_at:=null; end if;
    new.updated_at:=now(); return new;
  end if;
  if tg_op='DELETE' then
    if not actor_admin then raise exception 'Only an active Administrator may delete tasks' using errcode='42501'; end if;
    return old;
  end if;
  if new.id is distinct from old.id or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'Task identity and creation metadata cannot be changed' using errcode='42501';
  end if;
  if not actor_admin then
    if old.assigned_to is distinct from actor or new.trip_id is distinct from old.trip_id
      or new.trip_sheet_id is distinct from old.trip_sheet_id or new.title is distinct from old.title
      or new.description is distinct from old.description or new.assigned_to is distinct from old.assigned_to
      or new.due_at is distinct from old.due_at or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at then
      raise exception 'Assigned users may only complete or reopen their own tasks' using errcode='42501';
    end if;
  end if;
  if new.status is distinct from old.status then
    if new.status='completed' then new.completed_by:=actor; new.completed_at:=now();
    else new.completed_by:=null; new.completed_at:=null; end if;
  elsif new.completed_by is distinct from old.completed_by or new.completed_at is distinct from old.completed_at then
    raise exception 'Completion metadata is managed automatically' using errcode='42501';
  end if;
  new.updated_at:=now(); return new;
end $$;

create or replace function multi_role_private.guard_trip_task_comment()
returns trigger language plpgsql volatile security definer set search_path='' as $$
begin
  -- Permit only the FK-owned cascade when an Administrator deletes its parent task.
  if tg_op='DELETE' and pg_trigger_depth()>1 then return old; end if;
  if tg_op<>'INSERT' then raise exception 'Task comments are append-only' using errcode='42501'; end if;
  if auth.uid() is null or new.author_id is distinct from auth.uid() then
    raise exception 'Comment author must be the authenticated user' using errcode='42501';
  end if;
  return new;
end $$;

alter function multi_role_private.guard_trip_task_write() owner to postgres;
alter function multi_role_private.guard_trip_task_comment() owner to postgres;
revoke all on function multi_role_private.guard_trip_task_write(),
  multi_role_private.guard_trip_task_comment() from public,anon,authenticated,service_role;

drop trigger if exists guard_trip_task_write on public.trip_tasks;
create trigger guard_trip_task_write before insert or update or delete on public.trip_tasks
for each row execute function multi_role_private.guard_trip_task_write();
drop trigger if exists guard_trip_task_comment on public.trip_task_comments;
create trigger guard_trip_task_comment before insert or update or delete on public.trip_task_comments
for each row execute function multi_role_private.guard_trip_task_comment();

alter table public.trip_tasks enable row level security;
alter table public.trip_task_comments enable row level security;

drop policy if exists trip_tasks_read on public.trip_tasks;
drop policy if exists trip_tasks_insert on public.trip_tasks;
drop policy if exists trip_tasks_update on public.trip_tasks;
drop policy if exists trip_tasks_delete on public.trip_tasks;
drop policy if exists trip_task_comments_read on public.trip_task_comments;
drop policy if exists trip_task_comments_insert on public.trip_task_comments;

create policy trip_tasks_read on public.trip_tasks for select to authenticated using(
  public.is_admin() or (assigned_to=auth.uid() and exists(
    select 1 from public.profiles p where p.id=auth.uid() and p.is_active is true))
);
create policy trip_tasks_insert on public.trip_tasks for insert to authenticated
  with check(public.is_admin() and created_by=auth.uid());
create policy trip_tasks_update on public.trip_tasks for update to authenticated
  using(public.is_admin() or (assigned_to=auth.uid() and exists(
    select 1 from public.profiles p where p.id=auth.uid() and p.is_active is true)))
  with check(public.is_admin() or (assigned_to=auth.uid() and exists(
    select 1 from public.profiles p where p.id=auth.uid() and p.is_active is true)));
create policy trip_tasks_delete on public.trip_tasks for delete to authenticated using(public.is_admin());

create policy trip_task_comments_read on public.trip_task_comments for select to authenticated using(
  exists(select 1 from public.trip_tasks t where t.id=task_id)
);
create policy trip_task_comments_insert on public.trip_task_comments for insert to authenticated with check(
  author_id=auth.uid() and exists(select 1 from public.trip_tasks t where t.id=task_id)
);

revoke all on public.trip_tasks,public.trip_task_comments from public,anon,authenticated;
grant select,insert,update,delete on public.trip_tasks to authenticated;
grant select,insert on public.trip_task_comments to authenticated;

commit;
