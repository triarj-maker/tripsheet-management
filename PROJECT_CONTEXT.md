# Trip Sheet Management App – Project Context

## 1. Purpose

This is an internal operations tool used to manage and execute travel programs.

Primary goal:
- Replace manual coordination (WhatsApp, spreadsheets, memory)
- Create a single source of truth for all trip execution details

---

## 2. Core Concepts

### Trip Sheet
A structured document containing:
- trip details (title, destination, dates)
- customer / school / company
- operational plan (body text)
- assigned resources

### Resource
A person involved in execution:
- guide
- facilitator
- vendor

### Roles
- Admin: creates, edits, assigns, manages
- Resource: views assigned trip sheets only

---

## 3. Key Features

### Trip Management
- Create / edit / archive trip sheets
- Flexible fields (guest OR company)

### Assignment System
- Assign resources to trips
- Prevent duplicate assignments

### Notifications
- Assignment email (triggered)
- 3-day reminder (cron-based)
- Notification logging

### Calendar
- Monthly view
- Multi-day spanning trips
- Archived trips visible (faded)
- Compact 2-line cards (title + resource)

### Mobile UX
- No horizontal scroll
- Compact readable trip sheets
- Field-friendly design

---

## 4. Architecture

### Frontend
- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS

### Backend
- Supabase (PostgreSQL + Auth)
- Row-level security

### Notifications
- Resend (email delivery)

### Deployment
- Vercel (hosting + cron jobs)
- GitHub (version control)

---

## 5. Data Model (Simplified)

### trip_sheets
- id
- title
- destination
- start_date
- end_date
- guest_name
- company
- phone_number
- body_text
- is_archived
- created_by
- last_updated_by

### trip_sheet_assignments
- id
- trip_sheet_id
- resource_user_id
- assigned_by

### trip_sheet_notifications
- id
- trip_sheet_id
- resource_user_id
- type (assignment / reminder)
- status (sent / failed)
- sent_at
- error_message

---

## 6. Design Principles

### 1. Operations-first
- Speed > aesthetics
- Scanability > beauty

### 2. Source of Truth
- App = ground truth
- Emails = notifications only

### 3. Density matters
- More useful info per screen
- Reduce scrolling

### 4. Mobile is critical
- Must work in the field
- No complex interactions

### 5. Minimal features
- Avoid overbuilding
- Add only after real usage

---

## 7. Current UX Decisions

- Calendar cards show only:
  - Trip Title
  - Assigned Resource
- Hover reveals additional details (desktop)
- Archived = visually faded (no label)
- Fixed cell height for consistency
- No internal scroll in calendar

---

## 8. Known Limitations

- No Bigin integration (planned later)
- No analytics
- No retry for failed notifications
- No conflict detection in calendar

---

## 9. Future Ideas (Not Now)

- CRM integration (Zoho Bigin)
- WhatsApp notifications
- Resource conflict alerts
- Calendar drag-to-reschedule
- Notification dashboard

---

## 10. Development Philosophy

- Build → Use → Observe → Improve
- Do not overdesign upfront
- Prioritize real-world feedback over assumptions

---

## 11. How to Work on This Project

When making changes:
- Do not break existing workflows
- Keep UI compact and efficient
- Avoid adding unnecessary fields
- Always consider mobile usage

---

## 12. One-line Summary

A lightweight operations management system for running experiential travel programs, built for real-world usability.