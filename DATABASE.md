# Echo Journeys — Database Reference

**Last Updated:** 2026-11-12

## Scope and evidence

Supabase PostgreSQL holds application data; Supabase Auth holds identities in `auth.users`. The repository contains incremental SQL in [sql/](sql/), not a complete schema dump or empty-project bootstrap. No live database inspection was performed for this baseline.

Evidence labels throughout this document:

- **DDL:** verified in repository migration definitions, not proof they are installed or unchanged in production.
- **App:** verified from queries, types or mutations; does not prove SQL types, primary keys, foreign keys, nullability, indexes or constraints.
- **Live unknown:** not verified against current production metadata/grants/policies.

[PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) covers business behavior; [AGENTS.md](AGENTS.md) covers coding rules. `DATABASE_CONTEXT.md` is an older reference retained unchanged. Its mixed Stage 1/2A descriptions must not override this current reference or the implementation.

## Access architecture

`lib/supabase/server.ts` creates a cookie-backed SSR client with the public API key; `lib/supabase/client.ts` supplies browser access. Server actions handle mutations. `lib/supabase/admin.ts` is server-only and uses the service-role key for explicitly guarded administrative operations; this credential must never reach browser code. Service access bypasses ordinary RLS and needs its own application authorization.

`app/dashboard/lib.ts` retrieves the authenticated user with `auth.getUser()`, loads their profile plus memberships, and rejects missing/inactive profiles. `requireAdmin()` requires active `is_admin`; assigned-work helpers allow active Admins or Facilitator/Expert memberships. Personal queries explicitly scope assignments/tasks to the logged-in UUID, including when that user is an Admin. These guards do not establish direct Data API row isolation.

## Core tables

### `profiles`

**Purpose:** application identity, contact details and independent Admin permission.

- **App identity/key:** `id`, the UUID corresponding to `auth.users.id`. Profile/Auth identity is used throughout the application. The base table DDL is absent: its actual PK/FK declaration, Auth delete action and original indexes remain **live unknown**.
- **App columns:** `full_name`, `email`, `phone`, `role`, `is_active`, `created_at`; `updated_at` is referenced by SQL protections. Do not infer their exact SQL types/defaults from TypeScript.
- **DDL addition:** `is_admin boolean not null default false` in [multi-role foundation](sql/20261009_multi_role_foundation.sql).
- Current permissions are `is_active` plus `is_admin` and memberships. `role` is a compatibility projection, not the authorization source.
- [Independent authorization SQL](sql/20261009_multi_role_authorization.sql) installs permission/identity guards and RPCs, preserves timestamps/serialization, prevents final-active-Admin removal, and rejects active non-admins without operational memberships. Inactive/no-role and Admin-only accounts are valid.

### `operational_roles` and `profile_operational_roles`

**Purpose:** role catalogue and independent many-to-many profile memberships. **DDL** in [foundation SQL](sql/20261009_multi_role_foundation.sql):

| Table | Key and verified columns | Relationships / indexes |
|---|---|---|
| `operational_roles` | PK `code text`; `label text not null`; `is_active boolean not null default true` | Seeds `facilitator`, `expert`. Catalogue activity is stored; current app helpers recognize membership codes and profile activity, not a joined catalogue-activity check. |
| `profile_operational_roles` | Composite PK `(profile_id, role_code)`; `profile_id uuid not null`, `role_code text not null` | FK to `profiles(id)` with cascade delete; FK to `operational_roles(code)` restrict delete; index `profile_operational_roles_role_code_idx`. |

Admin permission does not infer membership. Team form saves use `save_profile_permissions`; direct flag/membership writes are guarded after Stage 2B. Do not interpret the permissive historical Stage 1 write policies as permission to bypass the current RPC guards.

### `trips`

**Purpose:** parent planning program. **DDL** in [parent refactor](sql/20260401_trips_parent_refactor.sql):

- PK `id uuid default gen_random_uuid()`.
- `title text not null`; `trip_type text not null`, checked to `educational` / `private`.
- `destination_id uuid not null` FK to `destinations(id)`.
- `created_by uuid` and `last_updated_by uuid` FKs to `auth.users(id)`.
- `created_at`, `updated_at`: `timestamptz not null default now()`; update timestamp trigger.
- Indexes `idx_trips_trip_type`, `idx_trips_destination_id`.
- **Later DDL:** nullable `company_id uuid` / `school_id uuid` FKs and corresponding indexes, from [lookup migration](sql/20260507_companies_schools_lookup_tables.sql).
- **App-only additions/usage:** `start_date`, `end_date`, `trip_color`, `adult_count`, `kid_count`, `phone_number`, `workflow_state`, `is_archived`, `guest_name`, `company`. Their current SQL types/defaults/checks are not established by the available migrations. Dates are consumed as date strings, workflow as tentative/active, archive as a separate flag; completed is derived by the app.

### `trip_sheets`

**Purpose:** child execution/session units. Base DDL is absent.

- **App identity/key:** `id`; exact base PK declaration is not present.
- **DDL:** nullable `trip_id uuid references trips(id) on delete cascade`, with `idx_trip_sheets_trip_id`, added in the parent refactor. App creation requires a parent; that does not prove database NOT NULL enforcement.
- **DDL:** optional `transportation_info text`, from [transportation migration](sql/20260409_trip_sheets_transportation_info.sql).
- **DDL:** unique index `trip_sheets_id_trip_id_key` on `(id, trip_id)`, installed by [task migration](sql/20261010_trip_task_management.sql) for the same-Trip task FK.
- **App columns:** `title`, `start_date`, `start_time`, `end_date`, `end_time`, `template_id`, `body_text`, `is_archived`. Exact types and any `template_id` FK are unverified.
- The early parent-refactor SQL drops the child title, while current code reads/writes it. The repository does not include a complete subsequent schema history; do not replay that refactor on a current database.
- Markdown bodies and copied cards are independent snapshots after creation. Parent date shifts update existing child rows, preserving duration, times and body.

### `trip_sheet_assignments`

**Purpose:** link assigned user identities to Trip Sheets. Base DDL is absent.

- **App identity/key:** `id` identifies assignment rows; PK constraint/type is unverified.
- **App columns:** `resource_user_id`, `trip_sheet_id`, `assigned_by`, `created_at`. IDs are used as UUIDs; exact column types, nullability and timestamp type require live metadata.
- **App relationships:** `resource_user_id` identifies the same UUID used by `profiles.id` / Auth; `trip_sheet_id` identifies `trip_sheets.id`; `assigned_by` identifies the assigning user. The original FK targets/actions and unique/index constraints are not available. Synthetic test fixtures are not production-schema evidence.
- Current queries/mutations contain no per-assignment role or acceptance/rejection status. Their absence from the live schema cannot be proven without the base DDL.

### `destinations`

**Purpose:** destination lookup for Trips. **App** uses `id` and `name`; the Trip destination FK is **DDL-verified** above. Destination base DDL, exact column types, PK declaration, constraints and indexes remain unknown.

### `companies` and `schools`

**Purpose:** customer/partner lookup records. **DDL** in [lookup migration](sql/20260507_companies_schools_lookup_tables.sql), identical structure:

- PK `id uuid default gen_random_uuid()`; `name text not null`.
- `is_active boolean not null default true`.
- `created_at`, `updated_at`: `timestamptz not null default now()`; update timestamp triggers.
- Name indexes: `idx_companies_name`, `idx_schools_name`; the migration does **not** declare name uniqueness.
- Nullable Trip FKs `company_id` / `school_id`; indexes `idx_trips_company_id`, `idx_trips_school_id`. No explicit cascading delete action is declared for these FKs.
- [Backfill SQL](sql/20260507_backfill_company_school_lookups.sql) uses legacy customer text without removing it. Prefer IDs for filtering and current lookup labels for display; legacy text remains a fallback.

## Templates, cards, notifications and tasks

### `trip_templates`

**Purpose:** reusable Trip Sheet defaults. Base DDL is absent; **App** uses `id` as identity plus `title`, `body`, and richer defaults. Base PK and body type are unverified.

**DDL:** [richer defaults](sql/20260422_trip_templates_richer_defaults.sql) add nullable `heading text`, `default_start_time time without time zone`, `default_end_time time without time zone`. [Title migration](sql/20260402_trip_templates_title_limit.sql) targets a 50-character limit through varchar expansion or a check, depending on the existing column type; verify actual installed constraints rather than assuming one representation. Templates and their cards seed new sheets; existing sheets do not auto-sync.

**DDL synchronization record:** [template destination/archive migration](sql/20261112_trip_templates_destination_archive.sql)
records nullable `destination_id uuid references destinations(id) on delete restrict`
and nullable `archived_at timestamptz`, with `idx_trip_templates_destination_id` and
`idx_trip_templates_archived_at`. The owner reports equivalent changes already
applied manually; this file was not executed against any database during this task.
Actual live constraint/index names and definitions have not been inspected.
`ADD COLUMN IF NOT EXISTS` skips an existing column and therefore does not repair a
missing or mismatched FK/type/nullability. Index `IF NOT EXISTS` is name-based and
does not detect equivalent differently named indexes; compare metadata before any
future application. This is a synchronization record, not a pending production action.

**App:** Create/Edit accept null or an existing destination UUID; Edit preserves
archive state. Duplicate prefills destination, copies cards under the new template,
and explicitly inserts `archived_at = null`. Content/default-time editing and card
snapshots remain independent of existing Trip Sheets. The copy uses sequential
writes, not a database transaction: on card-copy failure it attempts to delete only
the newly created template; if cleanup fails it links to that template for review.
**App lifecycle:** Admin-only archive/restore fetch the target template and update
only `archived_at` (current ISO timestamp / null). Repeated same-state requests do
not write or replace an existing timestamp. Conditional writes guard the observed
archive state, and successful actions invalidate the listing, edit route, and
creation picker. No cards or existing Trip Sheets are mutated. The library retains
archived records and their direct Edit/Duplicate access; duplicate inserts remain active.

The new Trip Sheet picker uses `archived_at IS NULL`; `createTripSheet` independently
fetches current template state and rejects missing/archived selections before insert.
Historical template references remain valid and are not globally filtered from joins.
This is an application-level guard, not a new database constraint/RLS policy or
cross-request transaction; concurrent archive/create requests are not serialized by
this change. No schema change or migration execution accompanies archive/restore.

### `template_cards` and `trip_sheet_cards`

**Purpose:** module-card metadata. **DDL** in [module-card migration](sql/20260526_module_playbook_cards.sql):

- Each has PK `id uuid default gen_random_uuid()`; parent FK `template_id uuid not null` → `trip_templates(id)` or `trip_sheet_id uuid not null` → `trip_sheets(id)`, cascade delete.
- `trip_sheet_cards.source_template_card_id uuid` → `template_cards(id)`, set null on delete; traceability only.
- Both: `title text not null`, `category text not null`, `card_url text not null`, `sort_order integer not null default 0`, `created_at` / `updated_at timestamptz not null default now()`.
- Checks enforce nonblank title/URL, category in facilitator/expert, URL beginning `/module-cards/`. They store relative URLs, not generated HTML bodies.
- Parent and `(parent, sort_order)` indexes, source-template-card index, and timestamp triggers are declared.

### `trip_notifications` and `trip_notification_recipients`

**Purpose:** manual Trip-send history and recipient results. **DDL** in [notification migration](sql/20260406_trip_notifications.sql):

| Table | Verified key and important columns | Relationships / constraints |
|---|---|---|
| `trip_notifications` | PK `id uuid`; `trip_id uuid not null`, `sent_by_user_id uuid not null`; `sent_at`, `created_at timestamptz`; integer recipient/success/failure counts; `status text`; optional `subject text` | Trip FK cascade; sender FK `auth.users(id)`; status success/partial_failure/failed; Trip and sent-time indexes. |
| `trip_notification_recipients` | PK `id uuid`; `trip_notification_id uuid not null`, `resource_user_id uuid not null`; `email text not null`, `delivery_status text not null`, optional `error_message text`, `created_at timestamptz` | Notification FK cascade; recipient FK `auth.users(id)`; status sent/failed/skipped; notification and recipient indexes. |

Both UUID PKs default to `gen_random_uuid()`; timestamp columns above default to `now()` and are NOT NULL. This is not a notification queue or acceptance workflow.

### `trip_tasks` and `trip_task_comments`

**Purpose:** administrative tasks and assignee execution/comments. **DDL** in [task migration](sql/20261010_trip_task_management.sql):

- `trip_tasks`: PK `id uuid default gen_random_uuid()`; required `trip_id uuid` FK to Trips (cascade); optional `trip_sheet_id uuid`; optional `assigned_to uuid`, required `created_by uuid`, optional `completed_by uuid`, all profile FKs.
- Composite FK `(trip_sheet_id, trip_id)` → `trip_sheets(id, trip_id)` enforces same-parent linkage when a sheet is supplied.
- `title text not null` (nonblank, ≤200 chars), optional `description text` (≤10,000), optional `due_at timestamptz`, `status text not null default 'pending'` (pending/completed), optional `completed_at timestamptz`; `created_at` / `updated_at timestamptz not null default now()`.
- Completion check ties completed state to completion actor/time. Triggers manage completion metadata and restrict assignees to completion/reopening; assignment targets must be eligible active Team members when assigned/reassigned.
- Indexes on Trip, Trip Sheet, `(assigned_to, status, due_at)`, `(status, due_at)`.
- `trip_task_comments`: PK `id uuid default gen_random_uuid()`; required `task_id uuid` FK cascade, required `author_id uuid` profile FK, required nonblank `body text` (≤4,000), `created_at timestamptz not null default now()`; `(task_id, created_at)` index. Append-only except parent-task cascade deletion.

### Private implementation objects

`multi_role_private` contains serialization/permission-guard helpers and internal write-scope tables, including `stage2a_write_lock` and `permission_write_scope`. These are internal controls, not application entities or public APIs. Keep the private schema outside exposed Data API schemas; consult [authorization SQL](sql/20261009_multi_role_authorization.sql) before changes.

## Resource assignment schedules

Resources use existing user/profile UUIDs. One Trip has many Trip Sheets; assignments link `resource_user_id` to `trip_sheet_id`. The [server-only loader](lib/resource-assignment-schedule.server.ts) authorizes the caller, retrieves the target profile, reads assignment IDs, and retrieves non-archived Trip Sheets with Trip/destination/school/company joins. No second assignment query is introduced for grouping or PDF rendering.

[Shared utilities](lib/resource-assignment-schedule.ts) filter individual sessions, then group by parent `trip_id`. Groups retain eligible sessions/count, earliest/latest assigned dates, and separate actual Trip dates. The same utilities supply HTML and PDF; gaps are not continuous assignment and a school name is not a grouping key. No Trip-level assignment record or migration was required. Current permissions are displayed as account attributes, never inferred as individual assignment roles.

## Authorization, RPCs and RLS

**Current application:** active Admin flag and operational memberships are authoritative. `save_profile_permissions(uuid,text,text,boolean,text[],boolean,text)` saves ordinary fields and the complete permission set atomically. Non-null email selects create-only; null selects update-only. `set_profile_active(uuid,boolean)` preserves independent permissions. Auth creation remains separate; preserve/report the existing Auth UUID on profile failure. `save_team_profile` is retired.

**Repository DDL evidence:**

| Tables | RLS / policy declarations in SQL |
|---|---|
| `trips`, `companies`, `schools`, `template_cards`, `trip_sheet_cards` | Migrations enable RLS and allow authenticated SELECT; administrative writes. Historical predicates using legacy role are replaced where recognized by Stage 2B SQL. These read policies are not personal-assignment-only policies. |
| `trip_notifications`, `trip_notification_recipients` | Migration enables RLS with administrative read/write policies. |
| `operational_roles`, `profile_operational_roles` | Foundation enables RLS; authenticated catalogue reads, own-or-Admin membership reads, Admin membership writes. Stage 2B updates helper semantics and adds independent write guards. |
| `trip_tasks`, `trip_task_comments` | Migration enables RLS; active Admin or active task-assignee reads. Admin creates/edits/deletes tasks; assignee updates are trigger-restricted to status. Comments require a visible task and authenticated author; no direct update/delete grant. |
| Base `profiles`, `trip_sheets`, `trip_sheet_assignments`, `trip_templates`, `destinations` | Complete original RLS setup is absent. Later permission guards do not prove complete base row-access policy coverage. |

**Production uncertainty:** historical user-supplied findings in the [Stage 2A review](sql/verification/20261009_stage2a_live_review.md) report RLS **disabled** on `trips`, `trip_sheets`, `trip_sheet_assignments`, and `destinations`. Stage 2B preserves existing enabled/disabled states. No current live check supersedes that report here. Policies on disabled tables do not filter rows; exposure also depends on grants/API configuration. Browser clients, application guards, and passing mocked tests cannot prove database isolation. Public static module-card URLs are outside database RLS.

The [Stage 2B runbook](sql/verification/20261009_stage2b_runbook.md) records user-reported deployment of Stages 1/2A/2B/2C. This is historical reported status, not an independent inspection. Do not rerun the Stage 1 or Stage 2A installation after independent permissions exist.

## Schema management and verification

- Incremental files use date-prefixed names in `sql/`; operational guides and read-only checks live in `sql/verification/`; disposable database tests live in `sql/tests/`.
- There is no repository migration npm script, complete `supabase/migrations` bootstrap, or verified automated apply command. Existing runbooks use reviewed, complete SQL transactions in Supabase SQL Editor as postgres. Do not invent a CLI workflow or execute all files in date order: some are historical transitions, backfills or rollback scripts.
- Before a change, inspect live schema types/defaults, constraints, triggers/functions, policies, effective grants, migration history and relevant rows. Save appropriate backups/snapshots, rehearse on disposable data, and follow the feature-specific deployment/rollback guide.
- Run corresponding read-only verification SQL after approved application. Metadata checks do not prove runtime access, native concurrent transactions or historical row preservation without supporting evidence.
- The task rollback refuses removal when task data exists. Permission rollback must preserve independent memberships and Auth identities; use the current Stage 2B runbook, not old single-role recovery templates.
- The schedule feature introduced no schema changes. Do not add assignment statuses, rename legacy columns, or use partial upserts merely to support presentation changes.

### Remaining verification gaps

Obtain a current, reviewed schema-only export or read-only catalog report before claiming a complete ERD: original profile/Auth and assignment FKs/PKs, destination/template definitions, missing Trip/Trip Sheet alterations, exact date/time types, uniqueness/indexes, RLS enabled flags, grants, Auth hooks, and installed migration versions remain incomplete or unverified. Do not substitute SQL test fixtures for this evidence.

## Recent Changes

| Date | Change | Description |
|---|---|---|
| 2026-11-12 | Document template lifecycle access | Recorded timestamp-only archive/restore, idempotence, active-template creation guards and preservation of historical references without schema changes. |
| 2026-11-12 | Record template destination/archive schema | Added owner-reported manual schema changes, the unexecuted migration, nullable destination use and duplicate archive/card-copy behavior, with live-metadata caveats. |
| 2026-11-12 | Establish evidence-based database baseline | Created current table/relationship, permission/RLS and schema-management reference; documented presentation-only Trip grouping and explicit live-schema gaps. |
