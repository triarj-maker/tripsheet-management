# AGENTS.md — Echo Journeys Trip Management

**Last Updated:** 2026-11-12

## 1. Purpose

Lean operational guidance for coding agents working in this repo.

Priorities:

- correctness over cleverness
- minimal, safe changes
- implementation aligned with current product behavior

This file is intentionally concise. It is not the full product context file.

## 2. Core Architecture

- Next.js App Router
- Supabase (PostgreSQL + Auth)
- Server actions for mutations

Primary model:

- Trips = parent planning entities
- Trip Sheets = child execution units
- Facilitators and Experts are assigned to Trip Sheets
- Admins may also be assignable when operationally involved

Naming note:

- Business terminology is Admin / Facilitator / Expert
- Some legacy code/schema names may still use `resources` or `resource_user_id`
- Do not rename legacy routes, columns, or APIs unless explicitly requested

Key relationship rules:

- Trip Sheets depend on Trips
- Parent Trip changes may drive child Trip Sheet changes
- When parent Trip dates change, existing child Trip Sheets may be shifted programmatically; update existing child rows, do not upsert them
- Child entities should not be updated unless required by the parent change or explicit user action

## 3. Calendar Model

- Month view shows Trips
- Week view shows Trip Sheets
- Month cell whitespace click drills into week view for the clicked week
- Month cells show conflict indicators even when conflicting items are hidden behind "+X more"

When editing calendar behavior:

- preserve month/week separation
- do not reintroduce pill-visibility-dependent conflict logic
- do not break whitespace click-to-week behavior

## 4. Assignment UX Rules

- Weekly calendar drawer uses staged local assignment editing
- Add/remove in that drawer should stay local until Save Changes
- Save commits through `replaceTripSheetAssignments`
- Do not reintroduce immediate mutation-per-click in the weekly drawer

Guidance:

- compare assignment sets by `resource_user_id` where that remains the schema column, not assignment row id
- use assigned users / Facilitators / Experts in product-facing wording
- do not rename assignment schema unless explicitly requested
- prefer staged editing for repetitive inline assignment workflows
- keep visible pending/saving feedback for user-triggered mutations

## 5. Schools and Companies

- `companies` and `schools` are lookup tables
- Trips use `company_id` and `school_id`
- Use ID-based filtering/querying for company and school relationships
- Avoid reintroducing legacy free-text filtering unless explicitly requested

## 6. Module Cards and Markdown Bodies

- `template_cards` belong to templates
- `trip_sheet_cards` belong to trip sheets
- Template cards are copied into Trip Sheet cards at Trip Sheet creation
- Trip Sheet cards are independent snapshots after creation
- Do not auto-sync cards from templates to existing Trip Sheets
- Store only relative module-card URLs under `/module-cards/...`
- Do not store or render HTML bodies from the database

Body text:

- Template and Trip Sheet body text is stored as Markdown text
- Do not change schema to store generated HTML
- Render Markdown safely
- Do not mutate stored Markdown automatically
- Keep PDF and web rendering consistent where applicable

## 7. Notifications

- Legacy automated notification system has been removed
- Current notification model is manual trip-level only
- Notification history is stored in:
  - `trip_notifications`
  - `trip_notification_recipients`

Do not rebuild old queue/cron/assignment-email patterns unless explicitly requested.

## 8. Roles and Assigned Work Views

- Roles are `admin`, `facilitator`, and `expert`
- Current code uses Stage 2B/2C independent permissions (deployment previously
  user-reported; not live-verified here): active status, is_admin and operational
  memberships. Do not authorize by legacy role.
- Team permissions use independent Admin / Facilitator / Expert checkboxes and the
  atomic `save_profile_permissions` RPC. Do not infer permissions from or write
  the legacy role directly.
- See `sql/verification/20261009_stage2b_runbook.md` for transition/rollback.
- Preserve Auth users after profile-creation failures; report the existing Auth
  UUID for reviewed recovery. Never automatically delete/recreate the identity.
- Admin = full access
- Facilitator / Expert = assigned work access
- Admins may also access personal assigned-work views when assigned
- Active Admins may select Admin View or Resource View. The browser cookie is a
  per-user UI preference only; every route/action must still authorize from profile data.
- Admin deep links remain available regardless of the preferred view. Resource routes
  always retain personal assignment scoping and display the Resource navigation.
- Keep My Trips/My Trip Sheets out of Admin View navigation; use the full-width
  mobile switcher above the workspace navigation so Admins can always change views.
- Personal views must remain scoped to the logged-in user's own assignments only
- Facilitator/expert-facing views should be execution-first and mobile-first
- Assigned work pages should prioritize Trip Sheet context, module cards, and execution body before parent Trip context

Do not expose admin-only controls in Facilitator / Expert work views.

## 9. Mutation and Data Principles

- Database is the source of truth
- Fetch current DB state before computing mutations where relevant
- Do not trust stale client/form state for persisted values
- Do not assume DB constraints fully enforce business logic
- Keep mutation logic deterministic and explicit
- Prefer `update` for existing rows; use `upsert` only for true create-or-update behavior
- Avoid partial `upsert` payloads unless intentional, since they can trigger insert-style DB validation/constraint paths

For trip date changes:

- fetch the existing Trip from DB first
- compute whether dates actually changed
- only shift child Trip Sheets when parent dates changed
- shift existing child Trip Sheets with update semantics, not upsert
- preserve child duration, `start_time`, `end_time`, and `body_text`

Database validation awareness:

- mutation errors may originate from DB triggers/functions, not just application code
- error messages may identify a DB validation path, not the true app-level failure step
- trace mutation failures across fetch → compute → write before changing behavior

## 10. Engineering Conventions

- Keep changes minimal and targeted
- Avoid unrelated refactors
- Do not change DB schema unless explicitly instructed
- Prefer existing repo patterns over introducing new architecture
- Preserve working flows unless the task explicitly changes them

Debugging guidance:

- prefer targeted instrumentation/runtime verification before implementing fixes
- verify DB state vs runtime state when behavior and inspected data disagree
- isolate the failing step (fetch → compute → write) before changing logic

High-signal folders:

- `app/dashboard/trips/`
- `app/dashboard/trip-sheets/`
- `app/dashboard/calendar/`
- `app/my-trip-sheets/`

## 11. Feature Lifecycle and Documentation Policy

Read relevant documentation before implementation. Keep these core references
concise and avoid duplication or additional Markdown files without a clear need:

| File | Responsibility |
|---|---|
| [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) | Product capabilities, workflows, architecture/modules, permissions and business decisions. |
| [DATABASE.md](DATABASE.md) | Supabase structure, relationships, constraints/indexes, Auth/RLS, migrations and verified schema changes. |
| [README.md](README.md) | Overview, development setup/environment, testing commands, build and deployment. |
| `AGENTS.md` | Codex instructions, coding conventions, testing expectations and lifecycle/documentation policy. |

Older `DATABASE_CONTEXT.md` and stage-specific runbooks are historical; retired
installation/recovery instructions are not current policy.

### Lifecycle signals

- **IN PROGRESS (default):** Implement the requested scope, run relevant checks,
  and report changes, validation and unresolved issues. Do not automatically edit
  Markdown after prompts, small UI changes, intermediate steps or routine bug fixes.
  Task completion or passing tests does not mean feature completion; never declare
  an entire feature complete independently.
- **FEATURE COMPLETE:** Trigger only when the user explicitly declares
  `FEATURE COMPLETE` for the feature (not when merely quoting/discussing this
  policy). Review the whole implementation against its requirements, verify relevant
  functionality, identify gaps, and update only affected documentation. Consolidate
  related steps into one concise feature-level change-log entry per affected file;
  correct outdated/contradictory descriptions and update modified documents' dates.
  Additionally report documentation files/changes, remaining inconsistencies, and
  verification gaps. Distinguish verified behavior from unverified behavior.
- **RELEASED:** Trigger only when the user explicitly declares `RELEASED` for the
  feature. Review deployment/operational documentation and record significant
  release-related changes where appropriate, without duplicating feature content.
  Report relevant deployment-documentation changes. Never infer deployment or
  production validation without explicit confirmation.

The Template Library improvement is **IN PROGRESS**. Consolidate its documentation
only when the user explicitly declares `FEATURE COMPLETE`; this policy change does
not update or consolidate its existing documentation.

### Exceptions before feature completion

Update documentation earlier only when explicitly requested by the user, or when:

- Required schema information must be recorded with a database change to prevent
  migration drift; defer broader feature consolidation until completion.
- A significant architecture change invalidates existing instructions.
- Incorrect documentation could cause implementation errors.

Describe the final implemented application, not intermediate plans or step history.
Use Git and pull requests for detailed history. Normal IN PROGRESS reports need
only implementation changes, checks/results, and unresolved issues/limitations;
include documentation changes when an exception or explicit request applies.

### Dates and recent changes

Every core document maintains `**Last Updated:** YYYY-MM-DD` and a
`## Recent Changes` table with `Date`, `Change`, and `Description` columns.
Use the actual documentation-change date in ISO format. Keep the 10 most recent
meaningful entries, newest first; prefer one consolidated entry per completed
feature, not one per prompt/step. Update dates only for meaningful document changes;
do not add entries to untouched documents or fabricate history/dates. Git remains
the authoritative complete change history.

## 12. One-line Summary

Trips are the parent planning layer, Trip Sheets are the execution layer, Facilitators and Experts execute assigned work, and mutations should stay DB-driven, explicit, and aligned with current UX patterns.

## Recent Changes

| Date | Change | Description |
|---|---|---|
| 2026-11-12 | Establish feature lifecycle policy | Replaced task-by-task documentation updates with explicit completion/release signals, narrow early-update exceptions and consolidated feature change logs. |
| 2026-11-12 | Standardize documentation maintenance | Established four core references, dates/change-log rules and a completion checklist while preserving engineering and workflow safeguards. |
