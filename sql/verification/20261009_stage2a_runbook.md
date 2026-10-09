# Stage 2A compatibility bridge — local candidate, not deployed

Stage 1 is reported applied by the user. Stage 2A has NOT been applied to Supabase.
The user reports live preflight: two active Admins, zero permission/membership
drift, and client profiles TRUNCATE already revoked. The complete preflight JSON
has not been supplied for review; the summary alone cannot verify all definitions.
This package is not approved for production execution until the gates below are
satisfied. See `20261009_stage2a_live_review.md`.

## Model and scope

`profiles.role` remains the authoritative **single** role, including for inactive
accounts. Existing login, navigation, dropdown, assignment queries and all
application authorization checks are unchanged. `public.is_admin()`, Stage 1
helpers and existing RLS policies are not replaced.

| Legacy role | is_admin | Operational memberships |
| --- | --- | --- |
| admin | true | none |
| facilitator | false | facilitator only |
| expert | false | expert only |

Existing profile INSERT/UPDATE statements are the transactional API. BEFORE
triggers authorize sensitive writes and derive the flag. AFTER triggers reconcile
memberships in the **same transaction**. Deferred constraints reject inconsistent
committed state, including direct membership changes by Admins. No application
sequence of independent permission writes is introduced. Role replacement uses the
default initially-deferred constraints; custom callers forcing all constraints
immediate may receive a safe rollback and need review. This covers old app
instances and the compatibility release alike; it is not merely an app-side fix.

All profile and membership write statements UPDATE one private serialization row.
The lock is held to transaction end. Volatile trigger queries see fresh snapshots
at READ COMMITTED; stale REPEATABLE READ/SERIALIZABLE writers conflict with the
updated lock row and must abort/retry the entire transaction. Locking only an
advisory key would not provide that latter safeguard. See PostgreSQL's
[consistency guidance](https://www.postgresql.org/docs/17/applevel-consistency.html)
and [function visibility rules](https://www.postgresql.org/docs/17/spi-visibility.html).
Concurrent writes can block or receive a deadlock/serialization error; those are
failures, never a UI success. Re-fetch current state before retrying.

Removing/deactivating the final active Admin fails, including service writes.
Inactive Admins do not count. Self-promotion is checked against OLD values and
cannot be authorized by the newly written row. Existing ordinary-field RLS is
preserved. Identity changes and profile deletion (including Auth cascade deletion)
are rejected during Stage 2A. Account deletion/consolidation needs a later reviewed
workflow. Existing timestamp/audit triggers remain installed and enabled.

The bridge does not update any existing profiles during installation, reconcile
pre-existing drift, or touch Auth users, Trips, Trip Sheets, assignments, or
notifications. Installation fails if existing permissions/memberships disagree,
if unsupported roles exist, if no active Admin exists, or if client TRUNCATE remains.
Do not discard additional memberships to make this precondition pass: investigate.

## Live inspection gate

Run `sql/verification/20261009_stage2a_preflight.sql` as postgres in Supabase SQL
Editor. Execute the entire file, then copy its single JSON result for review.
It is read-only and assumes Stage 1 objects exist. Do not run a migration yet.

Review ALL returned policies and helper/trigger definitions, not just regex matches:
SQL/PLpgSQL bodies and indirect calls can hide dependencies. In particular:

- `public.is_admin()` and inline `profiles.role` checks: leave semantics intact.
- Profile SELECT/INSERT/UPDATE policies; no newly broadened read access is needed.
- All profile and membership triggers, enabled modes and ordering, timestamp
  functions, statement triggers, rules and event triggers.
- Auth user creation/deletion hooks, especially automatic profile creation or
  metadata-driven role writes. An automatic profile INSERT may conflict with the
  application's explicit INSERT. The recovery flow must never overwrite it.
- Every SECURITY DEFINER entry point capable of writing profiles or memberships.
  Confirm no client-callable function impersonates service JWT claims or disables
  protections. Trigger guards are not a remedy for a privileged arbitrary-SQL RPC.
- Defaults, constraints, FKs, grants (including PUBLIC/inheritance), private schema
  exposure and function ownership. Keep `multi_role_private` out of exposed schemas.
- No trigger may disable these guards, bypass serialization, or modify assignments
  as a side effect of a profile update. Reproduce legitimate hooks in staging.

The user confirms the client profiles TRUNCATE correction has already been applied.
**Do not include `20261009_profiles_revoke_client_truncate.sql` in this production
deployment.** Keep the effective-privilege checks in preflight, the bridge and
validation; these are safeguards, not repeated revocations. The correction file
remains available for historical reference and disposable regression fixtures.

The user also reports RLS disabled on `trips`, `trip_sheets`,
`trip_sheet_assignments`, and `destinations`. This is an existing authorization gap,
tracked separately in `20261009_stage2a_live_review.md`. Existing policies on a table
with RLS disabled do not enforce row filtering. Effective exposure depends on grants
and API exposure, which require the full metadata. Stage 2A neither changes those
tables' grants/RLS nor introduces a function accessing them. Do not add a general
RLS redesign to this bridge.

## Local verification

Use an isolated PGlite installation; never pass a production URL:

```sh
node sql/tests/multi-role-foundation.mjs /absolute/path/to/pglite/dist/index.js
node sql/tests/multi-role-final-validation.mjs /absolute/path/to/pglite/dist/index.js
node sql/tests/multi-role-compatibility-bridge.mjs /absolute/path/to/pglite/dist/index.js
node tests/stage2a-team-actions.mjs
npx tsc --noEmit
npm run lint
npm run build
```

PGlite tests execute PostgreSQL roles, RLS, actual legacy write shapes, the real
timestamp trigger, transactional failures and commit-time constraints. They do
**not** establish multi-connection concurrency behavior or reproduce every live
hook. The action tests execute transpiled actual server actions with mocked Auth
and database boundaries, including returned and thrown profile errors.

## Mandatory disposable-server validation

Restore schema/data into a disposable PostgreSQL server; remove external side
effects such as email delivery. Do not perform write probes in production.
Apply the bridge there after resolving reviewed preconditions. A restored current
production database should already have the TRUNCATE correction; only synthetic
fixtures deliberately reproducing the former grants need the correction. Use normal authenticated claims and real policies, not only owner
queries. Check Admin/Facilitator/Expert creation; each role transition; activation;
forged is_admin; membership insert/update/delete; inactive/missing callers; partial
Auth failure/recovery; retained assignment IDs and assigned_by; login/navigation;
password reset; and the existing timestamp/audit hooks.

Concurrency test with exactly two active Admin fixtures A and B:

1. Session A: BEGIN at READ COMMITTED; set authenticated role/claims for A; demote
   A to facilitator but do not commit.
2. Session B: BEGIN at READ COMMITTED; set authenticated role/claims for B; attempt
   to demote/deactivate B. It must block on the serialization row.
3. Commit A. B must fail with final-active-Admin protection. Roll back B.
4. Reset disposable fixtures. Repeat with B using REPEATABLE READ, taking a SELECT
   snapshot before A commits. B must fail with serialization protection (40001),
   or another safe transaction failure, never leave zero active Admins.
5. Repeat at SERIALIZABLE and with multi-row demotion/deactivation; verify at least
   one active Admin and exact flag/membership consistency after each scenario.
6. Interleave direct membership mutations with role changes. They must serialize
   or fail; an inconsistent transaction must never commit.

Snapshot complete profiles, assignments, Auth IDs and policy definitions before
installation and compare after installation. Installation should change none of
them. For explicit Team edits, only the requested fields, derived role state, and
legitimate audit/timestamp effects should change; assignment rows must not change.
Run both Stage 1 final validation and `20261009_stage2a_validation.sql`. Historical
and concurrency WARNING rows require external evidence, not conversion to PASS
based on current state alone.

## Exact deployment order (manual, after review)

1. Review preflight output and complete restored-server tests, including concurrent
   sessions. Confirm rollback build and backups. Resolve drift explicitly before
   installation; do not rerun Stage 1 as a reconciliation mechanism.
2. Pause Team account creation and drain in-flight create requests during rollout:
   old app versions still automatically delete a newly created Auth account on a
   profile error. Do not resume creation until every instance has the safety fix.
   For a guaranteed pause, use maintenance/routing controls, not a UI notice alone.
3. Confirm effective client TRUNCATE denial using read-only validation. The
   correction is already applied: **skip its SQL file**.
4. Apply the **entire** bridge SQL as postgres in one SQL Editor execution. Its
   table locks wait for existing writers; its precondition check runs under those
   locks. Drift causes full rollback. Do not skip checks or run selected blocks.
5. Run Stage 2A validation and inspect preflight definitions. Do not enable new
   role UI. Legacy Team writes are now synchronized by the database even while
   old app instances remain; there is no app-first synchronization dependency.
6. Deploy the compatibility application release (the partial-Auth-failure fix).
   Drain old instances. Confirm error recovery instructions are visible. Resume
   account creation only after this is verified.
7. Smoke-test normal read/login/navigation flows. Use staging for destructive or
   negative scenarios. Observe errors and validate zero role drift again.

If any live hook or policy makes this sequence unsafe, **stop before applying**.
This local package does not certify unknown production dependencies. Do not start
Stage 2B/2C or multi-role writes while the bridge enforces a single legacy role.

## Recover an Auth account after a profile failure

The action reports the created Auth UUID and an error, never success, and never
calls `deleteUser`. A network failure can make the profile commit outcome unknown.
Do not submit the create form again and do not delete/recreate the identity.

A database administrator should:

1. Verify the UUID and email against `auth.users` and the intended person. Inspect
   `profiles` and memberships for that same UUID. Confirm the error's cause.
2. If the profile already exists, inspect it and validate consistency. Do not
   overwrite it or use a partial UPSERT. It may have been created by an Auth hook
   or a request whose successful response was lost.
3. Only if the profile is genuinely absent, insert its intended ordinary fields
   and one legacy role against the **same** Auth UUID, in a reviewed transaction.
   The installed bridge supplies the flag/membership atomically. Example template
   below intentionally contains invalid placeholders until reviewed:

```sql
begin;
do $$
declare
  recovery_id uuid := 'REPLACE_WITH_VERIFIED_AUTH_UUID';
  recovery_email text := 'REPLACE_WITH_VERIFIED_EMAIL';
begin
  perform 1 from auth.users where id=recovery_id
    and lower(email)=lower(recovery_email) for update;
  if not found then raise exception 'Auth identity/email not verified'; end if;
  if exists (select 1 from public.profiles where id=recovery_id) then
    raise exception 'Profile already exists: inspect it instead of overwriting';
  end if;
  insert into public.profiles(id, full_name, email, phone, role, is_active)
  values (recovery_id, 'REPLACE_WITH_VERIFIED_NAME', recovery_email,
    null, 'REPLACE_WITH_REVIEWED_SINGLE_ROLE', true);
end $$;
commit;
```

4. Verify the resulting profile and memberships, then have the person sign in.
   No new Auth user, password reset, assignment changes or email resend is needed.
   If the transaction fails, the existing Auth identity remains for diagnosis.

## Rollback

- A failed bridge transaction rolls back all bridge DDL; do not deploy dependent
  changes or resume role writes expecting synchronization. Diagnose first.
- After a successful install, application rollback must **retain the Auth account
  preservation patch**. Keep the database bridge installed: it supports legacy
  single-role actions and prevents drift regardless of which app version writes.
- Do not restore the unsafe automatic-delete behavior, regrant TRUNCATE, rerun
  Stage 1, or remove bridge triggers while Team writes are enabled.
- If the bridge itself needs rollback, pause all profile/membership writers and
  account creation, preserve diagnostic snapshots, and prepare a reviewed forward
  fix or replacement bridge while writes remain paused. There is intentionally no
  one-click down migration that reintroduces unsynchronized live writes.
- Do not restore old profile/assignment rows as a blanket rollback: legitimate
  post-deployment edits and assignments must be preserved.

Stage 2B must explicitly retire synchronization/constraints and move authorization
only after its own coordinated migration and app review. The legacy column will
then become compatibility data; Stage 2A neither drops it nor anticipates which
operational memberships a future Admin should hold.

## Validation recorded for this local preparation

- TypeScript (`npx tsc --noEmit`): PASS.
- Full ESLint: PASS.
- Production Next.js build: PASS.
- Existing Stage 1 foundation tests: 84 assertions PASS.
- Existing consolidated Stage 1 validator tests: 49 assertions PASS.
- Stage 2A database/diagnostic/validation tests: 81 assertions PASS.
- Actual Team action and existing authorization-helper tests: 57 assertions PASS.
- `git diff --check`: PASS.

These are local results, not live Supabase validation. No native multi-connection
PostgreSQL server was available; concurrent-session tests and complete live
trigger/policy/Auth-hook review remain required before production approval.
