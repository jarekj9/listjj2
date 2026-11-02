# Mobile UI refinements: implementation specification

Status: complete. Date: 2026-11-02.
Scope: frontend only, plus tests, docs and deployment.

## 1. Objective

Make the app shell and the Notebook page (`/items`) compact and clean on phones, keep tablet and desktop
layouts unchanged, remove a non-functional control, and deploy the result to the home server.

## 2. Context (current state)

- `frontend/src/components/AppShell.jsx` L133-162: sticky 74px header on all widths. Contains hamburger
  (`aria-label="Open navigation"`, `lg:hidden`), breadcrumb `A personal index / {route}`, tagline
  "Keep the useful things close.", "Private workspace" pill (`sm:` only), Sign out icon (`aria-label="Sign out"`).
  Route label uses `window.location.pathname`.
- `frontend/src/pages/ItemsPage.jsx`:
  - L132-139 hero via `PageHeader`: number "01", eyebrow "Your personal index", h1 "The notebook.",
    description "Notes, small plans and loose ends-kept together, without the noise.". Action: "New note"
    toggle (functional, Plus icon).
  - L143-147 stats row: In view / In progress / Collected in (`grid-cols-3`, `border-y`).
  - L149-192 filter section (`aria-label="Filter notebook"`), always expanded: find input, Collection select,
    two date inputs, Sort tags / Clear, footer (status, Export, Import).
  - L196 new-note form (`submitLabel="Add to notebook"`).
- `frontend/src/components/ItemForm.jsx`:
  - L61-67 header: "A new page" / "Capture a thought" plus `<span>` with `<Plus>` icon (L66).
    **Confirmed non-functional:** plain span, no handler, no role, `aria-hidden` icon. Decorative only.
  - L112-115 footer: Cancel + submit. Shared with edit mode (`ItemCard.jsx` L69, `submitLabel="Save changes"`).
- `frontend/src/App.jsx` `RouteMetadata` focuses the first `[data-page-title]` element on every route change.
  The Notebook page must keep one such element.
- `frontend/src/components/PageHeader.jsx` is shared with Collections, People and Settings. Do not change its behaviour.
- `frontend/tests/redesign.spec.js`: Playwright, Desktop Chrome only (default 1280x720).
- Baseline phone screenshot: `.playwright-mcp/final-items-mobile.png` (gitignored, reference only).

## 3. Sources

- `instruction.md`: design brief. Mobile-first, no overflow, avoid decoration and repetitive cards, WCAG,
  polished states, Playwright checks on mobile and desktop.
- `AGENTS.md`, `specification.md` (sections 3.1, 9, 10), `README.md`, `progress.md`, `specification/implementation.md`.
- Tailwind v4 default breakpoint `sm` = 40rem (640px). No further external research needed.

## 4. Assumptions (builder follows defaults unless the user overrides)

| # | Topic | Default |
|---|---|---|
| A1 | "Phone" | Viewport below 640px (`sm`). Tablet and desktop (640px and up) keep the current layout. |
| A2 | Hero removal | Phone only. Desktop keeps the hero. |
| A3 | "Tagline" | Phone only: hero description and topbar "Keep the useful things close.". Footer line stays. |
| A4 | Filter collapse | Phone only. Always expanded at 640px and up. State resets on page load (not persisted). |
| A5 | Stats and New note | Same row on phone. 640px and up unchanged. |
| A6 | New-note form actions | Create mode only, all widths: submit and Cancel move to the header beside "Capture a thought". Create mode has no bottom action row. Edit mode keeps its footer. |
| A7 | Plus control | Remove the decorative span in `ItemForm` header (create and edit, since the component is shared). Keep the Plus icon on the New note toggle. |

## 5. Requirements

### R1. Phone topbar (below 640px), `AppShell.jsx`

- One row, `h-14` (56px), sticky, existing background, border and blur tokens.
- Order: [Sidebar toggle] [Page title] [Find toggle] [Sign out]. Nothing else.
  - Sidebar toggle: existing Menu button, `aria-label="Open navigation"`, at least 44px.
  - Page title: section label (Notebook / Collections / People / Settings). Font-serif, one line, truncated.
    Derive it from `useLocation()`, not `window.location`.
  - Find toggle: Search icon, `aria-label="Find notes"`, `aria-expanded`, `aria-controls="notebook-filters"`,
    at least 44px. Rendered only on `/items`.
  - Sign out: existing `aria-label="Sign out"`, at least 44px.
- Remove on phone: "A personal index /" breadcrumb prefix and tagline.
- 640px and up: header unchanged.

### R2. Filter section collapsed by default (phone), `ItemsPage.jsx`

- Filter region: `id="notebook-filters"`, `aria-label="Filter notebook"`. Collapsed on every load on phone.
- Collapsed state: compact disclosure row on the existing filter surface:
  - label "Find & filter"; summary text (selected collection name, or "All your notes");
  - dot indicator when any filter is active (search, collection or date range);
  - toggle button with `aria-expanded` and `aria-controls="notebook-filters"`, and a chevron icon.
- Expanded state: current content, unchanged.
- The topbar Find toggle and the disclosure control share one state. Use a React context provided by
  `AppShell` (or equivalent lifted state). Do not use DOM events or `getElementById`.
  - Opening from the topbar expands the region and focuses the search input.
  - Closing from either control collapses it. Focus returns to the control that was used.
- Collapsed content uses the `hidden` attribute (removed from the accessibility tree). It must never be
  hidden at 640px and up: use `sm:` responsive classes, not a plain `hidden`.
- When opened, the search input must not sit under the sticky topbar (`scroll-margin-top` of at least the header height).

### R3. Compact stats row aligned with New note (phone), `ItemsPage.jsx`

- One vertically centred row: stats on the left (three compact cells), "New note" / "Close note" button on the right.
- Button keeps its text label and accessible name, height 40px.
- Stats: numbers font-serif, around 20px. Labels keep the existing 9px mono style. Unit words ("notes",
  "active", "lists") are visually hidden on phone but stay in the DOM (`sr-only`). Use thin dividers, no full-width `border-y` band.
- At 320px: no horizontal overflow and no label truncation. If the three cells do not fit beside the button,
  the stats grid wraps to a full-width row below the button.
- Other header states use the same slot: "Create a collection" link (no collections) and the categories-error state.
- 640px and up: unchanged.

### R4. Hero removal (phone), `ItemsPage.jsx`

- On phone, hide the "01" number, the eyebrow "Your personal index" and the description.
- Keep the page h1 "The notebook." with `data-page-title tabIndex={-1}`. On phone it is visually hidden (`sr-only`),
  and on 640px and up it is visible as today. Keep the text unchanged (the existing test depends on it).
- Keep `section aria-labelledby="notebook-title"`.

### R5. New-note form (all widths, create mode only), `ItemForm.jsx`

- Header row: "A new page" / "Capture a thought" on the left. On the right: Cancel (ghost) and "Add to notebook"
  (primary, `type="submit"`, stays inside the `<form>`).
- Header wraps. Heading is `min-w-0`. At 320px the button may wrap below the heading, but must not overflow.
- Create mode has no bottom action row.
- Pending: button disabled, label "Adding…". Error banner unchanged. Enter-to-submit keeps working.
- Remove the Plus span (L66) and the `Plus` import. Keep `Check`.
- Edit mode (`ItemCard`): keep the footer ("Save changes" / "Cancel"). Only the Plus span is removed.

### R6. Design quality

- Use existing tokens and fonts (serif titles, mono labels, pine `#244b3d`, citrus `#d9ed9c`).
- No new dependencies and no new motion beyond existing CSS transitions (the reduced-motion rule already applies).
- No new borders, shadows or card wrappers. The filter disclosure reuses the existing filter surface.
- Visible focus outlines kept. Functional text keeps WCAG AA contrast.

### R7. Non-goals

- No backend, API, data model or CSV changes.
- No changes to the mobile slide-over nav, the desktop sidebar, the footer, the `PageHeader` component,
  or the Collections, People and Settings pages (beyond the shared phone topbar).

## 6. Deliverables

- Code: `frontend/src/components/AppShell.jsx`, `frontend/src/pages/ItemsPage.jsx`, `frontend/src/components/ItemForm.jsx`.
  If a shared context is added (for example `frontend/src/lib/notebookFilters.jsx`), list it in `specification.md` section 2.
- Tests: `frontend/tests/redesign.spec.js` (updated and added tests, section 8).
- Docs: `specification.md`, `progress.md`, `specification/implementation.md` (section 9).
- Deployed frontend image on the home server (section 10).

## 7. Approach (ordered)

1. Baseline: `cd frontend; npm run build; npm run test:e2e` must pass before any change. Capture baseline screenshots at
   320x640, 375x667, 667x375, 768x1024 and 1280x720 (Notebook, filter open, New note open). Keep them out of git.
2. `ItemForm.jsx`: remove the Plus span and import. Add create-mode header actions and remove the create-mode footer
   (switch on `!item`).
3. Shared state: provide `filtersOpen` plus open/toggle from `AppShell` around `children`, and consume it in `ItemsPage`.
4. `AppShell.jsx`: phone topbar (R1) using `useLocation`. Find toggle only on `/items` and below 640px.
5. `ItemsPage.jsx`: phone hero removal (R4), compact stats and New note row (R3), filter disclosure (R2).
   Keep 640px-and-up classes identical to today.
6. Update and add Playwright tests (section 8). Run them.
7. Visual QA with Playwright at the widths in step 1. Inspect every route on phone (`/items`, `/categories`, `/users`,
   `/settings`, `/login`, `/register`) for overflow and topbar title. Compare 1280px against the baseline.
8. Update docs (section 9). Add the `progress.md` entry.
9. Commit, push and deploy (section 10).

## 8. Tests (`frontend/tests/redesign.spec.js`)

Update:
- "long user data ... select popup" (320px): open the filter disclosure before clicking the Collection combobox,
  because the combobox is hidden when collapsed on phone.

Must still pass unchanged (desktop, 1280px): route titles (`The notebook.` heading), CSV importer
(Import inside expanded filter), settings and single-flight submit ("Add to notebook" button).

Add:
- Phone topbar at 375x667 on `/items`: "Open navigation", "Find notes" and "Sign out" are visible; "Keep the useful things close."
  and "A personal index" are absent; title reads "Notebook".
- Find toggle: `aria-expanded="false"`, click, then the region is visible, the search input is focused and
  `aria-expanded="true"`. Find toggle absent on `/categories`.
- Filter collapsed on load at 375px (region hidden). Visible at 1280px.
- Stats row and New note share vertical centre (within 4px) at 375px and 320px. No `scrollWidth` > viewport at 320px.
- Hero: "Your personal index" and the description not visible at 375px. h1 "The notebook." is attached and focusable (`data-page-title`).
- Form: "Add to notebook" sits in the same header block as "Capture a thought" (at 1280px and 320px). It precedes the first input in DOM order.
  No Plus icon inside the form header (for example `form svg.lucide-plus` count is 0; confirm the class name in the build).
- Breakpoint: at 639px the filter is collapsed, at 640px expanded.

## 9. Documentation expectations

- `specification.md`: update section 3.1 (phone topbar, filter disclosure, compact stats row, create-form action placement,
  phone-only hero) and section 10 (new tests). Update section 2 only if a new file is added.
  The document must describe the implemented behaviour only.
- `README.md`: no change expected (no setup, run or deployment steps change). Update only if deploy steps change.
- `progress.md`: append a new task block (tasks, status, commit SHA, Actions run ID, deploy result). Keep the existing history.
- `specification/implementation.md`: add a short "Mobile UI refinements" acceptance section that points to this file.

## 10. Deployment (only after section 13 is met)

1. `git status`: commit only source, test and doc changes. Never commit `.env`, `.playwright-mcp/` or `test-results/`.
2. Push to `master` (triggers `docker-publish`). Wait for the workflow to pass (backend pytest, Playwright e2e,
   build, GHCR push). Do not bypass failures. Get the full SHA with `git rev-parse HEAD`.
3. `ssh debian`, then in `/home/debian/skrypty/docker/listjj2`:
   - Sync `docker-compose.yml` (expected unchanged; sync anyway per `README.md`).
   - In the existing `.env`, change only `IMAGE_TAG=sha-<full-sha>`. Do not print or overwrite secrets.
     Keep `FRONTEND_PORT=8093`.
   - `docker compose pull frontend && docker compose up -d --no-deps frontend`
   - Never run `docker compose down -v`. Do not restart or recreate the backend. Keep volume `listjj2-data`.
4. Smoke test `http://192.168.0.26:8093`: `/login`, `/items` and `/api/docs` return 200; `/api/health` through the proxy returns 200.
   Playwright at 375x667 on Notebook: topbar, collapsed filter, stats row, New note form. No console errors.
   Authenticated checks need a test account from the user (see blockers).
5. Record the outcome in `progress.md`.

## 11. Dependencies

- Node 20, `npm ci`, Playwright Chromium (`npx playwright install --with-deps chromium`). Python 3.12 and pytest for CI parity.
- Git push access to `master`. GitHub Actions and GHCR access.
- SSH alias `debian` (server `192.168.0.26`, from `progress.md`).

## 12. Risks and handling

- Breakpoint leakage: desktop accidentally hidden. Use `sm:` variants. Test at 639px and 640px.
- State split between topbar and filter. Use a context. No DOM event hacks.
- Route focus: removing the h1 breaks `RouteMetadata`. Keep the `sr-only` h1 with `data-page-title`.
- Stats and button crowding at 320px. Use the wrap fallback in R3.
- Form header wrap at 320px. Button must not overflow and should appear on the first screen at 375x667.
- DOM order change: submit now precedes the fields. Title `autoFocus` stays.
- Sticky header covering the focused search input. Use `scroll-margin-top`.
- Collapsed filter hides the Collection filter, which may still be applied (recent collection). The summary text must show it.
- Export and Import move behind the disclosure on phone. Acceptable; keep them reachable.
- CI e2e failure blocks image publication. Fix the cause before pushing.

## 13. Validation and acceptance criteria

- [x] Phone topbar (below 640px) contains exactly: sidebar toggle, page title, Find (Notebook only), Sign out. No tagline or breadcrumb. Targets at least 44px.
- [x] Filter collapsed on load on phone. Topbar Find and the disclosure both expand it and focus the search input. Always expanded at 640px and up.
- [x] Stats and New note share one compact row on phone. No overflow at 320px.
- [x] Phone hides "01", the eyebrow and the description. The h1 "The notebook." stays focusable. Desktop hero unchanged.
- [x] Create form: "Add to notebook" sits beside "Capture a thought" at all widths. Cancel is in the header. Pending state and Enter-to-submit work.
- [x] Decorative Plus span removed in both create and edit forms. Edit footer unchanged.
- [x] No horizontal overflow at 320, 375, 667x375, 768 and 1280. No console errors.
- [x] Other routes (`/categories`, `/users`, `/settings`, `/login`, `/register`) unaffected apart from the shared phone topbar.
- [x] `npm run build`, `npm run test:e2e` (12 tests) and backend `pytest` pass. `npm audit` reports no vulnerabilities (0).
- [x] `specification.md` and `progress.md` updated. `README.md` unchanged unless deploy steps changed.
- [x] Deployed: GHCR images tagged with the full SHA, server `IMAGE_TAG` updated, frontend recreated, smoke test passed, `listjj2-data` intact. Commit `435e472f0466e3e9c3f0a83a6a9cc2083bcbf819`, Actions run `41485059451` (success); frontend is healthy at `192.168.0.26:8093`.

## 14. Open questions and blockers

Assumptions A1-A7 apply unless the user says otherwise. Questions for the user:

1. Is "phone" below 640px acceptable?
2. Remove the desktop hero too, or phone only?
3. Which "tagline" is meant: the hero description, the topbar line, or both? The footer line is kept.
4. Cancel in the header (default) or kept at the bottom?
5. Should Edit note also move Save to the top?
6. New note: keep the text label on phone (default) or use an icon-only button?
7. Authenticated server smoke testing was not performed because no test account was provided. Unauthenticated checks passed for `/login`, `/items`, `/api/docs`, and `/api/health` (HTTP 200).
