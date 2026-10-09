-- Guarded rollback for Trip Task Management V1. Run only after rolling the app back.
begin;

do $$
begin
  if exists(select 1 from public.trip_tasks limit 1)
    or exists(select 1 from public.trip_task_comments limit 1)
  then
    raise exception 'Trip Task rollback refused: export and review existing task data first.';
  end if;
end $$;

drop table public.trip_task_comments;
drop table public.trip_tasks;
drop function multi_role_private.guard_trip_task_comment();
drop function multi_role_private.guard_trip_task_write();

-- trip_sheets_id_trip_id_key is intentionally retained. It is additive, harmless,
-- and may have existed before this feature migration.
commit;
