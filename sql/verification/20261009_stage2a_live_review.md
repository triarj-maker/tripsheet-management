# Stage 2A live preflight review

Recommendation: **CHANGES REQUIRED** — complete the two outstanding verification
gates below before deployment. No bridge SQL change is demonstrated by the supplied
findings. No production operation was performed for this review.

## Evidence and concrete remaining blockers

The request supplies a summary of live findings, not the complete preflight JSON.
The available earlier Stage 1 diagnostics are not a substitute for the complete
Stage 2A output. This review therefore accepts the explicitly confirmed findings
but does not attest to unprovided function bodies, policies, constraints or grants.

1. Supply/review the complete `stage2a_preflight` JSON: all returned functions,
   policies, triggers (including Auth hooks), constraints, columns/defaults,
   relations/grants, inheritance, rules and event triggers. In particular, enabled
   status alone cannot establish trigger ordering, side effects or whether an Auth
   hook already creates a profile. This is a missing-evidence blocker, not a claim
   that such a conflict exists.
2. Complete the native two-session concurrency tests below on a disposable server
   with the reviewed live schema and bridge. The existing single-session PGlite
   tests do not meet this gate. Record the error codes, committed rows and unchanged
   assignment snapshots, together with restored-schema compatibility test results.

Two active Admins and zero drift satisfy the reported data prerequisites. The
migration repeats those checks under table locks before installing the bridge.
Client profiles TRUNCATE is confirmed revoked; the separate correction is excluded
from the production deployment. Its read-only effective-grant checks remain useful.

## Compatibility assessment

| Operation | Bridge behavior |
| --- | --- |
| Admin creation | Legacy role admin, flag true, no inferred operational membership. |
| Facilitator creation | Flag false, exactly facilitator membership. |
| Expert creation | Flag false, exactly expert membership. |
| Role change | Legacy role is authoritative; flag and replacement membership are written in the same profile transaction. No assignment mutation. |
| Admin demotion | Flag becomes false and the selected operational membership is created; rejected if this removes the final active Admin. |
| Deactivation | Retains role, flag and membership data; inactive Admins cannot authorize writes or count toward the active-Admin minimum. |
| Final active Admin | Demotion/deactivation rejected; identity changes and profile deletion are blocked throughout Stage 2A. Concurrent enforcement still requires the test gate. |

`public.is_admin()` remains compatible with the model because the bridge retains
legacy role as authoritative. The Stage 1 helper's additional flag check stays
aligned through synchronization. Direct legacy-role policies are deliberately
unchanged. The known timestamp trigger only updates updated_at; the bridge neither
compares that timestamp to an old snapshot on normal writes nor disables it.

The known Stage 1 Admin guard permits authorized self-demotion based on OLD Admin
permission and permits service-role creation. The bridge adds BEFORE authorization
and flag derivation, AFTER validation/synchronization and deferred membership
validation. Existing local tests exercise this combination. No conflict is shown
by the named helpers/triggers; full live definitions are still needed to exclude
additional behavior or changed implementations.

The bridge's four functions are private trigger functions, postgres-owned, with
empty search_path and no direct client/service EXECUTE grants. The only added table
is the private serialization row table, with RLS enabled and no client/service
grants. No public RPC or table-read policy is added. SQL review found no new access
path to trips, trip_sheets, trip_sheet_assignments or destinations.

## Existing RLS gap — separate follow-up

RLS is reported disabled on those four operational tables. Any policies attached
to them are inactive for row filtering until RLS is enabled. This does not, by
itself, prove anonymous or authenticated access: that also depends on table grants
and API exposure. Do not infer security from application guards alone.

This is an existing condition, not a new Stage 2A access path. Record it for a
separate authorization review. It does not require expanding this bridge into a
policy redesign, and is not listed as an additional bridge-specific blocker.

## Exact concurrent-session acceptance tests

Use isolated fixtures with exactly two active Admins A and B. Both test sessions
must use authenticated claims and the reviewed real policies; do not test only as
postgres. Reset fixtures between scenarios. Assert at least one active Admin,
exact flag/membership consistency, and unchanged complete assignment rows after
every committed or rejected scenario.

1. READ COMMITTED: A demotes itself in an open transaction. B attempts its own
   demotion and must wait. Commit A; B must fail with final-Admin protection (23514)
   and roll back. Repeat for deactivation and mixed demotion/deactivation.
2. Repeat with A rolling back instead of committing. B's otherwise valid operation
   should be able to commit, leaving A active. This distinguishes serialization
   from a guard that simply rejects all concurrent work.
3. REPEATABLE READ: B establishes a SELECT snapshot before A's write commits. Hold
   A's change open, attempt B's conflicting removal, then commit A. B must abort
   with serialization failure (40001) or another demonstrably safe transaction
   failure; neither removal may leave zero active Admins.
4. Repeat the stale-snapshot case at SERIALIZABLE. Retry only a whole transaction
   after re-reading current state; the retry must observe the final-Admin guard.
5. Multi-row demotion/deactivation of all active Admins must roll back atomically.
   Include a concurrent competing write; never accept partial removals.
6. Interleave a role change with direct membership insert/update/delete on the same
   target. The shared serialization mechanism must block or reject a conflicting
   write. No transaction may commit an extra, missing or mismatched membership.
7. Queue an administrative write behind a transaction revoking/deactivating that
   caller. After the first transaction commits, the queued sensitive write must
   fail authorization (or abort safely), rather than use stale Admin authority.

Unexpected failures/deadlocks need diagnosis; merely seeing an error is not a full
pass. Prove no partial role or assignment changes, and prove supported sequential
operations still succeed with the live policy and trigger definitions.

## Next steps after both gates pass

Follow `20261009_stage2a_runbook.md`: pause/drain account creation, verify TRUNCATE
remains denied (do NOT execute its correction file), execute the entire bridge
transaction, run Stage 2A validation, deploy the Auth-preserving compatibility
release, drain old instances, verify then resume creation, and smoke-test existing
flows. No multi-role selection or Stage 2B/2C is included.

The validation query's WARNING rows remain warnings: metadata cannot certify
concurrency or historical preservation. Keep supporting test/snapshot evidence.
For application rollback retain both the bridge and the Auth-preservation fix;
do not remove synchronization while profile/membership writes continue.
