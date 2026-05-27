<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# data-testid on every interactive element

Every interactive JSX element (`button`, `input`, `select`, `textarea`, `form`, `a` with `href`, plus `Button`, `Input`, `Textarea`, `Select`) **must** carry a `data-testid`. The ESLint rule `local/require-data-testid` enforces this and runs as an error in CI.

Convention: `<context>-<component>-<element>`, kebab-case, hierarchical from broad to narrow.

Examples:

- `signup-form-email-input`
- `signup-form-submit-button`
- `nav-language-toggle`
- `nav-theme-toggle`
- `calendar-day-2026-05-15-cell`

Escape hatches the rule honours:

- The element has a `{...spread}` attribute (testid may be inside).
- The element has `asChild` (Radix Slot forwards attributes to the child).
- The file is a test file or lives under `src/test/**`.
- The file lives under `src/components/ui/**` (Shadcn primitives — consumers attach the testid on the wrapping element).

When adding a new interactive primitive, register its component name in the rule options or add an explicit `data-testid` to every callsite.
