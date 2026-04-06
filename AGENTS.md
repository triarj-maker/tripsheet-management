AGENTS.md - Trip Sheet Management System

Updated: 03/04/2026

--------------------------------------------------

1. Purpose

Guide Codex to correctly understand and modify this codebase.

Goals:
- correctness over cleverness
- minimal, safe changes
- strict adherence to system behavior

This file defines HOW the system must be implemented.

--------------------------------------------------

2. Project Structure

- Next.js (App Router)
- Supabase (PostgreSQL + Auth)
- Server Actions for mutations

Key folders:
- app/dashboard/trips/
- app/dashboard/trip-sheets/

--------------------------------------------------

3. Data Model (Implementation-Level)

trips
- id (primary key)
- title
- start_date
- end_date
- trip_type
- destination_id

trip_sheets
- id
- trip_id (FK → trips.id)
- title
- start_date
- start_time
- end_date
- end_time
- body_text

trip_sheet_assignments
- trip_sheet_id
- resource_user_id

--------------------------------------------------

4. Critical Relationships

- Trip Sheets depend on Trips
- Trip Sheet timing is derived relative to Trip start_date
- Parent (Trip) controls child (Trip Sheets)

--------------------------------------------------

5. Source of Truth

- Database is the PRIMARY source of truth
- ALWAYS fetch current state from DB before computing changes
- Form values may be used ONLY as fallback where required by current workflow
- Do NOT rely solely on form values for existing persisted data

--------------------------------------------------

6. Core Logic Rules

1. NEVER assume DB constraints enforce business logic
2. ALL validation must be handled at application level
3. Parent changes drive child updates
4. Child Trip Sheets must NOT be updated unless required by parent change
5. Avoid introducing intermediate states that break parent-child consistency

--------------------------------------------------

7. Date Shift Logic (Critical)

When Trip start_date changes:

- Compute:
  delta = new_start_date - original_start_date

- For each Trip Sheet:
  new_start_date = old_start_date + delta
  new_end_date = old_end_date + delta

MUST preserve:
- duration
- start_time
- end_time

--------------------------------------------------

8. Trip Update Protocol (MANDATORY)

When updating a Trip:

Step 1: Fetch existing Trip from DB
- MUST retrieve:
  - start_date
  - end_date

Step 2: Compare:
- datesChanged =
  original_start_date !== new_start_date OR
  original_end_date !== new_end_date

Step 3: Validate input

Step 4: Apply Trip update

Step 5: IF datesChanged is TRUE:
- fetch all trip_sheets where trip_id = trip.id

- for each trip_sheet:
  - compute delta (based on original_start_date)
  - shift start_date and end_date

Step 6: Persist updated trip_sheets

Important:
- Parent and child updates are logically linked
- Avoid hard validation failures caused by intermediate update states
- Validation should consider the final intended state, not partial state

--------------------------------------------------

9. Strict Rules (DO NOT VIOLATE)

- DO NOT skip fetching existing Trip from DB
- DO NOT assume form contains correct original values
- DO NOT update child Trip Sheets if dates have not changed
- DO NOT modify body_text during date shifts
- DO NOT introduce unrelated refactors while fixing logic

--------------------------------------------------

10. Failure Handling

- If Trip not found → abort operation
- If required Trip fields missing → abort operation
- If trip_sheets fetch fails → abort update
- Avoid failing due to temporary intermediate state inconsistencies

--------------------------------------------------

11. Known Problem Area

Edit Trip Date Shift Bug

Symptoms:
- "Parent trip not found or has no valid date range"
- failure when trip_sheets exist

Observed Causes:
- child update logic running even when dates are unchanged
- fallback logic depending on original_start_date / original_end_date
- mismatch between DB values and submitted form values

Guidance:
- Ensure date shift logic runs ONLY when datesChanged is TRUE
- Ensure DB values are always the primary reference
- Use fallback values only when absolutely necessary

--------------------------------------------------

12. Implementation Guidelines

- Keep changes minimal and targeted
- Do not refactor unrelated code
- Do not change DB schema unless explicitly instructed
- Prefer explicit logic over implicit behavior
- Preserve working flows (especially Clone Trip)

--------------------------------------------------

13. One-line Summary

Trips are the source of truth. Trip Sheets are derived execution units. Updates must be deterministic, parent-driven, and avoid invalid intermediate states.