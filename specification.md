# Listjj 2 - architecture specification

Personal notes / todo lists app. Successor of the .NET 8 Blazor app (`Listjj`) and the React
front (`listjj_front`). Backend and frontend are separate deployable units.

## 1. Goals

- Preserve old functionality (see section 3), modernised and simplified.
- Backend: Python 3.12, FastAPI, SQLAlchemy 2.0 (SQLite default, PostgreSQL supported).
- Frontend: React 18 + Vite, Tailwind CSS v4, local shadcn/ui components, and Lucide icons.
- Public API for scripts/devices (REST) and an MCP server for AI assistants.
- Built as Docker images by GitHub Actions, deployed with docker compose on the home server.
- Few dependencies. No HTTPS handling inside the app (reverse proxy / LAN only).

## 2. Repository layout

```
README.md               human: setup & deployment (concise)
specification.md        this file (keep up to date)
docker-compose.yml      deployment on the home server (pulls images from GHCR)
.env.example            variables for docker-compose
.github/workflows/      docker-publish.yml: build + push images to GHCR on master / modern_dark pushes
backend/
  pyproject.toml
  Dockerfile
  app/
    main.py             FastAPI app factory, lifespan, routers, MCP mount, error mapping
    config.py           Settings from environment (dataclass, no pydantic-settings)
    db.py               engine/session, sqlite FK pragma, create_all
    models.py           SQLAlchemy models
    schemas.py          pydantic DTOs (camelCase JSON)
    security.py         password hashing (pbkdf2), JWT, Google/Microsoft id-token verification
    deps.py             auth dependencies (JWT user, approved user, admin, API key user)
    services.py         business logic shared by REST, external API and MCP
    mcp_server.py       MCP tools (streamable HTTP, Bearer = user API key)
    routers/            auth, users, categories, items, files, external, meta
  tests/test_api.py     pytest + TestClient (sqlite temp db)
frontend/
  package.json, vite.config.js, index.html
  public/config.js      runtime config defaults (overwritten by container entrypoint)
  docker/40-listjj-config.sh nginx entrypoint: writes config.js from env vars
  docker/45-nginx-config.sh renders body limit from MAX_UPLOAD_MB
  nginx.conf            serves SPA, proxies /api and /mcp to backend
  Dockerfile            node build -> nginx
  src/                  App, pages, shared shadcn/ui primitives, API client
```

## 3. Functional scope (from the old app)

| Area | Behaviour |
|---|---|
| Accounts | Register (email + password). New accounts have no role until an admin approves them. Login with email/password, Google ID token or Microsoft ID token. Initial administrator registration requires both `ADMIN_EMAIL` and `ADMIN_BOOTSTRAP_TOKEN`; Google sign-in requires a provider-verified email. |
| Roles | `User`, `Admin`. Role `null` = pending approval (no data access). |
| Users (admin) | List, create, update (email, password, role), delete. |
| Categories | Per-user. Name (maximum 200 characters), description. CRUD. Category-name lookups use Unicode case folding. Deleting a category deletes its items. Recent category remembered per user. |
| Items | Per-user. Name (maximum 500 characters), description, finite numeric value, active flag, tags, sequence number, created/modified timestamps, files. |
| Ordering | Items ordered by `sequenceNumber` inside a category. New item gets `max+1` (or 1). Move up/down swaps sequence numbers with neighbour. "Sort by tags" renumbers items 0..n-1 by tags. |
| Search | Filter by category, modified date range, and free text: space-separated words must match name or tags using Unicode case folding; `!word` excludes. |
| Tags | Stored as comma separated text. Tag suggestions per user / category. |
| Files | Upload/download/delete files attached to an item. Size limit `MAX_UPLOAD_MB`. |
| CSV | Export and import, semicolon separated, header `SequenceNumber;Value;Name;Description;Category;Active;Tags` (compatible with old export). Import creates missing categories only for valid rows and reports invalid rows individually. |
| API key | Each user has one GUID API key (generate or set custom). Used by external API and MCP. |
| External API | Simple key-authenticated endpoints (for watches/scripts), see section 5. |
| Legacy external API | Preserve `/api/Listjj/GetAllListjj`, `GetByCategoryName`, `AddItem`, and `DelItem` aliases for existing clients. |
| MCP | Tools: get_categories, add_category, add_item, update_item, delete_item, delete_category, get_items_by_category. |
| Meta | `/api/version`, `/api/health`, `/api/settings` (admin, non-secret config). |

Dropped (experimental, unused): Azure Service Bus / event consumers, Azure App Configuration,
Redis cache, OpenTelemetry, Blazor/Razor pages, Scalar UI (FastAPI `/api/docs` replaces it).
Caches (recent category, tag selection) are replaced by DB columns / direct queries.

## 3.1 Frontend design system

- Visual direction: Modern Dark personal-workspace UI. Use `#050505` ground, `#0e0e0e` graphite panels,
  `#222222`/`#303030` hairlines, `#f2f2f2` bright statements, `#a6a9ad` reading text, `#8a8d91` metadata,
  and `#3fd6c6` only for small live/selected indicators. Use Geist-style regular sans for display and
  reading, Geist Mono for labels/numbers, a shared 1360px content max, 48px desktop gutters, 6px panel
  corners, pill actions, and 120ms ease-out control transitions.
- Keep reading areas opaque and legible. Primary actions are bright filled with dark ink; secondary actions
  are dark outlined. Show offset keyboard focus, honor reduced motion, and avoid colored glows, glass,
  decorative animation, invented sections, sample metrics, or fabricated product states. Use static white
  light only where it does not obscure content.
- Desktop uses a persistent workspace rail; mobile uses an accessible slide-over menu. Keep current page
  content, copy, layouts and responsive behavior; do not replace this functional application with a
  marketing page. Content adapts without horizontal overflow.
- Below 640px, the sticky app bar is a compact row with navigation, current page title, a Notebook-only
  Find toggle, and sign out. At every width, the Notebook page presents a compact row with its
  focusable title, three live stats, and New note action; its stats use compact inline 16px values and
  8px phone / 9px desktop labels, and the 28px desktop title aligns with a compact 36px desktop action. Counts keep their
  units for assistive technology without repeating them visually. The row fits on one line at widths
  from 360px and uses a two-line layout below that, with stats above a full-width New note action.
  When no collections exist, the phone link reads “New collection” and its visible text is its accessible name.
  Keep the row's vertical gap to the list tight. The filter/search panel is closed on load
  and is opened or closed only by the app-bar Find toggle. The toggle shows an active-filter indicator while hidden
  filters still apply. Filter tools remain available in the panel. On create forms, Cancel and Add to
  notebook stay in the form header.
- Use Tailwind utilities and locally owned shadcn/ui primitives; use `lucide-react` icons with
  accessible labels. Avoid motion libraries; only small CSS transitions are needed.
- Preserve functionality on `/login`, `/register`, `/items`, `/categories`, `/users`, and `/settings`,
  including responsive third-party sign-in buttons, admin approval, CRUD, attachments, CSV, external API and MCP instructions.
- Every route should provide usable loading, empty, error, focus, and responsive states. Page titles
  update per route, route changes move focus to the visible page heading, and auth pages retain a
  visible `h1` on mobile.
- Tag and dialog text must wrap or truncate accessibly. Navigation remains scrollable in landscape and
  short-height viewports. Functional text meets WCAG AA contrast, and destructive actions surface
  pending/error feedback inside their confirmation dialogs.

## 4. Data model

All ids are UUIDs (SQLAlchemy `Uuid` type; stored as CHAR(32) on SQLite, native uuid on PostgreSQL).
Timestamps are UTC.

- `users`: id, email (unique), password_hash (nullable), role (`User`|`Admin`|null), api_key (unique, nullable), recent_category_id (nullable), created
- `categories`: id, user_id -> users (cascade), name(200), description, created
- `items`: id, user_id -> users (cascade), category_id -> categories (cascade), name(500), description, value (float), active (bool), tags (text, comma separated), sequence_number (float), created, modified
- `files`: id, item_id -> items (cascade), name(500), size (int), content (binary, deferred load)

Schema is created with `Base.metadata.create_all` at startup (no migration tool; additive changes
must be handled manually). Foreign keys are enforced (SQLite pragma `foreign_keys=ON`).

## 5. HTTP API (prefix `/api`, JSON camelCase, errors `{"detail": ...}`)

Auth header: `Authorization: Bearer <JWT>` for UI endpoints; `Authorization: Bearer <API key>` for external API and MCP.

Auth
- `POST /auth/login` `{email,password}` | `{googleJwt}` | `{microsoftJwt}` -> `{successful, token}` (JWT HS256, `JWT_EXPIRY_DAYS`)
- `POST /auth/register` `{email,password,adminBootstrapToken?}` -> `{successful,message}` (message distinguishes pending accounts from an active bootstrapped admin)
- `GET /auth/me` -> `{id,email,role,apiKey}`

Users (admin)
- `GET /users`, `POST /users` (upsert/create by `id`; password required on create and optional on update), `DELETE /users/{id}`. Admin responses omit API keys.
- `GET /roles` -> `["User","Admin"]`

Categories
- `GET /categories`, `POST /categories` (upsert `{id?,name,description}`), `DELETE /categories/{id}`
- `GET /categories/recent` -> `{categoryId}`, `PUT /categories/recent` `{categoryId|null}`

Items
- `GET /items?q=&category_id=&date_from=&date_to=` (ordered by sequence)
- `GET /items/export` -> CSV file
- `POST /items/import` multipart `file` -> `{imported, errors[]}`
- `GET /items/{id}`, `POST /items` (upsert `{id?,name,description,value,active,tags[],categoryId}`), `DELETE /items/{id}`
- `POST /items/{id}/move?direction=up|down` -> `{moved: bool}`
- `POST /items/sort-by-tags/{categoryId}`
- `GET /tags?category_id=` -> `string[]`

Files
- `POST /items/{id}/files` multipart `file`, `GET /files/{id}` (download), `DELETE /files/{id}`
- Upload/download filenames are control-character sanitized before storage/response and returned using RFC 5987 UTF-8 encoding.

Settings & meta
- `GET /settings/api-key` -> `{apiKey}`, `POST /settings/api-key/generate` -> `{apiKey}`, `PUT /settings/api-key` `{apiKey}` (custom GUID)
- `GET /version`, `GET /health`, `GET /settings` (admin)
- OpenAPI UI: `/api/docs`; schema: `/api/openapi.json`

External (API key)
- `GET /external/items` -> all items of the key owner
- `POST /external/items` `{id?,name,description,value,categoryName}` (category must exist)
- `POST /external/items/delete` `{id}`
- `GET /external/categories/{name}/first-item`
- Compatibility: `/Listjj/GetAllListjj` (Bearer API key), `/Listjj/GetByCategoryName?name=&key=` (legacy watch query key), `/Listjj/AddItem`, and `/Listjj/DelItem` (Bearer API key).

Item JSON: `{id,name,description,value,active,tags[],sequenceNumber,categoryId,categoryName,created,modified,files:[{id,name,size}]}`

## 6. MCP

- Endpoint: `POST/GET /mcp` (streamable HTTP, stateless, JSON responses).
- Auth: `Authorization: Bearer <user API key>`; every tool resolves the user from the header.
- Tools: `get_categories`, `add_category(name, description?)`, `add_item(name, category_id? | category_name?, description?, value?, tags?, active?)`,
  `update_item(item_id, ...omitted fields unchanged)`, `delete_item(item_id)`, `delete_category(category_id)` (deletes its items),
  `get_items_by_category(category_id? | category_name?)`.
- Server instructions describe the data model (categories contain items, never guess IDs).

## 7. Security

- Passwords: PBKDF2-SHA256 (310k iterations, random salt).
- JWT signed with `JWT_SECRET` (if unset, a random secret is generated at startup and sessions reset on restart).
- Google / Microsoft ID tokens verified against provider JWKS, audience = configured client id; Google email must be provider-verified.
- Role checked against DB on every request (role changes apply immediately).
- Users only see their own categories/items/files (ownership checked in services).
- Text is stored raw; the React UI escapes output. No HTML rendering anywhere.
- CORS origins from `CORS_ORIGINS` (default `*`). Frontend is served by nginx on the same origin, so CORS is normally not needed.

## 8. Configuration (environment)

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | `sqlite:////data/listjj.db` | SQLAlchemy URL, e.g. `postgresql+psycopg://user:pass@db:5432/listjj` |
| `JWT_SECRET` | random | HMAC secret for JWT |
| `JWT_EXPIRY_DAYS` | `30` | token lifetime |
| `ADMIN_EMAIL` | empty | email address allowed to bootstrap the initial administrator |
| `ADMIN_BOOTSTRAP_TOKEN` | empty | required at registration with `ADMIN_EMAIL` to create the initial administrator securely |
| `GOOGLE_CLIENT_ID` | empty | enables Google login |
| `MICROSOFT_CLIENT_ID`, `MICROSOFT_TENANT_ID` | empty, `common` | enables Microsoft login |
| `CORS_ORIGINS` | empty (`*`) | comma separated |
| `MAX_UPLOAD_MB` | `20` | file attachment limit |
| `APP_VERSION` | `0.1.0` | reported by `/api/version` |
| `DEPLOYMENT_NAME` | `local` | shown in settings |

Frontend runtime variables (nginx container): `GOOGLE_CLIENT_ID`, `MICROSOFT_CLIENT_ID`,
`MICROSOFT_TENANT_ID`, `MAX_UPLOAD_MB` (Nginx allows one additional MB for multipart overhead).

## 9. Build & deploy

- GitHub Actions (`.github/workflows/docker-publish.yml`) on push to `master` and `modern_dark`: runs backend pytest,
  frontend Playwright tests and the frontend production build before publishing `backend/` and
  `frontend/` to GHCR. Images carry immutable full-SHA tags; only `master` updates the `latest` alias.
- Home server: `/home/debian/skrypty/docker/listjj2` contains `docker-compose.yml` and `.env`.
  SQLite uses the named Docker volume `listjj2-data`; PostgreSQL data uses `./volumes/postgres`.
  For each deployment, sync the reviewed `docker-compose.yml`, set
  `IMAGE_TAG=sha-<full-commit-sha>` in the existing `.env` without overwriting secrets, then
  pull/recreate only the frontend with
  `docker compose pull frontend && docker compose up -d --no-deps frontend`. Never remove the named
  volume. The home server exposes nginx on host port `8093`; local compose defaults to `8092`. nginx
  proxies `/api` and `/mcp` to the backend.
- Optional PostgreSQL: `docker compose --profile postgres up -d` with `DATABASE_URL` pointing to the `db` service.

## 10. Testing

- `backend/tests/test_api.py`: pytest with FastAPI TestClient on a temporary SQLite database. Covers auth, approval, categories,
  items (ordering, move, search), files, CSV, external API, MCP initialize/tool call.
- Frontend: `npm run test:e2e` and `npm run build` must succeed; Playwright tests cover route titles/focus,
  320px long-data overflow, mobile navigation, accessible CSV/collection controls, role retry and
  destructive-action pending/errors. Notebook coverage also verifies its compact stats/New note row,
  all-width closed-by-default search/filter panel and app-bar Find toggle, active-filter indicator,
  filter state reset on route changes, responsive overflow, and create-form actions in the header.
  The Notebook top-row tests assert compact type sizes, button alignment, reduced row/gap heights and
  the 320px wrap order, including three-digit totals and the compact no-collection action. Design checks
  assert exact Modern Dark tokens, dark color-scheme and page ground, readable display font, visible keyboard
  focus, reduced-motion behavior, primary/secondary hover states, checked and unchecked checkbox contrast,
  visible loading skeleton contrast, all six existing routes, delayed loading, optional auth-provider widget
  containment, and overflow at 320px, 375px, 640px and 1280px.
