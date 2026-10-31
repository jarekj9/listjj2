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
