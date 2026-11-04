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

> Superseded in part by [Notebook top row and filter toggle (revision 2)](#notebook-top-row-and-filter-toggle-revision-2).
> The filter panel now stays closed at every width, the in-page "Find & filter" disclosure is removed, and the
> desktop hero/stats layout is replaced. The phone topbar, create-form and design-token rules below still apply.

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

## Notebook top row and filter toggle (revision 2)

Status: implemented and cleanly reviewed; deployment in progress. Date: 2026-11-04. Baseline: `HEAD` `0b8bfca` (after `435e472`).
Scope: frontend `/items` page, app bar, Playwright tests, docs and deployment (explicitly requested by the user). No backend, API, data or dependency change.

Supersedes from `plan/mobile-ui-refinements.md`: A1-A5 where they conflict (phone-only filter collapse, hero and stats
layout at 640px and up), R2, R3, R4, and the matching acceptance items. Still valid: R1 phone topbar (except the
magnifier now shows at all widths), R5 create form, R6 design tokens, R7 non-goals.

### 1. Objective

On `/items`, replace the stacked hero, the separate stats band and the always-open filter panel with one compact
top row: title, three stats, and New note. The Find/filter panel stays hidden until the user presses the magnifier
("Find notes") in the app bar, at every width. All existing functions keep working.

### 2. Current state (verified in code)

`frontend/src/pages/ItemsPage.jsx`
- L2 imports `ChevronDown`, `Plus`, `Search`, etc.; L9 imports `PageHeader`.
- L27 `useNotebookFilters()` gives `filtersOpen`, `setFiltersOpen`, `openFilters`.
- L132 `filtersActive` already computed (search, category, dates). L133 `newNoteAction` (New note toggle, or "Create a collection" link, or null when collections fail).
- L136-145 `PageHeader` with number "01", eyebrow "Your personal index", h1 `notebook-title`, description, `compactOnMobile`.
- L147 collections-error banner.
- L149-156 phone stats row (`data-testid="mobile-stats-row"`, `mobile-stats-grid`, `sm:hidden`).
- L158-162 desktop stats band (`border-y`, `hidden sm:grid`).
- L164-217 `<section aria-label="Filter notebook">` always rendered. L165-172 phone-only "Find & filter" button. L173 `<div id="notebook-filters" hidden={!filtersOpen}>` wraps the controls (L174-215): search `#item-search` (L179, `scroll-mt-16`), Collection select, two date fields, Sort tags/Clear, footer with collection name, "Updating" status, Export, Import.

`frontend/src/components/AppShell.jsx`
- L26-32 `NotebookFilterContext` and `useNotebookFilters`.
- L131 `filtersOpen` initial value from `matchMedia("(min-width: 640px)")`; L142-147 breakpoint listener; L149-151 pathname effect resets to the breakpoint value; L153-159 focus effect using `document.getElementById("item-search")`; L161-164 `openFilters`.
- L140 `notebookRoute`. L198 magnifier `Button` (`aria-label="Find notes"`, `aria-expanded`, `aria-controls="notebook-filters"`) with `sm:hidden`.
- L207 provider value `{ filtersOpen, setFiltersOpen, openFilters }`.

Other
- `PageHeader.jsx` is used by `CategoriesPage` (L85) and `SettingsPage` (L134) without `compactOnMobile`. Notebook is the only user of that prop.
- `ItemForm.jsx` already has create-mode actions in its header and no Plus icon. No change.
- `ui/input.jsx` is a plain function component (no `forwardRef`). Do not pass `ref` to `Input`.
- No ESLint/Prettier config exists. `frontend/package.json` scripts: `build`, `test:e2e`.

### 3. Requirements

**R1. Top row (`/items`, all widths)**
- In `ItemsPage`, drop the `PageHeader` usage. Render one `<header data-testid="notebook-top-row">` inside the existing `section[aria-labelledby="notebook-title"]`.
  Layout: `flex flex-wrap items-center justify-between gap-x-4 gap-y-3`, bottom margin about `mb-4 sm:mb-5` (proposed).
- Left group: h1 "The notebook." (`id="notebook-title"`, `data-page-title`, `tabIndex={-1}`, `font-display`).
  Below 640px: `sr-only` (the topbar already shows "Notebook"). 640px and up: visible, compact (proposed `sm:text-[2.25rem] leading-none`).
- Stats: one group only. Keep labels "In view", "In progress", "Collected in" and values `items.length`, `activeCount`, `categories.length`.
  Mono 9px labels, serif values (about `text-xl`), thin `border-l` dividers. Unit words ("notes", "active", "lists") visible from 640px, `sr-only` below.
  Remove the `border-y` band (L158-162) and the duplicate `mobile-stats-row` (L149-156).
- Right slot: `newNoteAction` unchanged (text "New note" / "Close note", toggles `adding`, height 40-44px).
  No button when collections fail. "Create a collection" link when there are no collections.
- Remove on `/items` at all widths: "01" number, eyebrow "Your personal index", and the description. The h1 stays. (See A4.)
- Do not change `workspace-main` padding, AppShell header height, or the footer (shared by all routes).
- Proposed targets (checked by Playwright):
  - Row height at most 72px at 1024x768 and 1280x720 (one line).
  - At 375x667, stats and New note share one line.
  - At 320px, stats may wrap below the button (existing order rule).
  - At 640-1023px, the row may wrap to two lines.
  - Panel closed at 1280x720: the first block after the row (skeleton, notes, or empty state) starts at most 220px from the viewport top.

**R2. Filter panel hidden by default at every width**
- On the outer `<section>` (L164) put `id="notebook-filters"`, `aria-label="Filter notebook"` and `hidden={!filtersOpen}`. This avoids an empty bordered box when closed.
  Remove the phone disclosure button (L165-172) and the inner wrapper div (L173 and its closing `</div>` at L216).
- Keep the panel contents (L174-215) unchanged.
- `AppShell.jsx`: `filtersOpen` starts `false`. Delete the `matchMedia` listener (L142-147) and the breakpoint-based pathname effect (L149-151). Replace them with `useEffect(() => setFiltersOpen(false), [pathname])`.
- Do not use `sm:hidden`, `hidden sm:*`, or breakpoint checks for `filtersOpen`.
- Filter values (search, collection, dates) are unchanged and stay applied while closed. Not persisted (no localStorage, no URL params).
- Only the magnifier opens or closes the panel. No other opener in the page.

**R3. Magnifier in the app bar (`AppShell.jsx` L198)**
- Show when `notebookRoute` at all widths: remove `sm:hidden`. Keep `variant="ghost"`, `size-11`, `Search` icon, `aria-label="Find notes"`, `aria-expanded={filtersOpen}`, `aria-controls="notebook-filters"`. Add `relative`.
- Click: `setFiltersOpen((open) => !open)`.
- Active-filter dot (added, see A7): when `filtersActive` is true, render
  `<span data-testid="notebook-filter-dot" aria-hidden="true" className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-[#729256]" />`.
  Also set `aria-describedby="notebook-filter-status"` on the button. That id is an `sr-only` span with text "Filters active", rendered only when `filtersActive`. The dot shows whether the panel is open or closed.
- State flow: AppShell holds `filtersActive` (`useState(false)`) and its setter in context. ItemsPage calls
  `useEffect(() => { setFiltersActive(filtersActive); }, [filtersActive, setFiltersActive]);`
  and `useEffect(() => () => setFiltersActive(false), [setFiltersActive]);` so the dot clears when the page unmounts.
- Context value: `{ filtersOpen, setFiltersOpen, filtersActive, setFiltersActive }`. Remove `openFilters` and the `focusSearchOnOpen` ref if unused.

**R4. Focus and scroll**
- Remove the focus effect and `focusSearchOnOpen` ref from `AppShell.jsx` (L132, L153-159, L161-164).
- In `ItemsPage`: add `sectionRef` on the outer filter `<section>`. Then
  `useEffect(() => { if (filtersOpen) sectionRef.current?.querySelector("#item-search")?.focus(); }, [filtersOpen]);`
  Use the default focus (it scrolls into view). Do not pass `preventScroll`. Do not change `ui/input.jsx`.
- Search input class: `scroll-mt-20` (80px) instead of `scroll-mt-16`, so the input clears the 74px desktop app bar.
- Closing via the magnifier keeps focus on the magnifier (the activated control).
- Route change: `RouteMetadata` in `App.jsx` still focuses the h1 (unchanged).
- Escape to close: not implemented (see A9).

**R5. Unchanged**
- `ItemForm.jsx`, `ItemCard.jsx`, items list and states (loading, empty, error), CSV import/export, sort, collections-error banner (stays directly under the top row).
- Phone topbar title and sign-out, slide-over nav, desktop sidebar, desktop breadcrumb/tagline/pill, Collections, People and Settings pages.
- `PageHeader.jsx` behaviour. Optional: delete the `compactOnMobile` branch, since Notebook no longer uses it.

**R6. Design**
- Existing tokens only (pine `#244b3d` / `#294638`, mineral surfaces, `#58675d` label text, `#729256` for the filter dot).
- No new border, shadow or card wrapper on the top row. No new dependency. No new motion.
- Visible focus rings kept. Functional text meets WCAG AA (existing tokens).

### 4. Files

| File | Change |
|---|---|
| `frontend/src/pages/ItemsPage.jsx` | Top row (R1), single stats group, panel `hidden` on outer section (R2), remove disclosure, focus effect and `sectionRef` (R4), publish `filtersActive` (R3), remove unused imports (`ChevronDown`, `PageHeader`). |
| `frontend/src/components/AppShell.jsx` | Default closed, remove breakpoint logic, magnifier at all widths with dot and `aria-describedby`, context fields, remove focus effect. |
| `frontend/src/components/PageHeader.jsx` | Optional: remove `compactOnMobile` branch. Other pages unchanged. |
| `frontend/tests/redesign.spec.js` | Update and add tests (section 7). |
| `specification.md` (root) | Implementation phase only: sections 3.1 and 10 (section 6). Not edited during planning. |
| `progress.md` | Implementation phase: new task block. |
| `plan/mobile-ui-refinements.md` | Implementation phase: one-line "superseded in part" note at the top. |
| `README.md` | Keep deployment instructions concise; normalize the full-SHA image-tag placeholder. |
| `specification/implementation.md` | This section, plus the superseded note in the previous section. |
| `ItemForm.jsx`, `ItemCard.jsx`, `ui/input.jsx`, backend, `package.json`, `.github/` | No change. |

### 5. Implementation approach (ordered)

1. Baseline: `cd frontend; npm run build; npm run test:e2e` must pass before any edit. Save baseline screenshots of `/items` at 320x640, 375x667, 667x375, 768x1024, 1280x720 (panel closed, panel open, New note open) under `frontend/test-results/` (gitignored). Do not commit them.
2. `AppShell.jsx`: closed default, remove breakpoint effects and focus effect, magnifier at all widths, dot, context fields.
3. `ItemsPage.jsx`: new top row, single stats group, outer panel `hidden`, focus effect via `sectionRef`, publish `filtersActive`, `scroll-mt-20`.
4. Remove unused imports (`ChevronDown`, `PageHeader` in `ItemsPage`). Keep `Plus` (New note icon) and `Search` (search field icon).
5. Update and add tests (section 7).
6. Visual QA with Playwright at the baseline widths. Check overflow, row height and the first-block position. Confirm Collections and Settings are unchanged at 375 and 1280.
7. Docs (section 6) and the `progress.md` entry.
8. Run `npm run build` and `npm run test:e2e`. Backend is unchanged (`pytest` optional).
9. No commit, push or deploy unless the user asks (AGENTS.md).

### 6. Documentation edits (implementation phase)

- Root `specification.md` section 3.1, Notebook paragraph (L78-83): describe one top row at all widths; panel closed on load and opened only by the app-bar Find magnifier; active-filter dot; phone topbar as before. Remove the sentence "Desktop page-header, stats, and filter layouts remain expanded and unchanged."
- Root `specification.md` section 10 (L209-213): update the test description for the removed disclosure and the new checks.
- `progress.md`: new block with tasks, status, commit SHA, test results and deployment result.
- `README.md`: keep deployment instructions concise and use the same `sha-<full-commit-sha>` image-tag placeholder as the architecture spec and `.env.example`.

### 7. Tests (`frontend/tests/redesign.spec.js`)

Update:
- "long user data ... select popup" (320px, L140-162): click the `Find notes` magnifier instead of `Find & filter` before opening the Collection combobox.
- "phone toolbar, collapsed filters and compact stats" (L164-226): remove disclosure assertions (L193-210). Assert 9px labels and live stats, unit-word visibility at phone/desktop breakpoints, no hero number/copy, magnifier `aria-expanded`, active indicator semantics, search focus below the sticky topbar, and focus back on the magnifier when closed. Replace `mobile-stats-row` and `mobile-stats-grid` with `notebook-top-row` and the stats group. Keep 44px targets, the 320px overflow check and the 320px wrap-order check.
- "filter disclosure is always expanded at 640px and up" (L228-242): rename to "filter panel is closed by default at every width". At 320–1280px, `#notebook-filters` is hidden on load, the magnifier exposes correct `aria-expanded` state, and reload after opening stays closed. Keep the sticky-header breadcrumb assertions at 640px and the 40px navigation button width.
- CSV importer test (L315-334): open the magnifier before locating the `Import` button.

Add:
- Top row at 1024x768 and 1280x720: height at most 72px; New note and stats share a vertical centre within 4px; first content block at most 220px from the top with the panel closed.
- Panel contents (`Export`, `Import`, `Sort tags`) not visible while closed at 320px and 1280px; visible after opening at tested widths.
- Magnifier visible on `/items` at 320, 375 and 1280px; absent on `/categories`, `/users`, `/settings` at 375 and 1280px.
- Active-filter dot: the mocked recent collection `c1` makes it visible while closed; `aria-describedby` target text is "Filters active"; after opening and clicking Clear, the dot is gone.
- Route change: open the panel on `/items`, navigate to `/categories`, return to `/items`; `#notebook-filters` is hidden.
- Collections failure and empty state: verify the error banner follows the top row without an action, while no collections shows the Create a collection link; the Find toggle still opens the panel in both cases.
- Overflow: `scrollWidth` at most the viewport at 320, 375, 667x375, 768, 1024 and 1280px, with the panel closed and open.

Keep unchanged: route titles (L100-117; "The notebook." visible at 1280px), short mobile navigation, long API errors, pending-approval wrap, role retry and destructive dialog, new-note header (L262-283), settings and single-flight submit (L357-404).

### 8. Edge cases and error handling

- Collections fail: no New note button; banner under the row; magnifier still opens the panel (Collection select empty).
- No collections: "Create a collection" link in the same slot.
- Recent collection restored on load: filter is active, dot is lit while closed (intended, see A7).
- Crossing 640px while open: state unchanged (no breakpoint sync).
- Leaving `/items`: panel state resets (route effect); magnifier hidden.
- Panel open and New note form open: both render; the form stays below the panel.
- Keyboard: magnifier reachable by Tab in the app bar. Enter or Space toggles it. `aria-expanded` is announced. Opening focuses the search input.
- `hidden` must win: verify with Playwright `toBeHidden` at all widths. Do not add display utilities (`flex`, `grid`, `sm:grid`) to the outer section.
- Sticky app bar must not cover the focused search input (`scroll-mt-20`).

### 9. Security considerations

- No new inputs, endpoints, storage or HTML. React escapes all text.
- Panel state is not persisted (no localStorage or URL params), as in the previous revision.
- No new dependencies. Test fixtures keep the existing mock data only.

### 10. Acceptance criteria

1. `/items` shows one top row at 375, 768 and 1280px: h1 "The notebook.", the three stats with live counts, and New note.
2. The row has no "01" number, eyebrow or description at any width. The h1 keeps `data-page-title`, and RouteMetadata focus still works.
3. At 1280x720 the row height is at most 72px. At 1280x720 with the panel closed, the first content block starts at most 220px from the top.
4. The filter panel is hidden on load at 320, 375, 639, 640, 768, 1024 and 1280px.
5. The magnifier "Find notes" is visible on `/items` at all those widths and absent on other routes. Each press toggles the panel and `aria-expanded`.
6. Opening the panel focuses the search input and does not leave it under the app bar.
7. Export, Import, Sort tags, Clear and all filter fields work after opening. The CSV import test passes.
8. The active-filter dot shows while the panel is closed when a filter is applied, and the `aria-describedby` text is "Filters active".
9. Leaving `/items` closes the panel. Returning shows it closed.
10. No horizontal overflow at 320, 375, 667x375, 768 and 1280px, with the panel closed and open.
11. New note toggles the form. Create-form header actions, pending state and single-flight submit still pass.
12. Collections, People and Settings render as before (existing tests pass; spot-check at 375 and 1280).
13. `npm run build` and `npm run test:e2e` pass with no console errors.
14. No backend, API, data, dependency or `package.json` change. Root `specification.md` sections 3.1, 9 and 10, `README.md`, `progress.md`, and the note in `plan/mobile-ui-refinements.md` are updated.

### 11. Assumptions and ambiguity resolution

Defaults below apply unless the user overrides them.

| # | Topic | Default used |
|---|---|---|
| A1 | "loop" icon | Read as the magnifier (Search icon) in the app bar. |
| A2 | Scope of hidden panel | All widths. This overrides the previous desktop-always-open rule (old A4). To keep desktop open, add a `min-width: 640px` condition in one place (R2). |
| A3 | Other openers | The in-page "Find & filter" disclosure is removed. The magnifier is the only opener. |
| A4 | Hero copy | Number, eyebrow and description removed at all widths on `/items`. The h1 stays. |
| A5 | Top row | One row at all widths: h1, stats, New note. Stat labels unchanged. |
| A6 | Export, Import, Sort tags | Stay inside the panel, so they are hidden with it. |
| A7 | Hidden active filter | Recent collection and other filters still apply while hidden. A dot on the magnifier shows this. Added behaviour. Drop it if unwanted. |
| A8 | Persistence | Panel state resets on page load and route change. Not persisted. |
| A9 | Escape key | Not required. Not implemented. |
| A10 | Panel layout | Inline, pushes content down. Not an overlay. |
| A11 | App bar | Only the magnifier changes on desktop. Breadcrumb, tagline and pill unchanged. |
| A12 | Wrapping | Allowed at 320px and at 640-1023px (two lines). The one-line target applies at 1024px and up. |
| A13 | Collections error / no collections | Same slot, same behaviour as now. |
| A14 | Deployment | Explicitly requested by the user; publish and deploy after a clean review. |

### 12. Open questions for the user

1. Keep the hero description on desktop? Default: no (removed).
2. Move Export and Import to the top row? Default: no (inside the panel).
3. Add Escape to close the panel? Default: no.
4. Confirm the magnifier and hidden panel at desktop widths (A2)? Default: yes.
