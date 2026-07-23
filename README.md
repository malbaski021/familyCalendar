# Family Calendar

> A mobile-first, AI-assisted shared calendar for families — track children's events, appointments, and activities in one place, in real time, across every family member's device.

<p>
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white">
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3FCF8E?logo=supabase&logoColor=white">
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss&logoColor=white">
  <img alt="Tests" src="https://img.shields.io/badge/tests-100%2B%20passing-success">
  <img alt="CI" src="https://img.shields.io/badge/CI-GitHub%20Actions-2088FF?logo=githubactions&logoColor=white">
</p>

Family Calendar is a full-stack Progressive Web App built to a real product specification and delivered in tightly-scoped, independently shippable phases. Every phase ships with tests, a green CI pipeline, and strict-mode TypeScript — the same discipline you'd expect on a production team.

---

## Table of contents

- [Highlights](#highlights)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture deep-dive](#architecture-deep-dive)
- [Testing](#testing)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [npm scripts](#npm-scripts)
- [Project structure](#project-structure)
- [Database & migrations](#database--migrations)
- [CI/CD & branching](#cicd--branching)
- [Roadmap](#roadmap)
- [License](#license)

---

## Highlights

A quick tour of the engineering decisions worth looking at:

- **16-table Postgres schema with ~60 Row-Level-Security policies** — data isolation is enforced in the database, not just the app layer. A family can never read another family's data, verified by integration tests running against a real Postgres instance.
- **Real-time collaboration** via Supabase Realtime — when one parent adds or edits an event, it appears on every other family member's screen instantly, with no manual cache management.
- **Optimistic edit locking + auto-saved drafts** — two people can't silently clobber each other's edits. A 15-minute lock with a 5-minute heartbeat, a 10-minute "save your draft?" nudge, and a 24-hour draft recovery flow.
- **On-demand recurrence expansion** — recurring events are expanded lazily within the requested date range (never pre-materialized), so an open-ended weekly series never balloons the database. Individual occurrences can be overridden or cancelled without touching the series.
- **Defense-in-depth super-admin enforcement** — an application check _mirrored by a database trigger_ guarantees at most one admin account, for a single hard-coded identity.
- **A custom ESLint rule** (`local/require-data-testid`) that fails CI if any interactive element ships without a stable, deterministic test id — testability enforced at the linter.
- **Fully internationalized** (English + Serbian Latin) with 291 translation keys kept in sync across both locales, URL-prefixed routing, and a runtime language switcher.
- **Installable PWA** with a service worker and VAPID Web Push notifications — no third-party push vendor.

---

## Features

Delivered end-to-end (phases F0–F10):

| Area                       | What works                                                                                                                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Auth**                   | Email/password sign-up, login, logout, password reset. Session persists across refresh via SSR-safe cookie handling. Protected routes redirect to login.                                     |
| **Invite-only onboarding** | Registration is invite-only. Admin creates a calendar and an Owner invite; Owner invites Members. Single-use tokens with 48h expiry, regeneration, and clear expired/used/revoked messaging. |
| **Family & children**      | Three-step onboarding wizard on first login; CRUD for the family's children list, reused between onboarding and settings.                                                                    |
| **Calendar views**         | Month, week (hourly timeline), and day views. Mobile bottom-nav + desktop top-nav. Fully URL-driven state (`?view=month&date=…`) so back/forward and sharing just work.                      |
| **Event CRUD**             | All-day and timed events, multi-day spans, categories (color + emoji), location, notes, and per-child tagging. Real-time sync across the family.                                             |
| **Recurring events**       | Daily / weekly / monthly patterns with an optional end date. Edit or cancel a single occurrence without affecting the rest of the series.                                                    |
| **Concurrency safety**     | Edit locks, lock-expiry warnings, and auto-saved drafts (see [Architecture](#architecture-deep-dive)).                                                                                       |
| **Audit log**              | Every user/system action is recorded. Filterable UI (by actor, action type, date range, search) with pagination; RLS scopes what each role can see.                                          |
| **Notifications**          | Installable PWA + service worker + VAPID Web Push, opt-in from Settings, with a "send test" verification button and dead-subscription cleanup.                                               |

Infrastructure in place, wiring scheduled for upcoming phases: multi-agent AI suggestions (Groq/Llama — tables + typed task queue ready), weather forecasts (Open-Meteo — cache table ready), and public share links.

---

## Tech stack

| Layer                | Choice                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------- |
| Framework            | Next.js 16 (App Router, React 19 Server Components, TypeScript strict)                    |
| Styling              | Tailwind CSS v4 + Shadcn/ui (Radix primitives)                                            |
| Internationalization | next-intl (`en`, `sr-Latn`), URL-prefixed routing                                         |
| Theming              | Custom theme provider (light / dark / system), cookie-persisted                           |
| Database             | Supabase — PostgreSQL, Row-Level Security, Realtime                                       |
| Auth                 | Supabase Auth (bcrypt, JWT in HTTP-only cookies)                                          |
| Forms & validation   | react-hook-form + Zod                                                                     |
| Push                 | Web Push + VAPID, custom service worker                                                   |
| Hosting              | Vercel (region pinned to `dub1` to co-locate with the Ireland database)                   |
| Testing              | Vitest 4 + React Testing Library + jsdom; integration tests against a real local Supabase |
| CI                   | GitHub Actions (`lint → typecheck → format:check → unit → integration → build`)           |
| Tooling              | Husky + lint-staged pre-commit, Prettier, Turbopack dev server                            |

---

## Architecture deep-dive

The parts I'd point a reviewer to first.

### Security is enforced in the database

Every one of the 16 tables has RLS enabled, backed by ~60 policies and four `SECURITY DEFINER` helper functions (`is_admin`, `is_family_member`, `is_family_owner`, `event_family_id`). The application code doesn't _decide_ who can see what — Postgres does, and the app inherits it. The `rls.test.ts` integration suite proves a second family cannot read the first family's rows even with a valid session.

Super-admin status is protected twice: the app promotes a single hard-coded email, and a database trigger (`enforce_super_admin`) refuses to let any other row hold `role = 'admin'`. If the app layer were ever bypassed, the database still holds the line.

### Real-time without the boilerplate

The `events` table is published to Supabase Realtime. A small client component subscribes to INSERT/UPDATE/DELETE scoped to the current `family_id` and calls `router.refresh()` — letting React Server Components re-fetch on the server. There's no client-side cache to invalidate and no state to reconcile; the server is the single source of truth.

### Recurrence that scales

Recurring events are **never** pre-expanded into rows. `recurrence.ts` is a pure function that expands occurrences only within the date range the calendar is currently showing, clamped by the series end date (with a hard 5000-iteration safety cap). Per-occurrence edits and cancellations are stored as sparse overrides in `event_instances`, applied at read time. An open-ended "every Monday" event costs exactly one row.

### Editing without collisions

When two parents open the same event, the first acquires a lock (`locked_by` / `locked_at`). The second sees a "someone is editing" banner instead of a silent overwrite. A client shell manages the lifecycle: a 5-minute heartbeat keeps the lock alive, a 10-minute toast prompts "save your draft?", and at 15 minutes the lock expires and the in-progress edit is persisted to the `drafts` table (24h TTL) for recovery. Locks release immediately on save or cancel; the server-side TTL is the safety net.

### Testability is a first-class constraint

`AGENTS.md` documents a project rule: every interactive element carries a hierarchical `data-testid` (`<context>-<component>-<element>`). This isn't a convention people remember to follow — it's a **custom ESLint rule** (`eslint-rules/require-data-testid.js`) that errors in CI, with no `{...spread}` escape hatch, and it's self-tested. Deterministic selectors for free.

---

## Testing

Two suites, two configs, both run in CI. **100+ test cases** total.

### Unit (`vitest.config.ts`, jsdom)

Fast, no external services. Covers form components, Zod schemas, and the pure logic that's easy to get subtly wrong: recurrence expansion, calendar range math (Monday week start, DST-safe stepping), slugify (with Serbian diacritics), and the `cn()` class merger. Run with `npm run test:ci`.

### Integration (`vitest.integration.config.ts`, node)

Runs against a **real local Supabase Docker stack**, not mocks — the only honest way to test RLS and triggers. Covers the auth lifecycle, invite flow (single-use, expiry, optimistic-lock consume, idempotent double-consume), event CRUD with cascades, recurring overrides, lock/draft behavior, and the RLS isolation guarantees. Run with `npm run test:integration` (needs `npm run db:start` first). In CI, the `supabase/setup-cli` action boots the stack automatically.

---

## Getting started

### Prerequisites

Install once (Windows commands shown; equivalents exist for macOS/Linux):

| Tool           | Version | Install                                                        |
| -------------- | ------- | -------------------------------------------------------------- |
| Node.js        | 22 LTS  | `nvm install 22 && nvm use 22`                                 |
| Docker Desktop | latest  | <https://www.docker.com/products/docker-desktop/>              |
| WSL 2          | latest  | `wsl --install` (admin PowerShell, then restart)               |
| Supabase CLI   | 2.x     | `scoop install supabase` (add the supabase scoop bucket first) |
| GitHub CLI     | 2.x     | `winget install GitHub.cli && gh auth login`                   |

Docker Desktop must be **running** during local development — the Supabase CLI uses it for the local Postgres stack.

### First-time setup

```bash
# 1. Clone and enter the repo
git clone https://github.com/malbaski021/familyCalendar.git
cd familyCalendar

# 2. Install dependencies
npm install

# 3. Copy the env template and fill it in (see "Environment variables")
cp .env.example .env.local

# 4. Boot the local Supabase stack (first run pulls Docker images, ~3 min)
npm run db:start

# 5. Apply migrations + seed data
npm run db:reset

# 6. Start the dev server
npm run dev
```

Open <http://localhost:3000>. Locales are URL-prefixed: `/en`, `/sr-Latn`.

---

## Environment variables

`.env.local` (gitignored) holds your personal development secrets; its shape is defined by `.env.example`. Three groups:

**1. Cloud Supabase (production target)** — also set in Vercel so deploys reach the live database:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

**2. Supabase CLI tokens (local only)** — used by `link`, `db push`, `gen types`; never deployed:

```
SUPABASE_ACCESS_TOKEN=sbp_...     # https://supabase.com/dashboard/account/tokens
SUPABASE_DB_PASSWORD=...
```

**3. Local Supabase (Docker) — integration tests** — copy from `supabase status` on first run:

```
SUPABASE_LOCAL_URL=http://127.0.0.1:54321
SUPABASE_LOCAL_ANON_KEY=sb_publishable_...
SUPABASE_LOCAL_SERVICE_KEY=sb_secret_...
```

**Web Push (Settings → notifications)** — generate with `npx web-push generate-vapid-keys`:

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@example.com
```

`GROQ_API_KEY` will be added when the AI phase (F11) is wired.

---

## npm scripts

| Script                            | What it does                                                    |
| --------------------------------- | --------------------------------------------------------------- |
| `npm run dev`                     | Next.js dev server (Turbopack) on port 3000                     |
| `npm run build`                   | Production build                                                |
| `npm run start`                   | Serve the production build                                      |
| `npm run lint`                    | ESLint (includes the custom `data-testid` rule)                 |
| `npm run typecheck`               | `tsc --noEmit`                                                  |
| `npm run format` / `format:check` | Prettier write / check                                          |
| `npm run test`                    | Vitest watch mode                                               |
| `npm run test:ci`                 | Unit tests, single run                                          |
| `npm run test:integration`        | Integration tests against local Supabase                        |
| `npm run db:start` / `db:stop`    | Boot / stop the local Supabase Docker stack                     |
| `npm run db:reset`                | Drop local DB, re-apply migrations, run seed                    |
| `npm run db:types`                | Regenerate `src/types/database.ts` from the linked cloud schema |

---

## Project structure

```
src/
  app/[locale]/               # All routes are locale-prefixed
    (app)/                    # Authenticated shell: calendar, admin, audit, settings, profile
      calendar/[id]/…         # Event detail, edit (locked), per-occurrence override editor
    (auth)/                   # login, signup, forgot-password, reset-password
    onboarding/               # First-login wizard
    invite/[role]/[token]/    # Invite acceptance
  app/api/cron/keep-warm/     # Vercel cron endpoint
  components/
    calendar/                 # month/week/day views, event form, realtime + lock shells
    auth/ admin/ audit/ family/ nav/ notifications/ onboarding/
    ui/                       # Shadcn primitives
  lib/
    auth/                     # Server actions, guards, session, super-admin
    calendar/                 # CRUD, recurrence, view math, locks, drafts
    family/ audit/ notifications/ supabase/
  i18n/                       # next-intl routing, navigation, request config
  test/integration/           # Tests against a real local Supabase
  types/database.ts           # Generated Supabase types

supabase/migrations/          # 12 timestamped SQL migrations (16 tables, RLS, triggers)
eslint-rules/                 # Custom require-data-testid rule (+ its own test)
messages/                     # en.json / sr-Latn.json (291 keys each)
.github/workflows/ci.yml      # CI pipeline
vercel.json                   # Region pin + keep-warm cron
```

---

## Database & migrations

The schema lives in 12 timestamped, **append-only** SQL migrations under `supabase/migrations/`. Workflow for a change:

```bash
supabase migration new <descriptive_name>   # 1. scaffold
# 2. edit the generated SQL
npm run db:reset                             # 3. clean re-apply locally
npm run test:integration                     # 4. verify against the new schema
supabase db push --linked                    # 5. push to cloud
npm run db:types                             # 6. regenerate TS types
# 7. commit the migration AND the updated src/types/database.ts
```

Never edit a migration that has already been pushed — write a new one that supersedes it.

---

## CI/CD & branching

**CI** (`.github/workflows/ci.yml`) runs on every PR and on pushes to `main`/`develop`, with in-progress runs cancelled on new pushes. Stages, in order:

```
npm ci → lint → typecheck → format:check → unit tests → (boot Supabase) → integration tests → build
```

A red check blocks merge. Locally, a Husky pre-commit hook runs `eslint --fix` + `prettier --write` on staged files, so malformed code never reaches a commit.

**Branching:**

- **`main`** — production, branch-protected (PR required, no direct push). Vercel deploys on merge.
- **`develop`** — staging. Vercel preview deploy.
- **`feature/F<n>-<slug>`** — one branch per phase; PRs target `develop`.

Promotion is a deliberate `develop → main` PR, which triggers the production deploy. On the free tier, a daily Vercel cron (`vercel.json`) pings a `CRON_SECRET`-guarded endpoint to keep the Supabase project from auto-pausing after inactivity.

---

## Roadmap

Built in independently shippable phases. See [`proposal/DEVELOPMENT_PLAN.md`](proposal/DEVELOPMENT_PLAN.md) for the full plan and acceptance criteria.

|     | Phase       |                                                                             |
| --- | ----------- | --------------------------------------------------------------------------- |
| ✅  | **F0**      | Scaffolding, Tailwind, Shadcn, i18n, theming, Vitest, CI, Husky             |
| ✅  | **F1**      | 16-table Supabase schema, RLS, integration tests, generated types           |
| ✅  | **F2**      | Authentication + session middleware                                         |
| ✅  | **F2.1**    | `data-testid` ESLint rule + language switcher                               |
| ✅  | **F3**      | Invite-only registration + super-admin enforcement                          |
| ✅  | **F4**      | Family, children, and onboarding wizard                                     |
| ✅  | **F5**      | Month / week / day calendar views                                           |
| ✅  | **F6**      | Event CRUD + realtime sync                                                  |
| ✅  | **F7**      | Recurring events with per-occurrence override                               |
| ✅  | **F8**      | Edit locking + auto-saved drafts                                            |
| ✅  | **F9**      | Audit log UI with filters + pagination                                      |
| ✅  | **F10**     | Web Push notifications + PWA                                                |
| ⏳  | **F11**     | Multi-agent AI suggestions (Groq/Llama)                                     |
| ⏳  | **F12**     | Weather forecasts (Open-Meteo)                                              |
| ⏳  | **F13–F18** | Share links, settings, account archival, offline mode, cron jobs, QA polish |

---

## License

Private project — not licensed for redistribution at this time.
