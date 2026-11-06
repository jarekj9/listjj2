# Listjj 2

Personal notes and todo lists with categories, tags, ordering, files, CSV import/export,
a REST API, an MCP server for AI assistants, and a React web UI.

- Backend: Python 3.12, FastAPI, SQLAlchemy (SQLite or PostgreSQL)
- Frontend: React + Vite + Tailwind/shadcn UI, served by nginx
- Details: [specification.md](specification.md)

## Run locally

Backend (http://localhost:8000, docs at /api/docs):

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
$env:DATABASE_URL = "sqlite:///./data/listjj.db"
$env:JWT_SECRET = "dev-secret-change-before-deployment"
$env:ADMIN_EMAIL = "you@example.com"
$env:ADMIN_BOOTSTRAP_TOKEN = "local-admin-bootstrap-secret"
uvicorn app.main:app --reload
```

Frontend (http://localhost:5173):

```powershell
cd frontend
npm install
npm run dev
```

Tests: backend `cd backend; pytest`; frontend `cd frontend; npx playwright install chromium; npm run test:e2e`.

## Docker

```bash
cp .env.example .env
# Edit .env: replace JWT_SECRET and the ADMIN_BOOTSTRAP_TOKEN placeholder with unique secrets.
docker compose up -d --build
```

Open http://localhost:8092. Register with `ADMIN_EMAIL` and `ADMIN_BOOTSTRAP_TOKEN` for the initial admin;
regular accounts remain pending until approved from the Users page.

## Deploy to the home server

Images are built by GitHub Actions (`.github/workflows/docker-publish.yml`) on pushes to `master` and
`modern_dark`; tests run before publication. Each image is published with a full commit-SHA tag. Only
`master` updates `latest`; deploy using the reviewed full SHA tag.

For every deployment, first update the server's compose file from the reviewed checkout and set
`IMAGE_TAG=sha-<full-commit-sha>` in its existing `.env` (preserve all secrets and
`FRONTEND_PORT=8093`):

```bash
# from the repository root; on first deployment also create .env from .env.example
scp docker-compose.yml debian@<server>:/home/debian/skrypty/docker/listjj2/docker-compose.yml
# on the server, edit only IMAGE_TAG in .env, then run:
docker compose pull frontend
docker compose up -d --no-deps frontend
```

For the first deployment only, create `.env` from `.env.example` and replace the JWT/bootstrap
placeholders with unique secrets; never overwrite an existing server `.env`.

Open `http://<server>:<FRONTEND_PORT>` (local default `8092`; home server `8093`). SQLite persists in
the Docker volume `listjj2-data`; never use `docker compose down -v`.
If the GHCR packages are private, run `docker login ghcr.io` on the server first.

PostgreSQL instead of SQLite:

```bash
# in .env: POSTGRES_PASSWORD=..., DATABASE_URL=postgresql+psycopg://listjj:...@db:5432/listjj
docker compose --profile postgres up -d
```

## Configuration

See the table in [specification.md](specification.md#8-configuration-environment).
Most important: `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_BOOTSTRAP_TOKEN`, `DATABASE_URL`.

## Using the API and MCP

- REST: `Authorization: Bearer <JWT>` (login via `/api/auth/login`), or `Bearer <API key>` for `/api/external/*`.
  The API key is shown on the Settings page.
- MCP: `http://<host>:<FRONTEND_PORT>/mcp` with header `Authorization: Bearer <API key>`; use `8093`
  for the home server.
- Existing clients can continue using `/api/Listjj/GetAllListjj`, `AddItem`, `DelItem` and
  `GetByCategoryName`; the watch endpoint still accepts its API key in the `key` query parameter.
  Prefer bearer headers for new clients because query-string keys can be logged.

## Social login (optional)

- Google: set `GOOGLE_CLIENT_ID` (backend and frontend variables). Add the site origin to the OAuth client.
- Microsoft: set `MICROSOFT_CLIENT_ID` and `MICROSOFT_TENANT_ID`. Register
  `http://<host>:<FRONTEND_PORT>/login` as a SPA redirect URI; use `8093` for the home server.
