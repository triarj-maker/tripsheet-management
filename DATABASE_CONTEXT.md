# DATABASE_CONTEXT.md - Trip Sheet Management System

Updated: 06/15/2026

--------------------------------------------------

1. Purpose

Practical database behavior map for future developers and coding agents.

This file documents:
- current core tables and relationships
- mutation assumptions
- RLS expectations visible in migrations
- legacy naming notes that still affect code/schema

It is not a full ERD and should not replace migrations or live schema inspection.

Source note:
- Verified from repo SQL files where available
- App-verified means confirmed from current application queries/actions
- Inferred means behavior is inferred from app usage, not directly from table DDL
- Live Supabase state was not inspected while creating this file

--------------------------------------------------

2. Core Relational Model

- `trips` = parent program/planning entity
- `trip_sheets` = child execution units linked to `trips`
- `trip_sheet_assignments` = assigned users for Trip Sheet execution
- `trip_templates` = reusable Trip Sheet defaults
- `template_cards` = template-level module card defaults
- `trip_sheet_cards` = copied Trip Sheet-level module card snapshots

Core relationship:
- One Trip has many Trip Sheets
- One Trip Sheet has many assignments
- One Trip Template can have many Template Cards
- One Trip Sheet can have many Trip Sheet Cards
- One Trip has many Tasks; a Task may additionally reference one Trip Sheet from that same Trip
- One Task has append-only comments

Trip Task Management V1 is prepared locally in
`sql/20261010_trip_task_management.sql`. `trip_tasks` records title, description,
assignee, timezone-aware due timestamp, pending/completed state, creator, timestamps,
and completion actor/time. A composite foreign key enforces that an optional
`trip_sheet_id` belongs to the task's required `trip_id`.

Both task tables have RLS. Active Admin permission grants all task operations.
An active assignee can select only their tasks and can change only status; a trigger
rejects changes to task content, ownership, or creation metadata. Completion
metadata and `updated_at` are trigger-managed. Comments can be selected and inserted
only through a visible task, must identify the authenticated author, and cannot be
updated or directly deleted. Parent-task deletion cascades its comments. Client
roles do not receive TRUNCATE.

--------------------------------------------------

3. Trips

Known important fields:
- `id`
- `title`
- `start_date` (app-verified)
- `end_date` (app-verified)
- `trip_type`
- `workflow_state` (app-verified)
- `is_archived` (app-verified)
- `destination_id`
- `school_id`
- `company_id`
- `phone_number` (app-verified)
- `adult_count` (app-verified)
- `kid_count` (app-verified)

Behavior:
- `trips` is the parent planning/program table
- Parent Trip date changes may drive child Trip Sheet date shifts
- Existing child Trip Sheet rows should be updated during shifts, not recreated
- `completed` is derived from `end_date`, not stored as the primary workflow state
- `is_archived` is separate from `workflow_state`
- `workflow_state` currently normalizes to `tentative` or `active`

Legacy note:
- `guest_name` and `company` legacy text fields still appear in app usage and lookup backfill SQL
- Prefer `school_id` / `company_id` for new query/filter logic

--------------------------------------------------

4. Trip Sheets

- `trip_sheets` belong to `trips` through `trip_id`
- Trip Sheets are operational execution units
- Known app-used fields include `id`, `trip_id`, `title`, `start_date`, `start_time`, `end_date`, `end_time`, `template_id`, `body_text`, `transportation_info`, and `is_archived`
- `body_text` stores Markdown text
- `body_text` is copied from template body at creation and then becomes independent (inferred from creation flow)
- Do not auto-regenerate or auto-sync `body_text` after creation
- During parent Trip date shifts, update existing Trip Sheet rows

--------------------------------------------------

5. Assignments and Legacy Naming

- `trip_sheet_assignments.resource_user_id` is still the schema column used by app code
- Semantically, `resource_user_id` means assigned user
- Current business terminology is Facilitator / Expert / Admin, not generic Resource
- Do not rename assignment columns, routes, or APIs unless explicitly requested
- Compare assignment sets by `resource_user_id`, not assignment row id

Known app-used assignment fields:
- `id`
- `trip_sheet_id`
- `resource_user_id`
- `assigned_by`

--------------------------------------------------

6. Profiles and Roles


Combined Stage 2B/2C authorization (user-confirmed deployed):
- App checks use `is_admin AND is_active` and active operational memberships.
  Profile queries embed memberships; assignment pickers deduplicate profile IDs.
- `sql/20261009_multi_role_authorization.sql` replaces Admin helper bodies and
  recognized inline legacy policy predicates, preserving other conditions and RLS
  enabled/disabled states. Unknown predicates/functions fail transactionally.
- Retires Stage 2A sync/guards, retains timestamp and serialization triggers, and
  installs independent permission guards with transaction-scoped private write
  capabilities. Direct legacy permission writes fail after cutover.
- `save_profile_permissions` is the sole Team create/edit permission API. It writes
  ordinary profile fields, independent Admin permission, all selected memberships,
  active status and the compatibility projection in one transaction.
- `set_profile_active` preserves independent permissions. The obsolete scalar-role
  `save_team_profile` function is explicitly absent after migration.
- If the pre-existing `public.is_active_resource(uuid)` helper is present, the
  migration preserves its signature/dependencies and updates it to require an active
  Facilitator or Expert membership. It no longer reads the retired `resource` role.
- `profiles.role` becomes a derived display projection only: Admin, else Facilitator,
  else Expert (inactive/no memberships uses Facilitator to retain the legacy NOT NULL
  column). No existing profile/assignment rows are rewritten by installation.
- Final-active-Admin, identity, unauthorized permission/membership-write and
  active-non-admin membership protections are enforced in the database. Auth
  creation remains separate and partial failures never delete the Auth identity.
- Deployment and validation: `sql/verification/20261009_stage2b_runbook.md` and
  `sql/verification/20261009_stage2b_validation.sql`. Block/drain legacy mutations,
  migrate, deploy combined Stage 2B/2C, verify, then reopen. Never reinstall the
  Stage 2A sync after independent multi-role data exists.
- Stage 3 adds no database objects. Its browser cookie stores only a validated,
  user-bound interface preference; database permissions remain authoritative.

Historical Stage 2A preparation notes (database now user-confirmed applied):
Stage 2A compatibility bridge (installed in production; retained until cutover):
- `sql/20261009_multi_role_compatibility_bridge.sql` keeps `profiles.role`
  authoritative and all existing helpers/RLS unchanged. BEFORE/AFTER profile
  triggers derive `is_admin = (role = 'admin')` and reconcile memberships in the
  same transaction. Admin maps to no memberships; Facilitator/Expert maps to one.
- Deferred constraints prevent direct membership writes from creating drift.
  All profile/membership write statements update a private serialization row;
  last-active-Admin checks run under that transaction-held serialization mechanism.
  Concurrent native PostgreSQL testing remains a deployment gate.
- Active Admin permission is checked server-side; role/active/permission changes
  are guarded at the database level. Self changes use OLD permissions. Profile
  IDs cannot change; profile deletion is unavailable during Stage 2A.
- Installation is atomic, repeatable, makes no existing profile/assignment changes,
  and refuses pre-existing role drift rather than guessing a reconciliation.
  Existing timestamp/audit triggers are neither disabled nor replaced.
- A separate `sql/20261009_profiles_revoke_client_truncate.sql` revokes only client
  TRUNCATE on profiles, aborting if inherited/PUBLIC access remains. The user now
  confirms this correction is applied; omit it from Stage 2A production deployment.
- At the Stage 2A production deployment, the application kept its single role
  dropdown and legacy authorization. Its
  Auth creation error path preserves the Auth account and reports the UUID for
  manual recovery. A profile INSERT uses the existing identity, never an upsert.
- `sql/verification/20261009_stage2a_preflight.sql` retrieves live policies,
  helpers, triggers, grants and drift read-only in one result. Review before any
  production application: repository SQL is not proof of complete live RLS.
- See `sql/verification/20261009_stage2a_runbook.md` for the historical Stage 2A
  staging/concurrency gates,
  database-first deployment, partial-account recovery and rollback that retains
  synchronization. That release did not implement Stage 2B/2C or interface
  switching. The combined local Stage 2B/2C candidate now explicitly retires this
  single-role bridge before independent multi-role writes begin.

Stage 1 multi-role foundation (user reports applied/validated 2026-10-09):
- `sql/20261009_multi_role_foundation.sql` introduced `profiles.is_admin`, an
  `operational_roles` catalogue and `profile_operational_roles` memberships.
- Existing `profiles.role` and application authorization remain unchanged.
- Every resource retains an Auth login and the existing profile/user identity.
- Read-only live preflight, validation, security assumptions, snapshot drift and
  approval steps: `sql/verification/20261009_multi_role_runbook.md`.
- Latest user-supplied live diagnostics show the new column, tables, RLS, policies
  and security functions present. The supplied final validation passed current-state
  backfill checks; historical preservation and completion of the original integrity
  check cannot be proven without the original execution evidence/snapshots. App
  authorization still uses the legacy role.
- `sql/verification/20261009_multi_role_final_validation.sql` returns one read-only
  PASS/FAIL/WARNING report; it cannot prove history without a pre-migration snapshot.
- User-supplied live diagnostics confirmed the original attempt rolled back and
  `set_profiles_updated_at` invokes `set_updated_at()` (`NEW.updated_at = NOW()`).
  The correction validates that timestamp only on actual initial-backfill rows;
  all other old fields and all rerun timestamps remain protected.

Current app roles:
- `admin`
- `facilitator`
- `expert`

Behavior:
- Admin has full access
- Facilitator / Expert have assigned-work access
- Admins may also be assigned operationally
- Personal assigned-work views must remain scoped to the logged-in user's assignments

Legacy support:
- `resource` remains app-verified as a legacy role in `lib/roles.ts`
- Do not use `resource` as new business terminology

Schema uncertainty:
- The repo SQL snapshot does not include the base `profiles` table DDL
- Role values above are verified from app role helpers, not a visible DB check constraint

--------------------------------------------------

7. Schools and Companies

- `schools` and `companies` are lookup tables
- `trips.school_id` references `schools(id)`
- `trips.company_id` references `companies(id)`
- Use ID-based filtering/querying for school and company relationships
- Avoid reintroducing legacy free-text filtering unless explicitly requested

Lookup fields verified in SQL:
- `id`
- `name`
- `is_active`
- `created_at`
- `updated_at`

Legacy note:
- Backfill SQL preserves `trips.guest_name` and `trips.company`
- Treat those as historical/fallback display data, not preferred relationship fields

--------------------------------------------------

8. Templates

- `trip_templates` define reusable Trip Sheet defaults
- App-used fields include `id`, `title`, `heading`, `default_start_time`, `default_end_time`, and `body`
- Template body is copied into `trip_sheets.body_text` during Trip Sheet creation (inferred from app flow)
- Existing Trip Sheets do not auto-sync when a template changes
- Template body is Markdown text; do not store generated HTML

Schema uncertainty:
- The repo SQL snapshot contains later `trip_templates` alterations, but not the base table DDL

--------------------------------------------------

9. Module Cards

- `template_cards` belong to `trip_templates` through `template_id`
- `trip_sheet_cards` belong to `trip_sheets` through `trip_sheet_id`
- Template cards copy into Trip Sheet cards at Trip Sheet creation
- Trip Sheet cards are independent snapshots after creation
- `source_template_card_id` is traceability only
- No auto-sync from template cards to existing Trip Sheet cards after creation
- `card_url` stores a relative URL only
- Expected `card_url` path starts with `/module-cards/...`
- The app stores module card URLs, not HTML bodies

Card fields verified in SQL:
- `id`
- parent id: `template_id` or `trip_sheet_id`
- `source_template_card_id` on `trip_sheet_cards`
- `title`
- `category` (`facilitator` or `expert`)
- `card_url`
- `sort_order`
- `created_at`
- `updated_at`

--------------------------------------------------

10. Notifications

- Notification model is manual and trip-level
- `trip_notifications` stores one row per manual Trip notification send
- `trip_notification_recipients` stores one row per recipient for that send
- No old automated queue/cron assignment-email model should be rebuilt unless explicitly requested

Important fields verified in SQL:
- `trip_notifications.trip_id`
- `trip_notifications.sent_by_user_id`
- `trip_notifications.status`
- `trip_notification_recipients.trip_notification_id`
- `trip_notification_recipients.resource_user_id`
- `trip_notification_recipients.delivery_status`

--------------------------------------------------

11. Mutation Rules

- Database is the source of truth
- Fetch current DB state before mutation calculations where relevant
- Do not trust stale form/client state for persisted values
- Prefer `update` over `upsert` for existing rows
- Avoid partial `upsert` payloads unless true create-or-update behavior is intended
- Parent Trip date changes should update existing child Trip Sheet rows
- Preserve Trip Sheet duration, `start_time`, `end_time`, and `body_text` when shifting dates
- Mutation errors may originate from DB triggers/functions, not only app code
- Trace mutation failures across fetch -> compute -> write before changing behavior

--------------------------------------------------

12. RLS Notes

Visible in migrations:
- `trips`: authenticated users can read; admin-only insert/update/delete
- `companies` / `schools`: authenticated users can read; admin-only insert/update/delete
- `template_cards` / `trip_sheet_cards`: authenticated users can read; admin-only insert/update/delete
- `trip_notifications` / `trip_notification_recipients`: admin-only read/write policies

Do not overclaim:
- Base RLS for `profiles`, `trip_sheets`, `trip_sheet_assignments`, and `trip_templates` was not visible in the repo SQL snapshot inspected
- Verify live Supabase policies before changing security-sensitive behavior

--------------------------------------------------

13. Legacy / Naming Notes

Known legacy names:
- Routes may still use `/dashboard/resources`
- Assignment column remains `resource_user_id`
- Some UI/helper names may still say resource
- Legacy role `resource` is still supported in role helpers

Current business terminology:
- Facilitator
- Expert
- Admin

Use current terminology in product-facing changes, but do not rename legacy schema/routes without an explicit migration task.

--------------------------------------------------

14. Boundaries

- Do not document future speculative schemas as current
- Do not add CRM/sales tables unless they actually exist
- Do not add partner/vendor tables unless they actually exist
- Do not treat this file as proof of live database state
- When behavior and inspected data disagree, verify live DB state and application runtime state before changing logic

--------------------------------------------------

15. One-line Summary

Trips plan the program, Trip Sheets execute the work, assignments link users to execution, templates and cards seed creation-time defaults, and existing rows should be mutated explicitly from current DB state.


Stage 2A live preflight review (user-reported findings, 2026-10-09):
- Two active Admins; permission drift and membership drift both zero.
- Client TRUNCATE on profiles has already been revoked; do not reapply its SQL.
- `public.is_admin()` remains legacy-role-based; Stage 1 Admin helper uses both
  legacy role and is_admin. Existing enabled timestamp/Admin-protection triggers
  and direct legacy-role policies are consistent with the Stage 2A design.
- RLS is reported DISABLED on `trips`, `trip_sheets`, `trip_sheet_assignments`,
  and `destinations`. Track this existing authorization gap separately: policies
  do not enforce row restrictions while RLS is disabled. Actual exposure depends
  on effective grants/API exposure. The bridge adds no access path to these tables
  and does not enable RLS or redesign their policies.
- The complete preflight JSON was not included in the review request or available
  attachments. Full definitions/grants/Auth-hook compatibility and native concurrent
  transaction tests remain deployment gates. See
  `sql/verification/20261009_stage2a_live_review.md`.
