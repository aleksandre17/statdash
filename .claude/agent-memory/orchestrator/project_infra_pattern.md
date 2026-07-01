---
name: project-infra-pattern
description: Docker Compose two-stack pattern used in this project — infra separate from app, geostat-chat-ai is the reference
metadata:
  type: project
---

The ops/compose structure follows the geostat-chat-ai pattern (reference: C:\Users\Test-User\CursorProjects\geostat-chat-ai\ops\compose\).

**Pattern: two separate stacks on one named network**

- `ops/compose/infra/` — infrastructure (postgres, pgadmin, future: redis, etc.)
  - `docker-compose.base.yml` — declares `statdash-net` network + named volumes (no services)
  - `services/postgres.yml` — one service per file
  - `services/pgadmin.yml` — dev-only service
  - `docker-compose.prod.yml` — prod overrides

- `ops/compose/` (app stack) — application services (geostat-app, panel, etc.)
  - `docker-compose.yml` — app services, connects to `statdash-net` by name
  - `docker-compose.override.yml` — dev overrides
  - `docker-compose.prod.yml` — prod overrides

**Network sharing**: both stacks declare `name: statdash-net` — Docker reuses the same network. No `external: true` needed.

**DB init scripts**: `ops/postgres/init/` (00–04 SQL files) mounted into postgres container.

**Env files**: `ops/config/db/.env` (from `.env.example`), `ops/config/geostat/.env.dev/.env.prod`.

**Why:** User explicitly cited geostat-chat-ai as the reference. First attempt bundled postgres into app compose — wrong. Always keep infra and app stacks separate.

**How to apply:** Any future infra service (redis, qdrant, etc.) goes into `ops/compose/infra/services/` as a new file. Never bundle infra into the app stack compose.
