##Trip Sheet Management System - ChatGPT Context

Updated: 26/05/2026

⸻

1. Purpose

This file provides high-level context for:

* product reasoning
* UX decisions
* system behavior
* debugging logic issues

This is NOT an implementation file.

This defines how the system should behave.

⸻

2. System Overview

Trip Sheet Management is an operational scheduling and execution system for travel programs.

Core Hierarchy:

Trip
↓
Trip Sheets
↓
Facilitators / Experts assigned to Trip Sheets

⸻

3. Core Concepts

Trip

Represents the overall program.

Defines:

* overall duration (start_date → end_date)
* destination
* trip type (Educational / Private)
* customer context
* participant counts

Trip Sheet

Represents an execution unit within a Trip.

Can be:

* a full trip (Private)
* a batch / segment (Educational)

Has its own:

* title
* start_date + start_time
* end_date + end_time
* operational instructions (body_text)
* module cards

Facilitator

Operational delivery role.

Responsible for executing assigned Trip Sheets.

Sees facilitator-specific operational cards.

Expert

Operational delivery role.

Responsible for domain expertise and assigned Trip Sheets.

Sees expert-specific operational cards.

⸻

4. User Roles

Admin

* Full system access
* Creates and manages Trips
* Creates and manages Templates
* Assigns Facilitators and Experts
* Can also participate operationally if assigned

Facilitator

* Access to assigned Trips
* Access to assigned Trip Sheets
* Mobile-first execution experience
* Sees facilitator module cards

Expert

* Access to assigned Trips
* Access to assigned Trip Sheets
* Mobile-first execution experience
* Sees expert module cards

⸻

5. Data Model (Conceptual)

trips

* id
* title
* start_date
* end_date
* trip_type
* destination_id
* trip_color
* school_id
* company_id
* phone_number
* adult_count
* kid_count

trip_sheets

* id
* trip_id
* title
* start_date
* start_time
* end_date
* end_time
* body_text

trip_sheet_assignments

* trip_sheet_id
* assigned_user_id

companies

* id
* name
* is_active

schools

* id
* name
* is_active

template_cards

* id
* template_id
* title
* category
* card_url
* sort_order

trip_sheet_cards

* id
* trip_sheet_id
* source_template_card_id
* title
* category
* card_url
* sort_order

trip_notifications

* id
* trip_id
* sent_by_user_id
* sent_at
* status
* recipient_count
* success_count
* failure_count

trip_notification_recipients

* trip_notification_id
* assigned_user_id
* delivery_status
* error_message

⸻

6. Source of Truth

* Database is the PRIMARY source of truth.
* Form inputs should NOT be trusted for existing values by default.
* All mutations SHOULD:
    * fetch current DB state first
    * compute changes relative to DB values.

Database validation may exist independently of application logic.

Mutation failures may originate from:

* application validation
* database constraints
* triggers/functions

⸻

7. Core Behavioral Rules

Parent-Child Relationship

* Trips define programs.
* Trip Sheets always belong to Trips.
* Trip Sheets cannot exist independently.

Timeline Logic

Trip Sheets should logically operate within Trip timelines.

Application layer maintains this consistency.

Date Shift Logic

When Trip dates change:

* Child Trip Sheets shift relative to original Trip start_date.
* Preserve:
    * time
    * duration
    * body_text
* Shift by:

delta = new_start_date − original_start_date

Additional rules:

* Existing Trip Sheets are updated.
* Child rows are never recreated.
* Child rows are never duplicated.

Mutation Principle

* Parent drives children.
* Child updates triggered only when parent dates change.
* Avoid unnecessary rewrites.
* Mutate existing rows.

⸻

8. Body Text Behavior

body_text stores Markdown text.

Supported formatting:

* headings
* bold
* bullet lists
* numbered lists
* paragraphs

Rules:

* Stored as plain text.
* No HTML stored.
* Rendered safely at read time.
* Editable after creation.
* Never auto-regenerated.

⸻

9. Module Cards

Purpose:

Operational playbooks attached to Templates and Trip Sheets.

Architecture:

Google Docs
↓
Google Apps Script
↓
Mobile HTML
↓
/public/module-cards/
↓
GitHub
↓
Vercel static hosting
↓
Template stores relative URLs
↓
Trip Sheet receives copied snapshot

Template Cards:

* reusable defaults
* attached to Templates

Trip Sheet Cards:

* copied at creation
* independently editable
* operational snapshots
* never auto-sync back to Templates

Role Visibility:

* Facilitator → facilitator cards
* Expert → expert cards
* Admin → all cards

⸻

10. Calendar Model

Month View

Shows Trips.

Purpose:

* planning
* overview
* conflict visibility

Behavior:

* conflict indicators shown at Trip level
* clicking whitespace opens Week View

Week View

Shows Trip Sheets.

Purpose:

* operational scheduling
* staffing
* execution planning

⸻

11. Weekly Drawer Assignment Model

Weekly calendar drawer is a staged editor.

Behavior:

* add/remove assignments locally
* no immediate server mutation
* Save Changes commits edits
* replace assignment set on save

Purpose:

Optimized for multi-assignment workflows.

⸻

12. Personal Operational Views

My Trips

Trip-level operational overview.

Shows Trips assigned through Trip Sheet assignments.

My Trip Sheets

Flat chronological execution list.

Grouped into:

* Ongoing
* Upcoming
* Past

Designed as a mobile-first execution experience.

⸻

13. Resource-facing UX Philosophy

Execution-first hierarchy:

1. Trip Sheet context
2. Module Cards
3. Execution instructions
4. Parent Trip context

The page should answer:

“What do I need to do right now?”

before

“What trip is this?”

Principles:

* speed over completeness
* fast scanning
* minimal friction
* mobile-first execution

⸻

14. Notifications

Manual Trip-level notification system.

Behavior:

* triggered explicitly by admin
* one email per unique assigned user
* includes only relevant Trip Sheets

History stored in:

* trip_notifications
* trip_notification_recipients

App remains source of truth.

⸻

15. UX Design Principles

* System is an operational tool.
* Speed > perfection.
* Minimize clicks.
* Reduce navigation friction.
* Prefer staged editing for batch actions.
* Immediate feedback for mutations.
* Mobile-first execution experiences.
* Full-card interactions where appropriate.
* Optimize for real-world field usage.

⸻

16. Navigation Philosophy

Navigation reflects user intent.

Operational/Admin

* Trips
* Calendar
* Templates
* Schools
* Companies
* Resources (future Team rename)

Personal

* My Trips
* My Trip Sheets

Account

* Profile

⸻

17. System Boundaries (Current)

Exists:

* conflict visibility
* notifications
* scheduling
* staffing workflows
* operational execution tooling

Does NOT yet exist:

* automated conflict resolution
* advanced analytics
* scheduling engine
* automated scheduling decisions
* module analytics
* offline execution mode

CRM and sales integration are anticipated future directions.

⸻

18. Current Focus

* Stabilize operational UX
* Improve mobile execution experience
* Reduce architectural debt
* Improve scheduling workflows
* Build toward richer utilization and planning tools
* Strengthen execution support tooling

⸻

19. One-line Summary

A parent-child travel operations platform where Trips define programs, Trip Sheets define execution, Facilitators and Experts deliver experiences, and the UX is optimized for fast mobile execution in the field.