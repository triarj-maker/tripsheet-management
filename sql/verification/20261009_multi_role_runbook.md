# Multi-role foundation — Stage 1 review package

Status: **Stage 1 objects now present per the latest user-supplied live diagnostics;
final data validation and original transaction integrity remain unconfirmed**.
The first production attempt rolled back; a later diagnostic shows the column,
tables, RLS, policies and security functions present. The agent has not executed
the migration against Supabase. Live diagnostics supplied by the user confirmed
`set_profiles_updated_at` calls `public.set_updated_at()` before every profile
UPDATE, assigning `NEW.updated_at = NOW()`. Other live security assumptions still
require review. The repository omits base DDL for profiles and assignments.
This package is not approval to execute against production.

## Consolidated final validation (one result table)

Open `20261009_multi_role_final_validation.sql`, paste the whole file into a fresh
Supabase SQL Editor query, and Run as `postgres`. This is one read-only SELECT,
independent of the migration and its temporary snapshots. It returns just
`check_name`, `status`, and `details`. Do not run the migration's integrity block
by itself and do not recreate its old snapshots after the fact.

PASS means only that the named current-state check passed. FAIL identifies a
missing/mismatched object, invalid data or unexpected privilege. WARNING identifies
something that cannot be proved from this inspection: historical preservation,
original transaction completion, function-body compatibility and runtime access.
Missing prerequisites cause dependent data checks to warn instead of falsely
passing on an empty result. Additional legitimate memberships are not rejected
merely because profiles can now have multiple operational roles.

The validator inspects function definitions without executing application helpers.
For `public.is_admin()`, review the returned definition against the legacy
authenticated-user / `profiles.role = 'admin'` model and its dependencies. Even a
matching phrase in the body is insufficient to prove compatibility. Review the
separate existing-profile TRUNCATE grant check as well: this is a pre-existing
grant outside the Stage 1 changes, and RLS does not govern TRUNCATE.

Run the validator tests locally (isolated PGlite dependency as described below):

```sh
node sql/tests/multi-role-final-validation.mjs /private/tmp/trip-sheet-stage1-check/node_modules/@electric-sql/pglite/dist/index.js
```

Result: **49 validator assertions passed**, covering a single result table,
read-only execution, missing schema, bad backfills/references, altered policies,
excessive grants, and non-execution of an intentionally unsafe helper fixture.

## Files and objects

- `../20261009_multi_role_foundation.sql`: transactional additive migration.
- `20261009_multi_role_preflight.sql`: read-only live inspection and before/after exports.
- `20261009_multi_role_validation.sql`: read-only post-application checks.
- `20261009_multi_role_final_validation.sql`: preferred consolidated final report
  for SQL Editor clients that display only the last result set.
- `../tests/multi-role-foundation.mjs`: disposable PostgreSQL security/compatibility tests.
- `../tests/multi-role-final-validation.mjs`: disposable consolidated-validator tests.

Introduces `profiles.is_admin boolean not null default false`,
`operational_roles(code, label, is_active)`, and
`profile_operational_roles(profile_id, role_code)`. Composite primary key prevents
duplicate memberships; a reverse role index supports role queries/FK checks.
Profile deletion cascades its memberships; deleting a referenced catalogue role
is restricted. No migration statement deletes any profile or operational record.
Confirm live profile deletion is Admin/service-only before accepting the cascade.

Only Facilitator and Expert are seeded. The catalogue has no hard-coded role enum,
so later approved roles can be data additions. Every resource continues to have
an Auth login; no separate resource/person model is introduced.

Two functions and one profile trigger live in `multi_role_private`. The new
tables have explicit grants and RLS. No existing RLS policy or profile grant is
replaced. No application files change.

## Required live review before execution

1. Run the preflight as `postgres`. It is read-only; save its results securely.
   Inspect profile columns/types/defaults, role enum/check constraints, effective
   grants, RLS, all Auth/profile/assignment foreign keys, indexes and uniqueness.
2. Review profile/Auth triggers and callable authorization functions, including
   definer functions in every exposed API schema. Confirm `profiles.id` is UUID
   and uniquely identifies an Auth user; `role` can be compared to these strings;
   `is_active` is boolean. Confirm no orphan identities.
3. Confirm existing policies prevent ordinary users from changing identity,
   granting legacy `role = 'admin'`, reactivating privileged accounts, or deleting
   another user's profile. Stage 1 does not repair unknown legacy vulnerabilities.
   An unsafe result blocks application; prepare a specifically reviewed fix.
4. Confirm `postgres` can bypass profile RLS for the read-only definer helper,
   `auth.uid()` / `auth.role()` have their standard trusted Supabase semantics,
   and no client-callable RPC can spoof request claims or execute arbitrary SQL.
   Keep `multi_role_private` out of Data API exposed schemas. Confirm no unknown
   grant recipients/default grants widen access to new tables or functions.
5. Review triggers for side effects on updates of `is_admin`, including changes
   to other tables. The migration permits only the confirmed NOW() timestamp on
   rows returned by the initial Admin backfill, cast to the original column type
   and precision. It detects all other old-field/assignment changes and rolls back.
   It cannot establish
   absence of every possible cross-table trigger side effect. Do not disable
   live triggers. The confirmed profile timestamp trigger is kept intact.
6. Review the ambiguous-role output. **Any legacy `resource`, null, or unknown
   role blocks the entire migration**, including inactive records. Report the
   returned IDs/names/emails to the owner and obtain a per-user mapping decision.
   Do not silently map, merge, delete, or change `profiles.role` to get past the
   guard. Incorporate approved mappings into a revised draft without rewriting
   legacy values. No affected users could be reported locally without live data.
7. Check object-name collisions and migration history. The draft rejects unknown
   existing new objects. Its marker supports rerunning this exact installation;
   it does not validate or adopt arbitrary schema drift. Never run it after a
   Stage 2 policy cutover because it reinstalls Stage 1 security definitions.
8. Rehearse against a restored staging database and perform the tests below.
   Obtain explicit approval for the reviewed SQL before any production execution.

## Backfill and reruns

| Legacy role | `is_admin` | Initial membership |
| --- | --- | --- |
| admin | true | none |
| facilitator | false | facilitator |
| expert | false | expert |
| resource / null / unknown | migration aborts | decision required |

Inactive Admins are also backfilled true, but cannot manage the new structure
while inactive. Nothing infers multiple memberships or merges accounts.

First application sets permissions and memberships once. A successful rerun
preserves later intentional permission/membership edits, does not repeat the
backfill, and reinstalls the same Stage 1 security definitions. All DDL and
backfill commit together. A 5-second lock timeout avoids waiting indefinitely;
the transaction requires a short quiet window for profile/assignment locks.

The timestamp expectation is independently computed from NOW(), not copied from
the updated row. A temporary typed table records actual UPDATE RETURNING IDs and
expected timestamps. Only those IDs receive an updated_at replacement in the
expected snapshot; every other old field and both row sets are compared in full.
This temporary table stays empty on reruns, which allow no timestamp differences.

## Security model

- The new management gate requires **both** `is_admin = true` and legacy
  `role = 'admin'`, with `is_active is not false`. This conservative transitional
  gate only governs the new fields/tables. Existing app checks stay unchanged.
  A stale new flag alone cannot let a demoted legacy Admin manage memberships;
  changing only the legacy role cannot grant new management permission.
- The helper is a read-only, fixed-search-path, `postgres`-owned SECURITY DEFINER
  function with no user-supplied identity argument. It bypasses profile RLS for
  its lookup, preventing recursive membership/profile policy evaluation.
- An AFTER INSERT/UPDATE trigger protects changes to `is_admin` even when an
  existing table-level UPDATE grant would defeat a column-only REVOKE. It checks
  the final row. Self-updates use OLD permission/role/activity, so a newly written
  true value cannot authorize itself. Self-insert with true is rejected.
- Ordinary updates that leave `is_admin` unchanged pass through to existing
  grants/RLS, preserving permitted name/phone edits. The trigger grants no row
  access. Administrators still need the existing profile update policy to allow
  the target row. No `profiles` SELECT behavior is changed.
- Membership SELECT is own rows or authorized Admin. INSERT/UPDATE/DELETE are
  Admin-only under RLS; UPDATE validates both old and new rows. Authenticated
  users cannot TRUNCATE. The FK and composite PK enforce integrity.
- Catalogue reads are authenticated; catalogue writes are service/migration-only.
  Neither an ordinary user nor an Admin client can invent additional role codes.
- Trusted service-role requests and direct `postgres` maintenance can change the
  new permission. A definer function's `current_user` is deliberately not used
  as proof of caller authority. Function execution is revoked from PUBLIC/anon;
  only the read helper is executable by authenticated/service_role.

Review principles: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
and [PostgreSQL function security](https://www.postgresql.org/docs/current/sql-createfunction.html).

## Compatibility and drift before Stage 2

All existing queries, helpers, forms, pickers and unrelated policies still use
`profiles.role`. Profile IDs, Auth IDs, assignments, feed URLs, notifications,
Trips, Trip Sheets and Templates are unchanged. No synchronization trigger is
added and no old role is rewritten.

**The new values are an initial snapshot, not yet authoritative for the app.**
The old Team form can still create users or edit legacy roles after Stage 1.
New users get `is_admin = false` and no memberships until separately reconciled;
this does not affect their existing legacy application access. Newly created
legacy Admins therefore cannot manage the new structure yet. Likewise, an old
Admin demotion can leave a stale new flag, but the dual gate denies new management.

Do not begin using the new values for app authorization until a reviewed Stage 2
reconciliation accounts for intervening Team edits. Do not use a blind rerun to
reconcile or overwrite intentional multi-role choices. Stage 2 should establish
one authoritative model and replace the transitional gate coherently.

## Validation and execution sequence

1. Save the preflight row exports and fingerprints. Compare entire old profile
   rows, assignment rows and Auth ID sets, not only counts. Initial-backfill Admin
   updated_at values are the sole expected old-field difference; the full profile
   fingerprint will therefore differ. The migration checks exact expected values,
   and exported snapshots allow review. Reruns require complete equality. Save other operational
   table snapshots too if live trigger review finds cross-table side effects.
2. In staging, run this migration as `postgres`, then validation and preflight
   again. Initial failure counts must be zero; catalogue must contain exactly the
   two expected rows. Compare all legacy values/policies/grants to the baseline.
3. Verify ordinary-user JWT/API requests cannot self-grant Admin, change another
   person's flag, insert an Admin profile, escalate via upsert, or insert/update/
   delete their own or another person's memberships. Test anon and inactive Admin
   too. Test allowed Admin management, multiple memberships, duplicate rejection,
   profile deletion/cascade authorization and role deletion restriction.
4. Verify pre-existing permitted profile edits with real JWTs in staging. Exercise
   existing login/home redirects, each active role, Admin Team create/edit/disable,
   assignment pickers, personal work, notification/PDF gates and calendar feeds.
   Confirm every baseline active account retains its old role and access. Inspect
   sensitive definer RPC paths in addition to direct table writes.
5. Read-only validation inspects structure/data, but cannot prove write denial or
   complete runtime compatibility. Do not report these staging checks as passed
   based only on SELECT results. Do not perform production write probes, even
   rollback-based ones: triggers or external effects may not be rollback-safe.
6. After explicit approval, run the exact reviewed migration in a quiet production
   window, then only read-only validation/baseline comparisons. Unexpected errors
   abort the transaction. Investigate before retrying; do not force past guards.
7. For post-commit issues, keep the unused additive objects while investigating.
   Do not drop profiles, undo operational data, or remove controls automatically.
   A rollback/removal migration requires its own review.

## Local checks

No Postgres CLI/server or live Supabase connector was available. Tests use PGlite
0.3.14 (embedded PostgreSQL) in memory with synthetic Auth helpers, identities,
profiles and assignments. It is not a reproduction of the unknown live schema.

Local result: **84 assertions passed**, including execution of both verification
scripts. JavaScript syntax and whitespace checks passed. No production or live
staging validation has been performed by the agent; the corrected migration has
not been applied remotely. The user's earlier failed attempt rolled back.

Install the isolated test dependency outside the project, then run:

```sh
npm install --prefix /private/tmp/trip-sheet-stage1-check --cache /private/tmp/trip-sheet-stage1-npm-cache --ignore-scripts --no-audit --no-fund @electric-sql/pglite@0.3.14
node sql/tests/multi-role-foundation.mjs /private/tmp/trip-sheet-stage1-check/node_modules/@electric-sql/pglite/dist/index.js
git diff --check
```

The test runner cannot accept a database URL and never loads environment secrets.
It executes both read-only scripts and the actual migration; verifies preservation,
backfill, rerun, RLS, field protection, allowed profile edits and constraints; and
checks atomic rollback for legacy/null roles, object collisions and trigger side
effects. It reproduces the confirmed production timestamp trigger and the original
failure, then verifies the correction, exact Admin timestamps, untouched non-Admin
timestamps, timestamp-only corruption on reruns, wrong/unrelated timestamps,
assignment side effects, and timestamp type/precision handling. Existing profile update RLS is deliberately broad in the fixture to
exercise protection of the new field independently of row access.

## Stage 2 impact — no implementation in this package

Update `lib/roles.ts`, `app/dashboard/lib.ts`, root/login routing and the independent
checks in Trip Sheet scheduling/assignment replacement, notifications and PDF.
Migrate legacy-role RLS checks together with app authorization. Update Team forms,
profile labels, assignable-user queries, category-union card visibility,
`AdminNav`, personal view scoping and interface preference storage. Preserve
staged weekly assignment editing. Account consolidation and feed-security changes
remain separate tasks; neither belongs to this foundation migration.
