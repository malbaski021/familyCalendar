# Family Calendar

A shared family calendar with AI-powered assistance. Mobile-first web app for tracking children's events, appointments, and activities across the family.

Full specification: [`proposal/FamilyCalendar_Proposal.docx`](proposal/FamilyCalendar_Proposal.docx).
Phased roadmap and progress: [`proposal/DEVELOPMENT_PLAN.md`](proposal/DEVELOPMENT_PLAN.md).

---

## Tech stack

| Layer          | Choice                                 |
| -------------- | -------------------------------------- |
| Framework      | Next.js 16 (App Router, TypeScript)    |
| Styling        | Tailwind CSS v4 + Shadcn/ui (Radix)    |
| i18n           | next-intl (en, sr-Latn)                |
| Theming        | next-themes (light / dark / system)    |
| Database       | Supabase (PostgreSQL + RLS + Realtime) |
| Authentication | Supabase Auth (bcrypt, JWT cookies)    |
| AI inference   | Groq API (Llama 3) — coming in F11     |
| Push           | Web Push + VAPID — coming in F10       |
| Weather        | Open-Meteo — coming in F12             |
| Hosting        | Vercel                                 |
| Tests          | Vitest + React Testing Library + jsdom |
| CI             | GitHub Actions                         |

---

## Prerequisites

Install the following once (Windows examples; equivalents exist for macOS/Linux):

| Tool           | Version | Install command                                                                                    |
| -------------- | ------- | -------------------------------------------------------------------------------------------------- |
| Node.js        | 22 LTS  | via nvm-windows: `nvm install 22 && nvm use 22`                                                    |
| Docker Desktop | latest  | https://www.docker.com/products/docker-desktop/                                                    |
| WSL 2          | latest  | `wsl --install` (admin PowerShell, then restart)                                                   |
| Supabase CLI   | 2.x     | `scoop bucket add supabase https://github.com/supabase/scoop-bucket.git && scoop install supabase` |
| GitHub CLI     | 2.x     | `winget install GitHub.cli`, then `gh auth login`                                                  |

Docker Desktop must be **running** while developing locally — the Supabase CLI uses it for the local Postgres stack.

---

## First-time setup

```bash
# 1. Clone and enter the repo
git clone https://github.com/malbaski021/familyCalendar.git
cd familyCalendar

# 2. Install JS dependencies
npm install

# 3. Copy environment template and fill it in
cp .env.example .env.local
# Edit .env.local — see "Environment variables" below

# 4. Boot the local Supabase stack (downloads Docker images on first run, ~3 min)
npm run db:start

# 5. (Optional) Wipe + re-apply migrations + seed data
npm run db:reset

# 6. Start the dev server
npm run dev
```

Open http://localhost:3000 in your browser. URL-prefixed locales: `/en`, `/sr-Latn`.

---

## Environment variables

`.env.local` (gitignored) contains your **personal** development secrets. The shape is defined by `.env.example`. Three groups:

### 1. Cloud Supabase project (production target)

These are also set in Vercel (Settings → Environment Variables) so production / preview deploys can reach the live database.

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 2. Supabase CLI tokens (local-only)

Used by `supabase link`, `db push`, `gen types`. Never deployed to Vercel.

```
SUPABASE_ACCESS_TOKEN=sbp_...
SUPABASE_DB_PASSWORD=...
```

Get the access token from https://supabase.com/dashboard/account/tokens.

### 3. Local Supabase (Docker) — integration tests

These are deterministic per Supabase CLI release; copy them from `supabase status` output the first time.

```
SUPABASE_LOCAL_URL=http://127.0.0.1:54321
SUPABASE_LOCAL_ANON_KEY=sb_publishable_...
SUPABASE_LOCAL_SERVICE_KEY=sb_secret_...
```

### Coming in later phases

- `GROQ_API_KEY` (F11)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (F10)

---

## npm scripts

| Script                     | What it does                                              |
| -------------------------- | --------------------------------------------------------- |
| `npm run dev`              | Start Next.js dev server on port 3000                     |
| `npm run build`            | Production build                                          |
| `npm run start`            | Run production server (after `build`)                     |
| `npm run lint`             | ESLint                                                    |
| `npm run typecheck`        | `tsc --noEmit`                                            |
| `npm run format`           | Prettier write                                            |
| `npm run format:check`     | Prettier check (CI)                                       |
| `npm run test`             | Vitest watch mode                                         |
| `npm run test:ci`          | Vitest single run (unit only)                             |
| `npm run test:integration` | Vitest against local Supabase (requires `db:start`)       |
| `npm run db:start`         | `supabase start` — boots Docker Postgres + services       |
| `npm run db:stop`          | `supabase stop`                                           |
| `npm run db:reset`         | Drop local DB, re-apply migrations, run seed              |
| `npm run db:types`         | Generate `src/types/database.ts` from linked cloud schema |

---

## Project structure

```
src/
  app/[locale]/               # All routes are locale-prefixed
    (auth)/                   # Auth route group (login, signup, reset)
    calendar/                 # Calendar (protected by middleware)
  components/
    auth/                     # SignUpForm, LoginForm, LogoutButton, ...
    ui/                       # Shadcn primitives
  lib/
    auth/                     # Server actions, schemas, getCurrentUser, useAuth
    supabase/                 # Browser, server, middleware clients (typed)
    utils.ts                  # cn() Tailwind class merger
  i18n/                       # next-intl routing + navigation + request config
  test/
    integration/              # Tests against real local Supabase
    setup.ts                  # jsdom + matchMedia mock
    utils.tsx                 # renderWithProviders helper
  types/database.ts           # Generated Supabase types
  proxy.ts                    # Combined next-intl + Supabase session middleware

supabase/
  migrations/                 # SQL migrations (timestamped, applied in order)
  seed.sql                    # Local-dev seed data
  config.toml                 # Local stack config

messages/                     # next-intl translation JSON
proposal/                     # Original spec + development plan
.github/workflows/ci.yml      # GitHub Actions CI pipeline
```

---

## Branching workflow

- **`main`** — production. Branch-protected (PR required, no direct push). Vercel deploys to https://family-calendar-two-pink.vercel.app.
- **`develop`** — staging. Vercel staging deploy at https://familycalendarstage.vercel.app.
- **`feature/F<n>-<slug>`** — one branch per development phase (e.g. `feature/F2-auth`). PR target is always `develop`.

Workflow:

```
feature/F<n>-... → PR into develop → CI green → merge → manual promotion develop → main
```

The promotion `develop → main` is done by opening a PR from `develop` to `main` and merging it, which triggers a Vercel production deploy.

---

## Tests

Two suites with separate configs:

### Unit (`vitest.config.ts`)

- jsdom environment
- Excludes `src/test/integration/**`
- Run with `npm run test:ci`
- Fast — no external services required

### Integration (`vitest.integration.config.ts`)

- node environment
- Talks to local Supabase Docker stack via `SUPABASE_LOCAL_*` env vars
- Includes only `src/test/integration/**/*.test.ts`
- Run with `npm run test:integration` (requires `npm run db:start` first)

In CI, `supabase/setup-cli` action starts the stack automatically.

---

## Database changes

1. Create migration: `supabase migration new <descriptive_name>`
2. Edit the generated SQL file in `supabase/migrations/`
3. Apply locally: `npm run db:reset` (clean re-apply) or `supabase migration up`
4. Test against the new schema: `npm run test:integration`
5. Push to cloud: `supabase db push --linked` (uses your `SUPABASE_ACCESS_TOKEN`)
6. Regenerate TS types: `npm run db:types`
7. Commit the migration **and** the updated `src/types/database.ts`

Migrations are **append-only**. Never edit a migration that has already been pushed to cloud — write a new one that supersedes it.

---

## Code quality

Quality gates enforced before merge:

1. **Husky pre-commit** runs `eslint --fix` and `prettier --write` on staged files
2. **CI** runs `lint`, `typecheck`, `format:check`, `test:ci`, `test:integration`, `build` on every PR
3. **Branch protection** on `main` blocks direct pushes

Avoid:

- `any` and `// @ts-ignore` in finalized code (use generated types or explicit interfaces)
- Committing `.env.local` or any file with real secrets
- Skipping hooks (`--no-verify`) — fix the underlying issue instead

---

## Phase status

See [`proposal/DEVELOPMENT_PLAN.md`](proposal/DEVELOPMENT_PLAN.md) for the full picture. Quick summary:

- ✅ **F0** — Scaffolding, Tailwind, Shadcn, i18n, theme, Vitest, CI, Husky
- ✅ **F1** — Supabase 16-table schema, RLS, integration tests, types
- 🚧 **F2** — Authentication (signup, login, logout, password reset)
- ⏳ F3–F18 — see plan

---

## License

Private project. Not licensed for redistribution at this time.
