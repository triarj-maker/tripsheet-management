# Echo Journeys — Project Context

**Last Updated:** 2026-11-12

## Purpose and scope

Echo Journeys Trip Management supports travel-program planning and field execution. Trips are parent planning entities; Trip Sheets are child execution units assigned to people. The current implementation includes trip planning, templates and module cards, calendars and conflict indicators, Team administration, manual Trip notifications, tasks/comments, personal work views, and downloadable itineraries and resource schedules.

This document describes repository behavior. It does not certify production configuration. [DATABASE.md](DATABASE.md) distinguishes SQL evidence, application usage, and live-state gaps. [README.md](README.md) covers setup and checks; [AGENTS.md](AGENTS.md) contains agent rules. `DATABASE_CONTEXT.md` and older SQL runbooks remain historical references; their stage-specific statements are not the current authorization specification.

## Architecture

- Next.js 16 App Router, React 19, TypeScript and Tailwind CSS 4; hosted on Vercel.
- Supabase PostgreSQL is the data source of truth; Supabase Auth provides password-based identity and cookie-backed sessions through `@supabase/ssr`.
- Server-rendered pages query Supabase; server actions perform mutations. Browser clients are also present, so server guards must not be mistaken for database-wide isolation.
- FullCalendar supports scheduling. Resend sends manual notifications. Custom PDF utilities generate documents in memory without a browser/PDF dependency.
- The configured application timezone is `Asia/Kolkata` in `lib/time.ts`. Use its comparable timestamp/date helpers; do not mix wall-clock comparable timestamps with Unix instants.

## Permissions and workspaces

One person retains one Auth/profile UUID. Current permissions are independent Administrator access (`profiles.is_admin`) and Facilitator/Expert memberships (`profile_operational_roles`). Authorization requires an active profile. `profiles.role` is a derived compatibility projection, never authorization evidence or the Team form source.

| Account | Implemented access |
|---|---|
| Active Administrator | Full administrative workspace; can also be assigned and use personal views, including Admin-only accounts without operational memberships. |
| Active Facilitator / Expert | Own assigned work; card visibility is the union of operational memberships. |
| Inactive / missing profile | Denied application access. Administrators can still inspect inactive target accounts and their schedules. |

Team forms save independent checkboxes through the atomic `save_profile_permissions` RPC. Activation uses `set_profile_active`; permission changes do not recreate assignments. The system protects the final active Administrator. Creating an Auth account and its profile are separate operations: a profile failure preserves the Auth identity and reports its UUID for reviewed recovery.

Active Admins may select Admin View or Resource View. The validated, per-user browser cookie is a preference, not authorization. Admin deep links remain available regardless of that preference. Resource routes always retain personal scoping, even for Admins; personal Trip Sheet detail checks the logged-in user's assignment.

Admin navigation: Overview, Trips, Calendar, Companies, Schools, Templates, Team, Tasks, and Profile. Resource navigation: My Trips, My Trip Sheets, My Tasks, and Profile. On mobile the Admin view switcher has its own full-width row above workspace navigation. Navigation labels and retained route names differ: Team still uses `/dashboard/resources`, whose page heading currently says Resources.

## Trips, Trip Sheets, and assignments

Trips contain overall dates, destination, Educational/Private type, school/company relationships, participant counts, color, and workflow context. Trip Sheets contain session titles, dates/times, execution Markdown, transportation information, and module-card snapshots.

Assignments are stored in `trip_sheet_assignments` using `resource_user_id` and `trip_sheet_id`. Assignable users include active Admins, Facilitators, and Experts. Administrators manage all assignment changes; there is no acceptance, rejection, or availability workflow and no implemented per-session role selection.

Mutation rules:

- Read persisted state before computing changes; do not trust stale form values.
- When Trip dates actually change, shift existing child Trip Sheets with update semantics. Preserve duration, times, and execution body. Unrelated Trip edits must not shift children.
- Validate child dates against parent timelines; errors can originate in database triggers as well as application validation.
- `workflow_state` normalizes to tentative/active. Completed is derived from end date; archived is separate. Archive/restore actions update parent and child archive state. The retained auto-archive cron handler is disabled.
- Trip creation and archived-reference cloning are implemented in `app/dashboard/trips/actions.ts`; templates/cards provide reusable starting content.
- School/company relationships use IDs and lookup joins. Legacy `guest_name` / `company` text remains a display fallback, not the preferred filtering model.

## Template Library destinations and lifecycle

Create/Edit forms support an optional Destination from the existing destinations
lookup, saved as `trip_templates.destination_id`. Legacy null destinations remain
valid. Edit and Duplicate prefill the saved value. Duplicates retain the submitted
content and default times, copy source module-card metadata into new card rows,
and explicitly set `archived_at` to null even for archived sources. Edit does not
change archive state or existing Trip Sheets. Destination lookup failures block
the form rather than risk clearing a saved selection. Destination is template
metadata; this step does not change Trip Sheet creation or destination inheritance.

The owner reports the nullable destination FK (delete restrict), archive timestamp,
and indexes already applied manually. `sql/20261112_trip_templates_destination_archive.sql`
records that schema without execution here. Admin-only archive/restore actions update only `archived_at`, checking the current
record first and treating repeated requests as no-ops. The existing listing retains
its columns and Edit/Duplicate/Delete controls, adds Active/Archived badges and
Archive/Restore buttons, and keeps both states visible. Listing redesign is deferred.

The new/duplicate Trip Sheet form lists only active templates. Its server action
rechecks the selected template before insertion and rejects missing or archived
records, including stale or forged submissions. Blank-template creation remains
available. Archived templates remain inspectable/editable/duplicable through direct
Admin routes. Historical Trip Sheet references and snapshot content/cards are not
changed; existing Trip cloning/provenance flows are not redesigned.

## Calendars and assignment editing

Month view shows Trips; week view shows Trip Sheets. Clicking month-cell whitespace opens that week. Conflict indicators include conflicts hidden behind “+X more”; they must not depend on visible pills.

The weekly drawer stages assignment additions/removals locally until Save Changes calls `replaceTripSheetAssignments`. Compare users by `resource_user_id`, not assignment-row ID. Preserve pending/saving feedback. Other assignment entry points remain administrative; do not change them as a side effect of schedule presentation work.

## Resource Assignment Schedule

The Admin Resources table has Assignments and Edit links plus a compact secondary-action popover. Assignments is available for every profile, including Admins, and navigates using `profiles.id`.

`/dashboard/resources/[id]/assignments` is an Admin-only, read-only schedule. A server-only loader enforces `requireAdmin()` itself as well as serving the guarded page and PDF route. It validates UUIDs, handles absent/error results, and supports active and inactive target profiles.

The loader retrieves Trip Sheet assignments and non-archived Trip Sheets with parent Trip context. Shared utilities **filter sessions before grouping by `trip_id`**:

- Upcoming (default): ongoing/future sessions and undated sessions. Ongoing sessions sort first, then nearest starts; undated starts sort last.
- Past: completed sessions, most recently completed first.
- All: all non-archived assigned sessions, chronological by start.

Groups preserve their eligible sessions and count, earliest assigned start and latest assigned end, plus the separate actual Trip dates. A Trip spanning now may appear in both Past and Upcoming with different eligible sessions. Gaps do not imply continuous assignment. Date-only ends include the final minute of the day. Different Trips never merge merely because their school matches.

The page shows assigned dates, School / Trip, destination and session count. Accessible expand/collapse buttons reveal eligible session dates/times/titles and links to `/trip-sheets/[id]`, plus actual parent Trip dates. Counts and ranges reflect the current filter, not all historical assignments.

The independently protected `/dashboard/resources/[id]/assignments/pdf` endpoint uses the same loader/filter/grouping utilities. Download PDF preserves the selected filter. The A4 portrait export contains one summary row per Trip, resource name, generation date, selected filter, coverage clarification, repeated headings, and page numbers. It omits individual Trip Sheet details, account email, IDs, roles and administrative controls. Responses are attachments with `Cache-Control: no-store`. Built-in Helvetica normalizes accented Latin characters and replaces unsupported characters with `?`; it is not a multilingual-font pipeline.

No migration or Trip-level assignment record was needed. Assignments remain Trip Sheet-based; this grouping is presentation only.

## Resource View, content, tasks, and notifications

- **My Trips:** derives parent summaries from own assigned non-archived Trip Sheets; the summary utility shows ongoing/upcoming Trips, not full assignment history.
- **My Trip Sheets:** own flat execution list grouped into Ongoing, Upcoming and Past. Detail is execution-first: Trip Sheet context, module cards, instructions, then parent context. Existing personal queries are independent of the Admin schedule.
- **Markdown and cards:** bodies remain plain Markdown, safely rendered to web/PDF without automatic rewriting or stored generated HTML. Template cards are copied on creation; Trip Sheet cards are independent snapshots. URLs must be relative under `/module-cards/`. Admins see both card categories; membership unions govern resource visibility. Public static URLs are not access-controlled by this UI filtering.
- **Tasks:** Admin central list and Trip task sections support creation, assignment, editing, deletion, completion/reopening, and comments. An active assignee can see their own tasks, change completion status, and append comments. Overdue is derived from due timestamp and incomplete status. Comments are permanent except when the parent task is deleted. Tasks do not appear on calendars or generate notifications.
- **Notifications:** manual Trip-level sends only, currently allowed for active visible Trip state. One email per unique assigned user includes their relevant Trip Sheets; history records sends and recipients. The removed assignment-email queue/cron workflow must not be rebuilt implicitly.

## Project map

Paths below are source locations; bracketed segments are dynamic Next.js parameters.

| Area | Key routes / source modules |
|---|---|
| Login / recovery | `app/login/page.tsx`, `app/forgot-password/page.tsx`, `app/reset-password/page.tsx`, `app/auth/actions.ts`, `app/auth/recovery/route.ts` |
| Guards / navigation | `app/dashboard/lib.ts`, `lib/roles.ts`, `lib/interface-view.ts`, `app/lib/interface-view-cookie.ts`, `app/dashboard/AdminNav.tsx` |
| Supabase clients | `lib/supabase/server.ts`, `lib/supabase/client.ts`, `lib/supabase/admin.ts` |
| Admin overview / planning | `app/dashboard/overview/page.tsx`, `app/dashboard/trips/page.tsx`, `app/dashboard/trips/[id]/page.tsx`, `app/dashboard/trips/actions.ts` |
| Trip Sheets | `app/dashboard/trip-sheets/page.tsx`, `app/dashboard/trip-sheets/[id]/edit/page.tsx`, `app/dashboard/trip-sheets/actions.ts` |
| Shared execution detail | `app/trip-sheets/[id]/page.tsx`, `app/trip-sheets/[id]/TripSheetDetailPageContent.tsx`, `app/trips/[id]/page.tsx` |
| Calendar | `app/dashboard/calendar/page.tsx`, `app/dashboard/calendar/WeeklyTripSheetDrawer.tsx`, `app/dashboard/calendar/TripSheetCalendar.tsx` |
| Team / schedules | `app/dashboard/resources/page.tsx`, `app/dashboard/resources/actions.ts`, `app/dashboard/resources/[id]/assignments/page.tsx`, `app/dashboard/resources/[id]/assignments/ResourceScheduleRows.tsx` |
| Schedule data / PDF | `lib/resource-assignment-schedule.server.ts`, `lib/resource-assignment-schedule.ts`, `lib/resource-assignment-schedule-pdf.ts`, `app/dashboard/resources/[id]/assignments/pdf/route.ts` |
| Personal work | `app/my-trips/page.tsx`, `app/my-trip-sheets/page.tsx`, `app/my-trip-sheets/[id]/page.tsx`, `app/my-tasks/page.tsx`, `app/lib/assigned-trips.ts` |
| Tasks | `app/dashboard/tasks/page.tsx`, `app/tasks/data.ts`, `app/tasks/actions.ts`, `lib/trip-tasks.ts` |
| Lookups / templates | `app/dashboard/companies/page.tsx`, `app/dashboard/schools/page.tsx`, `app/dashboard/templates/page.tsx`, `app/dashboard/trip-sheets/template-card-copy.ts` |
| Itinerary / notifications | `app/dashboard/trips/[id]/pdf/route.ts`, `lib/pdf.ts`, `lib/client-itinerary-html.ts`, `app/dashboard/trips/trip-notifications.ts`, `lib/email.ts` |
| SQL / regression checks | `sql/`, `sql/verification/`, `sql/tests/`, `tests/resource-assignment-schedule.mjs` |

## Boundaries and evidence

The repository lacks a complete base schema. Application guards and scoped queries do not establish production RLS: historical reports say RLS was disabled on several operational tables, and the multi-role migration preserves existing enabled/disabled states. See [DATABASE.md](DATABASE.md) before security or schema work.

Stages 1/2A/2B/2C were reported deployed in prior project context; this documentation update did not inspect the live database or verify deployments. Old runbooks describe historical installation states. Current code uses independent permissions; do not reinstall the retired single-role bridge after independent roles exist.

No assignment acceptance/decline, availability negotiation, automated staffing/conflict resolution, or offline execution workflow is implemented.

## Recent Changes

| Date | Change | Description |
|---|---|---|
| 2026-11-12 | Implement template archive/restore | Documented idempotent Admin actions, temporary listing controls, active-only creation choices and server validation while retaining historical references. |
| 2026-11-12 | Add optional template destinations | Documented Create/Edit/Duplicate destination handling, preserved cards/defaults, unarchived copies, and the unexecuted schema synchronization record. |
| 2026-11-12 | Standardize current architecture and workflows | Reconciled independent permissions, tasks, workspace navigation and grouped resource schedules/PDF; added a verified project map and separated historical/live-state claims. |
