# Trip Task Management V1 deployment

No production migration or application deployment is performed by this change.

## Preconditions

1. Confirm the deployed database includes the Stage 2B multi-role authorization migration.
2. Take a restorable database backup.
3. Apply `sql/20261010_trip_task_management.sql` in the Supabase SQL Editor as one complete transaction.
4. Run `sql/verification/20261010_trip_task_validation.sql` in a new SQL Editor query. Do not deploy the application if any row is `FAIL`.

The database migration is intentionally first. It adds tables, functions, triggers, policies, grants, constraints, and indexes that the current application does not reference. Existing Trips, Trip Sheets, assignments, profiles, and Auth identities are not rewritten. This avoids an application version that calls tables which do not yet exist.

## Application release

1. Deploy the application after validation passes.
2. As an Admin, create one task for a non-production test Trip or approved test record, assign it, edit it, complete and reopen it, and add a comment.
3. Sign in as the assignee and confirm My Tasks contains only that user's tasks. Confirm status and comment actions work and task fields remain read-only.
4. Confirm another resource cannot see the task. Confirm the central Admin list, Trip detail task section, filters, overdue ordering, and mobile full-screen detail view.
5. Delete the test task if appropriate. Deleting a task deletes its comments; comments cannot otherwise be edited or deleted.

## Rollback

The safest application rollback is to redeploy the preceding application version and leave the additive task tables in place. Existing task data remains intact and the old application ignores it.

Only remove the database feature if no task data must be retained. After rolling back the application, run `sql/20261010_trip_task_management_rollback.sql`. It aborts if either task table contains data. If data exists, export and review it before deciding on a separate, explicitly approved data migration. The supporting composite unique index is retained because it is harmless and may predate this feature.
