# Trip Sheet Management System - ChatGPT Context

Updated: 08/04/2026

--------------------------------------------------

1. Purpose

This file provides high-level context for:
- product reasoning
- UX decisions
- system behavior
- debugging logic issues

This is NOT an implementation file.
This defines how the system should behave.

--------------------------------------------------

2. System Overview

Trip Sheet Management system for operational scheduling of travel programs.

Core Hierarchy:
- Trip (parent entity)
- Trip Sheets (child execution units)
- Resources assigned to Trip Sheets

--------------------------------------------------

3. Core Concepts

Trip
- Represents the overall program
- Defines overall duration (start_date → end_date)
- Defines destination
- Defines trip type (Educational / Private)

Trip Sheet
- Represents an execution unit within a Trip
- Can be:
  - a full trip (Private)
  - a batch / segment (Educational)
- Has its own:
  - start_date + start_time
  - end_date + end_time
- Contains operational instructions (body_text)

Resource
- A person assigned to execute a Trip Sheet

--------------------------------------------------

4. Data Model (Conceptual)

trips
- id
- title
- start_date
- end_date
- trip_type
- destination_id
- trip_color
- guest_name
- company
- phone_number
- adult_count
- kid_count

trip_sheets
- id
- trip_id
- title
- start_date
- start_time
- end_date
- end_time
- body_text

trip_sheet_assignments
- trip_sheet_id
- resource_user_id

trip_notifications
- id
- trip_id
- sent_by_user_id
- sent_at
- status
- recipient_count
- success_count
- failure_count

trip_notification_recipients
- trip_notification_id
- resource_user_id
- delivery_status
- error_message

--------------------------------------------------

5. Source of Truth

- Database is the PRIMARY source of truth
- Form inputs should NOT be trusted for existing values by default
- All mutations SHOULD:
  - fetch current DB state first
  - compute changes relative to DB values

--------------------------------------------------

6. Core Behavioral Rules

1. Parent-Child Relationship
- Trip Sheets always belong to a Trip
- Trip Sheets cannot exist independently

2. Timeline Logic
- Trip Sheets should logically operate within Trip timeline
- Application layer maintains this consistency

3. Date Shift Logic
When Trip dates change:
- Child Trip Sheets shift relative to original Trip start_date
- Preserve:
  - time
  - duration
- Shift by:
  - delta = new_start_date - original_start_date

4. Mutation Principle
- Parent drives children
- Child updates triggered only when parent date changes
- Avoid unnecessary child rewrites

5. Body Text Behavior
- body_text is generated at creation
- After creation:
  - behaves as normal editable field
  - never auto-regenerated

--------------------------------------------------

7. Calendar Model

Month View
- Shows Trips (parent level)
- High-level planning / overview surface
- Conflict indicators shown at day-cell level
- Clicking whitespace in a month cell opens week view for that week

Week View
- Shows Trip Sheets (child execution units)
- Operational planning surface
- Used for detailed staffing and execution management

--------------------------------------------------

8. Weekly Drawer Assignment Model

Weekly calendar drawer is a staged editor.

Behavior:
- Add/remove resource assignments locally
- No immediate server mutation per click
- User commits changes via Save Changes
- Save uses replaceTripSheetAssignments backend action

Reasoning:
- Drawer is treated as a mini editing session
- Optimized for multi-resource assignment workflows

--------------------------------------------------

9. Resource / Personal Views

My Trips
- Trip-level personal operational overview
- Shows Trips assigned to logged-in user through child Trip Sheet assignments

My Trip Sheets
- Flat chronological list of assigned Trip Sheets
- Grouped into:
  - Ongoing
  - Upcoming
  - Past
- Mobile-first operational execution view

Admin / Resource Dual Role
- Admin users may also function as resources
- Admins can access personal resource views
- Personal views always show only assignments for logged-in user

--------------------------------------------------

10. Notifications

Notification Model
- Manual trip-level notification system
- Triggered explicitly by admin
- No automated digest / cron-based notification system

Behavior
- One email per unique assigned resource for a Trip
- Email contains only Trip Sheets relevant to that resource
- App remains source of truth for live data

History / Logging
- All sends logged in:
  - trip_notifications
  - trip_notification_recipients

--------------------------------------------------

11. UX Design Principles

- System is an operational tool (speed > perfection)
- Minimize clicks and navigation
- Prefer inline and drawer-based interactions
- Use staged editing when repeated inline mutations would create friction
- Immediate visible feedback required for mutations
- Resource-facing views are mobile-first
- Full-card click targets preferred for operational mobile views

--------------------------------------------------

12. Navigation Philosophy

Navigation should reflect user intent / workflow grouping.

Operational/Admin Views
- Trips
- Calendar
- Templates
- Resources

Personal Operational Views
- My Trips
- My Trip Sheets

Account
- Profile

--------------------------------------------------

13. System Boundaries (Current)

- Conflict visibility exists at calendar level
- No automated conflict resolution engine
- No advanced analytics/reporting
- No CRM integration
- No automated scheduling engine

--------------------------------------------------

14. Current Focus

- Stabilize and refine operational UX
- Improve responsiveness / perceived performance
- Continue reducing architectural debt
- Build toward richer scheduling / utilization tooling over time

--------------------------------------------------

15. One-line Summary

A parent-child scheduling and operations system where Trips define structure, Trip Sheets define execution, and the UX is optimized for real-world operational flexibility and speed.