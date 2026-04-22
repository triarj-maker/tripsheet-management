AGENTS.md - Trip Sheet Management System

Updated: 04/08/2026

--------------------------------------------------

1. Purpose

Lean operational guidance for coding agents working in this repo.

Priorities:
- correctness over cleverness
- minimal, safe changes
- implementation aligned with current product behavior

This file is intentionally concise. It is not the full product context file.

--------------------------------------------------

2. Core Architecture

- Next.js App Router
- Supabase (PostgreSQL + Auth)
- Server actions for mutations

Primary model:
- Trips = parent planning entities
- Trip Sheets = child execution units
- Resources are assigned to Trip Sheets

Key relationship rules:
- Trip Sheets depend on Trips
- Parent Trip changes may drive child Trip Sheet changes
- When parent Trip dates change, existing child Trip Sheets may be shifted programmatically; update existing child rows, do not upsert them
- Child entities should not be updated unless required by the parent change or explicit user action

--------------------------------------------------

3. Calendar Model

- Month view shows Trips
- Week view shows Trip Sheets
- Month cell whitespace click drills into week view for the clicked week
- Month cells show conflict indicators even when conflicting items are hidden behind "+X more"

When editing calendar behavior:
- preserve month/week separation
- do not reintroduce pill-visibility-dependent conflict logic
- do not break whitespace click-to-week behavior

--------------------------------------------------

4. Assignment UX Rules

- Weekly calendar drawer uses staged local assignment editing
- Add/remove in that drawer should stay local until Save Changes
- Save commits through `replaceTripSheetAssignments`
- Do not reintroduce immediate mutation-per-click in the weekly drawer

Guidance:
- compare assignment sets by `resource_user_id`, not assignment row id
- prefer staged editing for repetitive inline assignment workflows
- keep visible pending/saving feedback for user-triggered mutations

--------------------------------------------------

5. Notifications

- Legacy automated notification system has been removed
- Current notification model is manual trip-level only
- Notification history is stored in:
  - `trip_notifications`
  - `trip_notification_recipients`

Do not rebuild old queue/cron/assignment-email patterns unless explicitly requested.

--------------------------------------------------

6. Resource Views and Roles

- Admins may also function as resources
- Admins must be able to access personal assignment views when assigned
- Personal views must remain scoped to the logged-in user's own assignments only
- Resource-facing views should be mobile-first

Do not expose admin-only controls in resource work views.

--------------------------------------------------

7. Mutation and Data Principles

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

--------------------------------------------------

8. Engineering Conventions

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

--------------------------------------------------

9. Documentation Maintenance

If architecture, UX patterns, or core workflow assumptions materially change:
- update the relevant context docs before closing the task
- keep `AGENTS.md` concise and implementation-focused
- keep deeper product reasoning in the broader context document, not here

--------------------------------------------------

10. One-line Summary

Trips are the parent planning layer, Trip Sheets are the execution layer, and mutations should stay DB-driven, explicit, and aligned with current UX patterns.
