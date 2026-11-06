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

> Original palette direction below was superseded by [Modern Dark frontend redesign (2026-11)](#modern-dark-frontend-redesign-2026-11).

### Design direction

- Use the Modern Dark palette, Geist-style display/reading type and Geist Mono labels defined by the current
  design section at the end of this file; retain the editorial personal-workspace hierarchy and existing app shell.
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

Status: implemented and cleanly reviewed; CI and image publication succeeded; deployed (served build verified 2026-11-04). Row sizing, wrapping, order and margins superseded by [revision 3](#notebook-row-layout-revision-3). Date: 2026-11-04. Baseline: `HEAD` `0b8bfca` (after `435e472`).
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

## Notebook row layout (revision 3)

Status: complete and deployed. Commit `4e61cc669317e9958c37e216efb82e87578a5dcd` passed Actions run `41914763944`; deployed frontend tag `sha-4e61cc669317e9958c37e216efb82e87578a5dcd` at `192.168.0.26:8093`. Date: 2026-11-04.
Scope: frontend `/items` header, its Playwright tests, docs and the deployment explicitly requested by the user. No backend, API, data, dependency or `package.json` change. Supersedes revision 2 row sizing, stat-unit display, wrapping, order and margins only; revision 2 Find/filter behavior stays in force.

### 1. Objective

Make the Notebook top row (title, three stats, New note) compact: smaller stats, New note on the same line as the stats, and a one-line row (today 88-90px tall at 320-640px).

### 2. Current state (measured on deployed revision 2)

| Viewport | Row height | Measured problem |
|---|---|---|
| 320x640 | 88px | Stats on the left (288px wide), New note above them on the right. Two lines. |
| 375x667 * | 88px | New note wraps under the stats, right-aligned. Two lines. |
| 640x720 | 90px | New note alone on its own line. Title 36px. |
| 768-1280 | 40px | One line, but stat values 20px, units 14px, title 36px. At 1280x720 the first block starts at 178px. |

\* Current Playwright geometry at 375px provides 343px of header content width. The layout is also designed for 328px effective content width on classic-scrollbar browsers.

Code facts (`frontend/src/pages/ItemsPage.jsx`):
- L146 header `mb-4 sm:mb-5 ... sm:gap-x-4`; L147 h1 `sm:order-1 sm:text-[2.25rem]`.
- L148 stats `order-2 grid min-w-[216px] flex-1 grid-cols-3 ... sm:min-w-[300px] sm:flex-none`; L149-151 values `text-xl`, units `sm:text-sm`, labels `sm:tracking-[.13em]`.
- L153 New note wrapper `order-1 ml-auto ... min-[360px]:order-2 sm:order-3`; L133 button `h-10`.
- L211 loading block `mt-7`; L223 Notes section `mt-5`; L156 banner `mb-5 mt-0`.
- Margins collapse: visible gap = max(header `mb`, next block `mt`) = 20px today.
- After tightening labels, separators and action padding, the stats/action group fits at the 328px content threshold with two-digit values; Playwright also covers a three-digit count at 375px. At 320px the action wraps to a full-width second line.

### 3. Requirements

**R1. Order and wrap.** Remove every `order-*` class from the h1, stats and New note wrapper. DOM order: h1, stats, New note. Header: `flex flex-wrap items-center gap-x-1 gap-y-2 sm:gap-x-4 mb-3`.

**R2. Breakpoint and wrap.** At viewport widths 360px and above, stats and action stay on one line. Below 360px, stats stay first and the action is forced full-width onto a second line, regardless of the stats' intrinsic width/count.

**R3. Title.** `sm:text-[1.75rem] leading-none` (was 2.25rem), `sm:shrink-0`. Visible from 640px, `sr-only` below. Keep `id`, `data-page-title`, `tabIndex={-1}`.

**R4. Smaller stats.**
- Values: `font-serif text-base leading-none` (16px, was `text-xl`).
- Labels: 8px mono on phones and 9px from 640px, `whitespace-nowrap`, normal letter spacing to fit counts alongside the action.
- Units ("notes", "active", "lists"): keep in the DOM for screen readers but `sr-only` at all widths. The visible labels already identify each count and removing repeated units saves horizontal space.
- Cell padding at most 8px per side. Keep `border-l` dividers.
- Container: `flex flex-auto items-stretch sm:flex-none sm:shrink-0`, replacing the grid, `min-w-[216px]` and `sm:min-w-[300px]`. Cells: `flex-auto sm:flex-none`.
- Stats block height at most 32px.

**R5. New note placement.**
- Wrapper: `flex flex-auto justify-end sm:flex-none sm:ml-auto`.
- Button (`newNoteAction`, L133): compact 11px phone / 12px desktop text, explicit 14px icon, reduced horizontal padding, `h-10 w-auto max-[360px]:w-full sm:h-9` (40px phone, 36px from 640px; full-width only when the row wraps below 360px).
- Action wrapper: `max-[360px]:basis-full` forces the second line below 360px even with zero/single-digit counts; it aligns to the right beside stats from 360px.
- Vertically centred with the stats (`items-center`). Keep text "New note" / "Close note", icon, `aria-*` and toggle behaviour.
- The "Create a collection" link uses the same wrapper; phones show "New collection" and this visible text provides its accessible name. At 640px+, the visible and accessible name is "Create a collection". No New note when collections fail (unchanged).

**R6. Vertical space.** Header `mb-3` at every width. Change L211 `mt-7` to `mt-3`, L223 `mt-5` to `mt-3`, and L156 `mb-5` to `mb-3`. The gap becomes 12px.

**R7. Unchanged.** `AppShell.jsx` (header height, `workspace-main` padding), magnifier and filter panel, `PageHeader.jsx`, `ItemForm.jsx`, `ItemCard.jsx`, empty and error states, colour tokens, focus rings.

Targets (checked in Playwright, section 6):

| Check | Target |
|---|---|
| Row height, 375-1280px (one line) | at most 40px; at most 36px from 640px |
| Row height, 320px (wrapped) | at most 84px |
| Header bottom to first block | at most 16px |
| 1280x720, panel closed: first block top | at most 170px (was 178) |
| New note vs stats vertical centre | within 2px at one-line widths; no overlap, including a three-digit total and no-collection CTA at 360/375px |
| Stat value / label / unit | 16px / 8px phone + 9px desktop / sr-only |

### 4. Files

| File | Change |
|---|---|
| `frontend/src/pages/ItemsPage.jsx` | R1-R6: header, title, stats markup and classes, New note wrapper, `newNoteAction` classes, margins at L156, L211, L223. Keep `data-testid` values and handlers. |
| `frontend/tests/redesign.spec.js` | Update and add checks (section 6). |
| `specification.md` (root) | Implementation phase: section 3.1 (L78-83) one-line rule and 320px wrap order; section 10 (L209-213) new checks. |
| `progress.md` | Implementation phase: new revision 3 block; close the revision 2 deployment item. |
| `specification/implementation.md` | Done in planning (this section and revision 2 note). |
| `AppShell.jsx`, `PageHeader.jsx`, `ItemForm.jsx`, `ItemCard.jsx`, `ui/*`, backend, `package.json`, `.github/`, `README.md` | No change expected. |

### 5. Implementation approach (ordered)

1. Baseline before editing: `npm run build` and `npm run test:e2e` both passed (15 tests) on deployed revision 2. Record this in `progress.md`.
2. Edit `ItemsPage.jsx` per R1-R6.
3. Update and add tests per section 6.
4. Visual QA in Playwright at 320x640, 375x667, 640x720, 768x1024, 1024x768 and 1280x720, panel closed and open. Check the targets table, overflow, the collections-error and no-collections states. Save screenshots under `.playwright-mcp/` (gitignored).
5. Update docs (section 4) in the same change.
6. `npm run build` and `npm run test:e2e` pass with no console errors. Backend is unchanged.
7. Commit and push only source, test and doc files. Never commit `.env`, `.playwright-mcp/`, `test-results/`, or the untracked `AGENTS.md` / `instruction.md`. Wait for `docker-publish.yml` to pass.
8. Deploy (section 8).

### 6. Tests (`frontend/tests/redesign.spec.js`)

Update:
- L238-242 (320px): flip to stats above New note (`narrowStats.bottom <= narrowButton.top`). New note width at least 250px. Stats width at least 228px.
- L304-309 (top-row loop): at 320px stats are above the button. At every other width the centre difference is at most 2px and `stats.right <= button.left`. Remove the `width < 640 || width >= 768` condition.
- L310-316 (1024, 1280): row height at most 40px (at most 36px at 1024 and 1280). Recent notes top at most 170px (was 220px).
- Keep: L192 stat text, L193 no "01", L197 and L289 labels at 9px, L285 title `sr-only` below 640, L290-297 screen-reader-only unit words, L277-326 overflow, L344-349 error banner below the row and no New note on error.

Add:
- Typography: values 16px at every width; labels 8px at 360/375 and 9px at 640/1280; units remain screen-reader text; title 28px at 640 and 1280px.
- Gap: header bottom to first block at most 16px at 375, 640 and 1280px.
- Button height: 40px at 375px, 36px at 1280px.
- Three-digit totals: exercise 100 active notes with New note at 360px (328px content width) and 375px.
- No-collection state: use itemCount=100 at 360px and 375px, assert "New collection" is visible, the stats/action stay aligned, and no overflow.
- Wrapped state at 320px and 359px: New note width at least 250px, stats above it, no overflow; test zero and normal counts to ensure wrapping is deterministic.

### 7. Edge cases and risks

- Row width: Playwright verifies the one-line layout at 360px (328px content) and 375px, with both three-digit totals and the no-collection action. Below 360px, it intentionally wraps. Guard against overlap/overflow.
- Fonts load from Google Fonts (`frontend/index.html` L9-12). If fallback font metrics make the row wrap at 375px or wider in CI, tighten spacing (R4) rather than weakening the assertions. Report if this cannot be met.
- Four-digit counts may exceed one-line width; allow wrapping without overlap or overflow.
- No collections: show the compact "New collection" label on phones; its visible text is also its accessible name. Collections error: no New note; stats only.
- Panel open or New note form open: header unchanged; the form stays below the row.

### 8. Security considerations

No new input, endpoint, storage or HTML. React escapes text. No change.

### 9. Deployment (requested by the user in this conversation)

After CI passes for the pushed commit:
1. `ssh debian "cd /home/debian/skrypty/docker/listjj2 && ls -la"`. Confirm `docker-compose.yml` and `.env` exist. Sync the compose file only if it changed (it should not).
2. Set only `IMAGE_TAG=sha-<full-commit-sha>` in the server `.env`. Do not print or overwrite other keys.
3. `docker compose pull frontend && docker compose up -d --no-deps frontend`. Do not restart the backend. Do not remove `listjj2-data`.
4. Smoke test HTTP 200 for `http://192.168.0.26:8093/login`, `/items`, `/api/docs` and `/api/health`. Run Playwright on `/items` at 375x667 and 1280x720 with mocked API routes (no real credentials are known). Check row height and that the console has no errors.
5. Update `progress.md`: revision 2 deployment verified; revision 3 deployment result.

### 10. Acceptance criteria

1. `/items` at 360, 375, 640, 768, 1024 and 1280px shows the title (visible from 640px, `sr-only` below), three live stats and New note on one line. The 360px case also passes with 100 items and with no collections.
2. At 320px the stats are full width above a full-width New note. Header at most 84px.
3. Row height at most 40px at 375-1280px (at most 36px from 640px). Header-to-first-block gap at most 16px. At 1280x720 with the panel closed, first block top at most 170px.
4. Stat values 16px; labels 8px on phones and 9px at 640px+; unit words remain screen-reader accessible without taking visual space. Stats block at most 32px high.
5. New note and stats centred within 2px at one-line widths, with no horizontal overlap.
6. Text, icon, toggle, `aria-*`, responsive "New collection" / "Create a collection" link names, and collections-error states remain functional.
7. No `order-*` classes on the top row. `data-testid` values unchanged.
8. No horizontal overflow at 320, 375, 667x375, 768, 1024 and 1280px, panel closed and open.
9. Revision 2 behaviour unchanged: magnifier, panel hidden on load, route reset, active-filter dot, focus.
10. `npm run build` and `npm run test:e2e` pass with no console errors. GitHub Actions `docker-publish.yml` is green.
11. Root `specification.md` sections 3.1 and 10, `progress.md` and `specification/implementation.md` are updated in the same change. `README.md` is unchanged (no setup change).
12. The `sha-<full-commit-sha>` frontend is served on `192.168.0.26:8093`, smoke checks pass, and `listjj2-data` is untouched.

### 11. Assumptions and open questions

| # | Topic | Default used |
|---|---|---|
| A1 | Measurements are from Windows Chromium with a 15px scrollbar. CI widths may differ slightly because of fonts. | Use the targets above. Report differences. |
| A2 | Title stays visible from 640px at 28px. | Yes. |
| A3 | On phones, New note stretches to fill the space right of the stats. | Yes. Alternative: fixed 108px width. |
| A4 | At 320px the layout stacks full width. | Yes. |
| A5 | Desktop top padding (`lg:pt-11` in `AppShell.jsx`, shared by all routes) stays unchanged. | Unchanged. Changing it affects every route. |
| A6 | Commit, push and deployment are allowed for this change. | Yes (user request). |

Open question for the user: reduce the desktop top padding for `/items` only (A5)? Default: no.

## Modern Dark frontend redesign (2026-11)

Status: reviewed; branch `modern_dark`. The new design replaces the former warm mineral / pine / citrus palette with the user-specified near-black, graphite, quiet grey, bright white and restrained mint system. Apply the design to the existing workspace application, not a marketing page. Preserve routes, copy, content, interactions and the current React/Tailwind/shadcn stack.

### Requirements

- Exact design tokens: ground `#050505`, panel `#0e0e0e`, hairlines `#222222`/`#303030`, bright `#f2f2f2`, reading `#a6a9ad`, meta `#8a8d91`, live `#3fd6c6`, inverse ink `#0a0a0a`, dim `#96999d`; face Geist-style regular sans and Geist Mono.
- Shared content maximum 1360px, desktop gutters 48px, 24px grid gap, panel radius 6px, pill action buttons, 120ms ease-out transitions.
- Restyle app shell, nav, header, all existing pages, states, forms, dialogs and shared primitives consistently. Keep reading surfaces opaque and legible. Bright filled primary actions, dark outlined secondary actions, visible offset keyboard focus. Mint marks only small live/selected state.
- Keep current responsive layout, route focus, accessible labels/order, reduced-motion support and all current behavior. Static white light is optional; do not add invented sections/data or decorative motion.
- No backend, API, data, route, behavior or dependency change.

### Acceptance checks

1. Build and all existing E2E tests pass, with new checks for exact tokens, dark mode, visible focus, and reduced motion.
2. `/items`, `/categories`, `/users`, `/settings`, `/login`, and `/register` stay legible and usable at 320/375/640/1280px, without overflow or console errors.
3. Manual/Playwright rendered checks confirm page/panel contrast, action states, mobile behavior, keyboard focus and reduced motion.
4. Root `specification.md` and `progress.md` describe the implementation. No README change unless setup or deploy instructions change.
5. Review before publishing/deployment. Publish only a verified SHA-specific frontend; deploy only frontend to the home server; preserve the backend and data volume.

### Branch publication and deployment

The Docker workflow also runs for `modern_dark` pushes, in addition to `master`. It always publishes the immutable full-SHA tag, but `latest` remains reserved for `master`. Deploy only the reviewed SHA-tagged frontend on the home server; do not recreate the backend or touch the persistent data volume. The implementation reviewer returned “No actionable issues found.”
