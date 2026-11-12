# Echo Journeys Trip Management

**Last Updated:** 2026-11-12

An operational app for planning Trips, creating execution-focused Trip Sheets, assigning Facilitators and Experts, and managing trip tasks. Administrators manage scheduling and accounts; assigned users access their own work through Resource View.

## Stack and prerequisites

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4.
- Supabase PostgreSQL and Auth; server actions for mutations.
- FullCalendar for scheduling; Resend for manual Trip notifications.
- Custom server-side PDF generation; Vercel hosting.
- Node.js **20.9 or newer** (installed Next.js package requirement) and npm.
- An existing Supabase project with the application's schema, permission RPCs, and an active Administrator profile. This repository is not a complete empty-database bootstrap.

See [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) for behavior, [DATABASE.md](DATABASE.md) for schema evidence and migration guidance, and [AGENTS.md](AGENTS.md) for development rules.

## Local setup

From a checkout:

```bash
npm ci
```

Create an untracked `.env.local` with values for the appropriate development environment. Do not copy production credentials into shared files.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL; required by browser/server clients. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Supabase API key; required by browser/server clients. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only privileged client for Auth administration and guarded administrative operations. Never expose with a `NEXT_PUBLIC_` prefix. |
| `APP_BASE_URL` | Application origin used for recovery redirects and email links; use `http://localhost:3000` locally. |
| `RESEND_API_KEY` | Resend credential for manual Trip notifications. |
| `EMAIL_FROM` | Sender address for notification email. |
| `CRON_SECRET` | Bearer secret required by the retained auto-archive endpoint, whose archiving behavior is disabled. |

`VERCEL`, `VERCEL_PROJECT_PRODUCTION_URL`, and `NODE_ENV` are also read by the app and normally supplied by the hosting/runtime environment. Auth recovery origin selection falls back to Vercel metadata or request headers when necessary; configure the intended origin and allowed Supabase Auth recovery redirect URLs for each environment. Recovery uses `/auth/recovery` and `/reset-password`.

```bash
npm run dev
```

Open <http://localhost:3000> and sign in with a provisioned account. There is no documented seed command or public self-registration flow. Do not create a second Auth identity to recover a failed profile creation; follow the [permission recovery runbook](sql/verification/20261009_stage2b_runbook.md).

## Development and checks

Commands from `package.json`:

| Command | Purpose |
|---|---|
| `npm run dev` | Start Next.js development server. |
| `npm run lint` | Run ESLint. |
| `npm run build` | Build the production application. |
| `npm start` | Serve an existing production build. |

Additional repository checks (direct commands, **not npm scripts**):

```bash
npx tsc --noEmit
node tests/interface-view.mjs
node tests/multi-role-permissions.mjs
node tests/stage2a-team-actions.mjs
node tests/trip-tasks.mjs
node tests/resource-assignment-schedule.mjs
node tests/template-destinations.mjs
node tests/template-archive.mjs
```

These application tests use source inspection and/or transpiled modules with mocked boundaries; they do not establish live Supabase security or browser behavior. Database regression runners under `sql/tests/` use disposable PGlite fixtures and require an explicitly supplied local PGlite module path. PGlite is not a project dependency. See the [multi-role runbook](sql/verification/20261009_stage2b_runbook.md) and [task runbook](sql/verification/20261010_trip_task_runbook.md) before database validation. Do not point fixture tests at production.

## Build and deployment

Vercel is the hosting target. Configure environment variables for the intended deployment and use the established GitHub/Vercel release workflow. `npm run build` is the repository build command; no custom deployment script or automatic migration runner is defined. Confirm the deployed schema supports the release before deploying dependent application changes. Schema-changing releases follow their individual reviewed SQL runbooks; do not replay all SQL files.

[vercel.json](vercel.json) schedules `/api/cron/auto-archive-trips` at `0 2 * * *` (UTC). The authenticated handler currently returns `disabled: true` and changes no data; this is not an automated notification job.

After a release, verify login, Admin/Resource View switching, personal assignment scoping, and affected scheduling/task/PDF flows with appropriate test accounts. Local tests and repository SQL are not proof of production deployment or current RLS configuration.

## Recent Changes

| Date | Change | Description |
|---|---|---|
| 2026-11-12 | Add template regression commands | Listed direct test commands for destination handling, duplication and archive/restore behavior. |
| 2026-11-12 | Establish project onboarding reference | Replaced starter text with verified setup, configuration names, commands, deployment boundaries, and core documentation links. |
