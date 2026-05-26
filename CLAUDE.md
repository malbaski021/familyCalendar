@AGENTS.md
@proposal/DEVELOPMENT_PLAN.md

# Project context

Family Calendar — mobile-first web app, Next.js 16 + Supabase + Groq AI, fully described in `proposal/FamilyCalendar_Proposal.docx` (binary, not auto-loaded). The phased roadmap is in `proposal/DEVELOPMENT_PLAN.md` (auto-loaded above) — consult it before starting any new work to see which phase is next and what its acceptance criteria are.

## Branching workflow

- `main` — production (branch-protected, PR required, no direct push)
- `develop` — staging
- `feature/F<n>-<slug>` — one branch per phase, PR target is `develop`
- After merge into `develop`, the user manually promotes `develop` → `main` for production deploys via Vercel

## Quality rules (enforced)

Every phase ships with tests, lint clean, typecheck clean, CI green. See "Pravila kvaliteta" at the top of DEVELOPMENT_PLAN.md.

## Language conventions

- Code, identifiers, commit messages, PR titles/bodies, UI strings: **English**
- Conversation with user and DEVELOPMENT_PLAN.md: **Serbian (Latin)**
