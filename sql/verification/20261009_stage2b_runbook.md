# Stage 2B/2C — combined multi-role release

Production status supplied by the user: Stage 1 and the Stage 2A database bridge
are applied and validated. The production Vercel app is still the older single-role
app. Neither the Stage 2A app changes nor Stage 2B have been deployed. Do not change
production during Stage 2B development. The current production app stays compatible
with the installed Stage 2A bridge until the coordinated cutover.

## Authority and compatibility

Active Admin = `profiles.is_admin IS TRUE AND profiles.is_active IS TRUE`.
Operational permission = active profile plus Facilitator and/or Expert memberships.
Admin permission does not infer memberships. Admin-only users remain assignable.
One Auth UUID/profile identity is retained; no assignment migration is involved.

The application fetches profile permissions with embedded memberships in one query.
All independent Admin checks (including schedule/assignment actions, notifications
and PDF service-client guards) use the flag/active state. Pickers filter profiles,
not joined membership rows, and deduplicate IDs. Removing permission does not remove
an existing assignment. Personal Trip Sheet detail always checks the current user's
assignment, including Admins. Administrative detail access retains the Admin bypass.
Trip timelines remain complete with the existing own-assignment highlights/layout.

Module-card category selection uses the union of memberships; Admins see both
categories. Existing public module-card URLs are unchanged. Visibility filtering
is not a redesign of public static asset access or unrelated operational RLS.

`profiles.role` remains a deterministic display/old-client compatibility projection:
Admin if is_admin, otherwise Facilitator if held, otherwise Expert. An inactive
profile with no permissions retains the required text column as Facilitator. This
fallback does not grant any application permission. It is never read by the new
authorization helpers. Do not directly edit that column or the flag/membership set.

## Atomic permission API

`save_profile_permissions(id, full_name, phone, admin, roles[], active, email)` is
the sole Team create/edit permission RPC. The Stage 2C forms send the complete
independent selection rather than a scalar role. Non-null email means create-only;
null means update-only. Auth account creation still happens separately; failure
preserves the Auth identity and reports its UUID. No partial upsert, automatic Auth
deletion or assignment mutation occurs. `set_profile_active(id, active)` preserves
the current independent permissions. The scalar `save_team_profile` adapter is
removed so no legacy-shaped RPC can overwrite a multi-role configuration.

Both RPCs serialize writers using the existing private Stage 2A lock row,
then reauthorize the caller. A private transaction/profile capability permits only
the RPC's guarded writes; it is not a user-settable GUC. Direct API/service writes
to permission fields/memberships fail. Ordinary profile edits still follow existing
RLS. Last-active-Admin removal fails, including through the RPC/service path.
Inactive/missing profiles cannot administer. Profile IDs and deletions remain guarded.
Only postgres/service recovery or an active authenticated Admin can call these writes.

## Migration

`sql/20261009_multi_role_authorization.sql` is the entire transactional Stage 2B
migration. It replaces both Admin helper bodies, retires the legacy sync/guards,
installs independent guards/constraints/RPCs, and leaves timestamp and serialization
triggers intact. A pre-existing `is_active_resource(uuid)` helper is replaced in
place with active Facilitator/Expert membership semantics; its dependencies, owner,
grants and argument name remain intact. It changes no existing profile or assignment rows. Reruns preserve
multi-role data. Never rerun Stage 1 or Stage 2A after this transition.

For inline RLS, it replaces recognized `profiles.role = 'admin'` predicates with
flag-and-active predicates, preserving commands, roles, permissiveness and all other
conditions. Unrecognized legacy-role policy expressions or additional public helper
bodies cause rollback with the offending policy/function name. Resolve an actual
reported case locally; never skip the check. Existing tables with RLS disabled stay
that way. Stage 2B does not enable RLS or expand grants on operational tables.

## Combined Stage 2B + Stage 2C deployment order

1. Use the completed Stage 2B/2C application and run the combined tests/build.
   Rehearse the exact migration against a disposable copy of the production schema.
2. Enter maintenance: block mutation endpoints and drain old app instances/jobs,
   particularly Auth creation, Team writes and in-flight administrative operations.
   A hidden button or instruction to stop clicking is not an enforcement boundary.
   Keep users in maintenance while database/app versions differ.
3. Capture profile, membership, complete assignment and Auth-ID snapshots and current
   policy definitions. Confirm at least one active Admin and correct Stage 2A state.
4. Apply the entire Stage 2B SQL transaction in SQL Editor as postgres. Do not apply
   the already-completed TRUNCATE correction. Unknown policies/functions or errors
   roll back the transaction; do not deploy past a failed migration.
5. Run `20261009_stage2b_validation.sql` and compare snapshots. The two historical/
   runtime WARNING rows need supporting evidence; metadata cannot prove them.
6. Deploy the combined Stage 2B/2C app through the normal GitHub/Vercel workflow.
   Drain old instances and invalidate stale write entry points. Confirm the new
   deployment uses the RPCs before reopening mutations.
7. Smoke-test Admin/resource login, all seven combinations, Team creation/editing,
   assigned-work scoping, pickers, cards, calendar and notification/PDF authorization.
   Use controlled test accounts; do not demote actual production Admins for testing.
8. Reopen only after successful database validation and app smoke tests.

The new app must not be deployed against Stage 2A: its Team RPCs do not exist there.
After this migration an old app's role/active/creation writes are intentionally
rejected, preventing stale code from overwriting independent permissions. Read-only
legacy Admin selection remains compatible through projection, but old resource card
views cannot express both roles. Maintenance covers this transition period; there
is no claim of a safe mixed-version zero-downtime deployment.

## Recovery and rollback

After Auth creation/profile failure, verify the reported Auth UUID and email. If
its profile exists, inspect it rather than overwriting it (the commit may have
succeeded despite a lost response). If absent, an authorized operator uses
`save_profile_permissions` with that SAME UUID and verified ordinary fields/email.
Direct profile INSERT from the old Stage 2A recovery template
is retired. Do not delete/recreate Auth users or reassign existing work.

A failed migration is atomic and leaves Stage 2A in place. After a successful
transition, roll back only to an app build using these independent RPCs and retaining
the Auth-preservation fix. Keep the Stage 2B database protections. Do not reinstall
Stage 2A synchronization: it could erase multi-role permissions. If there is no
compatible app rollback build, remain in maintenance and fix forward. Preserve
legitimate permissions/assignments; do not restore old operational rows blindly.

## Local verification

```
node sql/tests/multi-role-foundation.mjs /absolute/path/to/pglite/dist/index.js
node sql/tests/multi-role-final-validation.mjs /absolute/path/to/pglite/dist/index.js
node sql/tests/multi-role-compatibility-bridge.mjs /absolute/path/to/pglite/dist/index.js
node sql/tests/multi-role-authorization.mjs /absolute/path/to/pglite/dist/index.js
node tests/stage2a-team-actions.mjs
node tests/multi-role-permissions.mjs
npx tsc --noEmit
npm run lint
npm run build
```

The Team action regression runner now exercises the same failure/authorization
contracts through the Stage 2C independent-permission RPC. Historical SQL tests
continue to run their original
migrations in isolated fixtures. PGlite is single-session; native concurrency tests
remain recommended, not a newly introduced deployment blocker per user direction.
No live SQL, account changes, pushes or deployments are part of this task.

## Recorded local results

TypeScript, full lint, production Next.js build and `git diff --check` pass.
All 550 assertions pass: Stage 1 foundation 84, Stage 1 validator 49, Stage 2A
bridge 81, Stage 2B/2C database and validator 69, Team actions 147, and multi-role
application guards, Team labels, personal routes and calendar preservation 120. These are local
results, not a claim of production migration or browser smoke-test completion.

## Combined Stage 2B/2C file manifest

Authorization, login and navigation:
- `lib/roles.ts`
- `app/dashboard/lib.ts`
- `app/auth/actions.ts`
- `app/login/page.tsx`
- `app/page.tsx`
- `app/dashboard/AdminNav.tsx`
- `app/components/InstallHomeScreenHint.tsx`
- `app/dashboard/page.tsx`

Team and assignment consumers:
- `app/dashboard/resources/actions.ts`
- `app/dashboard/resources/page.tsx`
- `app/dashboard/resources/new/page.tsx`
- `app/dashboard/resources/[id]/edit/page.tsx`
- `app/dashboard/resources/TeamPermissionFields.tsx`
- `app/dashboard/resources/permissions.ts`
- `app/dashboard/calendar/page.tsx`
- `app/dashboard/trip-sheets/actions.ts`
- `app/dashboard/trip-sheets/trip-sheet-assignments.ts`
- `app/dashboard/trip-sheets/[id]/edit/page.tsx`
- `app/dashboard/trip-sheets/new/page.tsx`
- `app/dashboard/trip-sheets/new/TripSheetForm.tsx`
- `app/dashboard/trips/actions.ts`
- `app/dashboard/trips/[id]/page.tsx`
- `app/dashboard/trips/[id]/pdf/route.ts`
- `app/dashboard/trips/trip-notifications.ts`

Personal pages and cards:
- `app/my-trips/page.tsx`
- `app/my-trip-sheets/page.tsx`
- `app/my-trip-sheets/[id]/page.tsx`
- `app/trips/[id]/page.tsx`
- `app/trip-sheets/[id]/page.tsx`
- `app/trip-sheets/[id]/TripSheetDetailPageContent.tsx`

SQL, tests and documentation:
- `sql/20261009_multi_role_authorization.sql`
- `sql/verification/20261009_stage2b_validation.sql`
- `sql/verification/20261009_stage2b_runbook.md`
- `sql/tests/multi-role-authorization.mjs`
- `sql/tests/permission-fixture.mjs`
- `sql/tests/multi-role-compatibility-bridge.mjs` (shared fixture extraction)
- `tests/stage2a-team-actions.mjs` (same contracts through the new RPCs)
- `tests/multi-role-permissions.mjs`
- `AGENTS.md`
- `DATABASE_CONTEXT.md`
- `PROJECT_CONTEXT.md`
- `DATABASE_CONTEXT.md`
