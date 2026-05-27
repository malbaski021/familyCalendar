<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# data-testid on every interactive element

Every interactive JSX element **must** carry a `data-testid`. The ESLint rule `local/require-data-testid` enforces this as an error in CI — it is strict and has no `{...spread}` escape hatch; if a callsite spreads external props it must still attach an explicit `data-testid` on top.

What the rule treats as interactive:

1. Any JSX element with an `href` attribute (covers native `<a>` plus component wrappers like next-intl `<Link>`, `next/link`, etc.).
2. Native form/control tags: `button`, `input`, `select`, `textarea`, `form`.
3. Components in the configured list: `Button`, `Input`, `Textarea`, `Select`.

Where the rule does **not** run (configured in `eslint.config.mjs`):

- Test files (`*.test.*`, `src/test/**`).
- Shadcn primitives under `src/components/ui/**` (library code — consumers attach the testid on the wrapping element).

Naming convention: `<context>-<component>-<element>`, kebab-case, hierarchical from broad to narrow.

Examples:

- `signup-form-email-input`
- `signup-form-submit-button`
- `nav-language-toggle`
- `login-page-forgot-password-link`
- `calendar-day-2026-05-15-cell`

`asChild` (Radix Slot) renders nothing of its own — it merges into the JSX child. The rule **skips** asChild parents and checks the JSX child instead. Attach the testid on the inner element where it actually lands in the DOM, e.g. `<Button asChild><Link href="/login" data-testid="home-login-link">…</Link></Button>`.

When adding a new interactive primitive, register its component name in the rule options or add an explicit `data-testid` to every callsite.
