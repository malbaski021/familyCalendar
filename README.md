# Family Calendar

A shared family calendar with AI-powered assistance. Mobile-first web app for tracking children's events, appointments, and activities across the family.

## Status

In development. See [`proposal/DEVELOPMENT_PLAN.md`](proposal/DEVELOPMENT_PLAN.md) for the phased roadmap and [`proposal/FamilyCalendar_Proposal.docx`](proposal/FamilyCalendar_Proposal.docx) for the full solution proposal.

## Tech Stack

Next.js (App Router) · TypeScript · Tailwind CSS · Shadcn/ui · Supabase (PostgreSQL + Auth + Realtime) · Groq API (Llama 3) · Web Push · Open-Meteo · Vercel

## Branching Model

- `main` — production
- `develop` — staging / testing
- `feature/F<phase>-<slug>` — feature branches per development phase (e.g. `feature/F0-scaffolding`)

Workflow: feature branch → PR into `develop` → tested on staging → merged into `main` for production.
