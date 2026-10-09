# Stage 1 failure investigation — cause confirmed and corrected locally

## Confirmed resolution

The user supplied live evidence confirming `set_profiles_updated_at` calls
`public.set_updated_at()` BEFORE UPDATE FOR EACH ROW and assigns
`NEW.updated_at = NOW()`. The original strict comparison rejected this legitimate
timestamp change. The user also confirmed complete rollback and absence of the
new Stage 1 objects. These are user-supplied live findings, not a direct connection
by the agent.

The local correction records the actual backfill UPDATE RETURNING IDs in a
temporary table with the original timestamp type/precision. Expected timestamps
are independently computed as NOW(). The expected snapshot changes only that key
for those IDs; no timestamp field is broadly excluded. Reruns have an empty
backfill-ID set and require complete old-field equality. The existing timestamp
trigger, authorization, RLS, transaction and assignment checks are unchanged.

The complete local suite now reproduces the original failure and validates the
correction with the confirmed trigger. See the runbook for current test results.
The corrected migration has not been executed against Supabase and awaits review.

## Original investigation record (superseded where resolved above)

The reported error identifies the first check in `DO $integrity$`, lines 176–183
of `sql/20261009_multi_role_foundation.sql`. It compares the before/after profile
row sets in both directions using `EXCEPT ALL`. Each row includes the ID and
`to_jsonb(profile) - 'is_admin'`. Any changed old field, missing row, extra row or
changed ID raises the error. The subsequent assignment check was not reached.

The direct profile write is line 74:

```sql
update public.profiles set is_admin = true where role::text = 'admin';
```

The new permission is already excluded from comparison. Its expected backfill
alone cannot explain the failure. Existing triggers/rules or generated expressions
are candidates. No live output has yet established the responsible field/function.
The repository defines `public.set_updated_at()` for other tables, but contains
no definition attaching it to `profiles`; that is not evidence of a live profile
timestamp trigger. An ordinary column default does not refresh itself on this UPDATE.

Potential legitimate audit effects include an update timestamp, an audit actor,
or a revision counter, but only if the live definitions and intended semantics
establish them. Names, emails, phone numbers, roles, active status, IDs and creation
timestamps must not be assumed mutable for this migration. No field is approved
for exclusion based on its name alone.

## Read-only investigation

Run only `20261009_multi_role_failure_diagnostics.sql` in a fresh Supabase SQL
Editor query as postgres. Copy the one `stage1_failure_diagnostics` JSON result.
It reads catalogs in a read-only transaction; it does not run trigger functions,
issue a probe UPDATE, recreate the failed transaction, or select profile data.

The result includes:

- All profile triggers (including inherited/partitioned relations), UPDATE-event
  flags, enabled status, conditions/timing and bound function definitions/settings.
- Profile column types, defaults, generated expressions and identity definitions.
- Stage 1 column/table/index/schema/function/trigger/policy presence and table RLS.
- Profile rewrite rules and event-trigger definitions to expose other possible
  side effects of the migration's DDL.

Inspect helper functions called by the returned functions as well. Metadata may
identify a deterministic cause, but cannot recover rolled-back OLD/NEW values.
If multiple paths remain plausible, reproduce against a disposable restored
database and report a per-ID/per-column diff there. Never probe production with
an UPDATE, even inside a transaction intended for rollback.

## Proposed correction, conditional on evidence

The migration and existing tests have not been modified. If the live trigger is
confirmed to modify only `updated_at` legitimately:

1. Keep the trigger enabled and allow its normal audit update.
2. Record the exact initial-backfill target IDs and an independently derived
   expected timestamp matching the actual trigger expression and column type.
3. Build an expected profile snapshot from the original rows, changing only that
   timestamp key for those targeted rows. Compare complete rows against it;
   retain the existing sole exclusion of the new `is_admin` field.
4. For example, a confirmed `NEW.updated_at = now()` can be checked against the
   transaction timestamp with the column's actual type/precision. A different
   expression such as `clock_timestamp()` requires a different, explicitly bounded
   check; do not assume the expressions are interchangeable or merely accept any
   new timestamp. Do not copy the actual result into the expectation, which would
   make the check incapable of detecting a wrong timestamp.
5. Leave non-target profiles fully unchanged. On a rerun that skips backfill,
   allow no timestamp exception at all. Keep IDs, row-set equality, every other
   profile field and complete assignment equality protected. Keep the enclosing
   transaction and failure rollback.
6. Update read-only validation instructions to distinguish the specifically
   expected audit timestamp difference from unintended baseline changes.

If the cause involves a business field or another audit mechanism, stop and
review that behavior explicitly. Do not broaden exclusions to make the migration
pass. Add a bounded mismatch report (IDs and field names, not personal values) if
needed for future failures.

## Regression coverage after confirmation

Copy the actual confirmed trigger behavior into the disposable fixture and give
baseline timestamps fixed earlier values so the test cannot pass accidentally
because both timestamps were generated in the same transaction. Demonstrate the
old migration's specific integrity error, then the corrected migration's success.
Also verify unexpected business-field changes still fail, wrong/unrelated-row
timestamp changes fail, identities and assignments remain equal, RLS/permission
tests pass, reruns leave timestamps alone, and failures restore object/data state.

No cause-specific regression has been added yet: that depends on live evidence.
The existing test suite's trigger-side-effect scenario changes `phone`, not
`updated_at`; it is evidence for rollback protection, not the production cause.

## Validation completed locally

- Existing PGlite PostgreSQL suite: **47 assertions passed**.
- Diagnostic SQL smoke checks: **10 assertions passed**, covering missing schema
  objects, a synthetic pre-migration timestamp-trigger definition, and existing
  Stage 1 objects. This validates the diagnostic query, not the live root cause.
- No production connection, data modification, migration application, trigger
  disabling, RLS changes or application changes were performed.

## State after the reported failure and retry requirements

If the exact full file was submitted as one transaction, the uncaught exception
prevents commit of its schema/data changes. A failed first application should
leave none of the newly introduced Stage 1 objects committed. Pre-existing
objects remain as before. The error message itself does not inspect or prove
current live object state; the diagnostic JSON must confirm it. Separately
committed partial runs or external trigger side effects cannot be ruled out from
this exception text alone.

Before retrying: obtain the live JSON, identify the responsible code/fields,
confirm object state, prepare the narrowly scoped local correction and regression,
rerun all tests and rehearse on a restored staging database, then obtain explicit
approval for the corrected production migration. Do not run cleanup DROP commands
or rerun the original migration while diagnosis is pending.
