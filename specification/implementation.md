# Listjj 2 implementation plan

The canonical architecture and detailed API contract are in the root `specification.md`.
This document records execution order and acceptance checks.

## Scope confirmed from the legacy projects

- User accounts, password and optional Google/Microsoft sign-in, admin roles and pending approval.
- Per-user categories and notes/todos with descriptions, values, active state, tags, sequence ordering,
  category/item CRUD, move/sort, search, modified-date filtering and recent category.
- Item attachments, semicolon-delimited CSV import/export, user API keys, legacy watch/script APIs,
  and MCP tools for category/item management.
- Exclude experimental Service Bus/message consumers, Redis/cache infrastructure and old Blazor UI.
- Python/FastAPI backend and React/JavaScript frontend remain separate images. SQLite is the default;
  PostgreSQL must work via SQLAlchemy configuration. All edits remain under the repository root.
- Docker compose/GHCR deployment assets belong in this repository. After review and CI publication,
  deploy only to `/home/debian/skrypty/docker/listjj2` as requested.

## Implementation sequence

1. Audit the scaffold against the legacy REST routes and architecture contract.
2. Complete backend correctness/security and regression coverage.
3. Complete the React experience and validate its build.
4. Validate Docker/deployment configuration and document local setup in concise `README.md`.
5. Run tests/build checks, resolve findings, then request independent review.

## Acceptance checks

- Backend test suite passes with an isolated SQLite database; PostgreSQL driver/configuration is present.
- Frontend production build succeeds; item filtering includes text, category and modified-date range.
- Existing watch/script routes and authentication behavior are either preserved compatibly or clearly
  documented with an explicit migration contract.
- Upload limits are enforced before unbounded memory use; social login/admin bootstrap cannot grant
  privileged access from an unverified identity.
- GitHub workflow tests before publishing; compose and environment examples are internally consistent.
- README contains concise setup/deployment steps; `specification.md` remains the coding-agent contract.

## Progress notes

- Legacy aliases are implemented, including query-key authentication for the old watch route. Prefer
  the Bearer-authenticated REST API for new clients because query strings can be retained in logs.
- Uploads are read in capped chunks; both attachments and CSV imports use `MAX_UPLOAD_MB`.
- Initial admin registration requires a constant-time checked bootstrap token; normal registrations
  remain pending. Store the bootstrap token as a secret in `.env`.

## Frontend redesign task

### Design direction

- Make Listjj feel like an editorial personal-workspace product, not a generic dashboard: warm mineral
  canvas, deep pine navigation, restrained citrus accent, display serif for page titles, readable sans
  for controls, and compact mono labels only for metadata.
- Use a fixed desktop workspace rail, a mobile slide-over navigation, consistent spacing, clear page
  hierarchy, keyboard-visible focus, and reduced-motion-aware transitions.
- Use Tailwind CSS v4 and local shadcn/ui primitives for buttons, fields, select, badges, alerts,
  skeletons and structural components; use named `lucide-react` icons. Do not add animation packages;
  simple CSS transitions are sufficient.

### Routes and behavior to preserve

- `/login` and `/register`: preserve password, Google and Microsoft auth, pending-account messaging,
  and first-admin bootstrap; provide clear validation/busy/error/success states.
- `/items`: retain category, text, modified-date, tag ordering, active toggles, CRUD, files, CSV, and
  recent-category behavior. Use a compact, scannable row/list treatment with useful empty/loading states.
- `/categories`: retain create/edit/delete and explain destructive deletion before confirmation.
- `/users`: retain admin create/edit/delete/approval, with responsive table-to-row layout and status.
- `/settings`: retain API key generate/custom/copy, MCP and external API details, docs link and admin
  server information.
- Pending approval and unknown routes must remain legible, actionable and responsive.

### Acceptance checks

- Keep all routes and API interactions intact; no visual redesign may remove a capability.
- At 375px, tablet and desktop widths, no horizontal viewport overflow; mobile navigation is operable
  by keyboard and exposes appropriate labels/states.
- At 320px width and 667×375 / 1280×500 heights, long tags do not overflow and every navigation item
  remains reachable by scrolling.
- Verify contrast of functional text and focus indicators, labeled collection combobox, route titles,
  mobile auth heading, API failure retry states, and in-dialog destructive-action failures/pending state.
- Add automated Playwright regression tests for route focus/scroll, long-data overflow, mobile sheet,
  collection naming, CSV keyboard upload, roles retry and destructive-action pending/errors; CI runs
  these before publishing images.
- Production Vite build succeeds; backend pytest and Playwright tests pass; npm audit remains clear;
  update root architecture and concise README
  if setup or run instructions change.
- After final review and CI image publication, sync the reviewed compose file, pin the full reviewed
  SHA tag in the existing server `.env`, and deploy the frontend on port `8093`; verify it is healthy
  and leave its persistent SQLite volume unchanged.

## Mobile UI refinements (2026-11)

- On phones below 640px, keep the app bar to navigation, current page title, Notebook Find toggle,
  and sign out. Collapse the Notebook filter panel by default; the topbar and in-page disclosure share
  state, while layouts at 640px and wider stay expanded.
- Hide the Notebook hero number, eyebrow, and description on phones while retaining its focusable h1.
  Place compact stats alongside the New note action without narrow-screen overflow.
- Put create-form Cancel and Add to notebook in the form header; preserve edit-form footer actions and
  remove the decorative Plus from both form headers.
- Acceptance: the Playwright suite covers phone topbar, filter open/close and focus, 639/640px
  breakpoint, 320px overflow, stats/action alignment, and create-form header actions on mobile and
  desktop. The detailed execution specification is [plan/mobile-ui-refinements.md](../plan/mobile-ui-refinements.md).
