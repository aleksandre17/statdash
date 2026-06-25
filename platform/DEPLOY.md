# Deploy Runbook — statdash-platform

> Production cutover guide. The stack is **ship-ready** (verified: 1454 tests on real TimescaleDB; the api image boots in `NODE_ENV=production` against real Postgres on an isolated network, provisions config, and serves `/health` + `/api/bootstrap` + `/api/schema/page-config`; the env fail-fast gate verified live).

## 1. Services — single-origin reverse-proxy topology (ADR adr_deployment_topology)
- **geostat** / **panel** — each app's **nginx serves the SPA at `/` AND proxies `/api/` to the internal api** (`statdash-api:3001`). The SPAs are built with EMPTY `VITE_API_URL`/`VITE_API_STATS_URL` → relative `/api/...` → **same-origin** → no CORS, no baked host/IP, CSP `connect-src 'self'`. These are the ONLY published ports.
- **api** (`apps/api`) — **internal only** (never published). Multi-stage, `USER node`. Boots → fail-fast env → Flyway-migrated DB → provisions config → serves on `:3001`.
- **postgres** (TimescaleDB-HA pg16) + **flyway** — schema owner.
- One unified stack: **`ops/compose/docker-compose.prod.yml`**. Run it:
  ```
  # fill the three env files first (all gitignored):
  #   ops/compose/.env         (compose interpolation — see .env.example)
  #   ops/config/db/.env       (POSTGRES_USER/PASSWORD/DB)
  #   ops/config/api/.env.prod (the api fail-fast contract; CORS_ORIGIN=false)
  GEOSTAT_PORT=3002 PANEL_PORT=3003 docker compose -f ops/compose/docker-compose.prod.yml up -d --build
  ```
  Image build notes: a per-app image runs **vite only** (never `tsc -b` — typecheck is the local/CI gate); vite builds `@statdash/*` from source, so each app's `vite.config.ts` `resolve.alias`'s every `@statdash/*` peerDependency to the app's own copy (data-driven from package.json) — this is what lets the filtered install build cleanly under `shamefully-hoist=false`.

## 2. Env contract (ALL fail-fast at boot — `apps/api/src/env.ts`)
| Var | Rule |
|---|---|
| `DATABASE_URL` | required |
| `JWT_SECRET` | required, **min 32 chars** |
| `ADMIN_PASSWORD` | required, **min 8** |
| `ADMIN_USERNAME` | required |
| `EMBED_SECRET` | **required in production** (min 32) — embed tokens are forgeable if unset. Dev default only when `NODE_ENV !== production`. |
| `NODE_ENV` | set `production` |
| `EMBED_SECRET` unset in prod | → **boot crashes loud** (verified live). Do not deploy without it. |

Secrets are local-only / gitignored (`ops/config/ssh/id_rsa`, `deploy.env`, `.env.prod`) — **never commit**.

## 3. Migrations — Flyway V1→V31 + `R__` seed (gated on `postgres: service_healthy`)
- **Greenfield (new DB): safe, automatic.** The full chain applies clean (verified: "Successfully applied 32 migrations, now at v31"). V23's additive backfill + the read-only parity DO-block (RAISES on mismatch) and V24's contract run in the same chain and fail loud on any mismatch.
- **⚠️ Existing populated DB — the ONE manual precondition:** V24 (classifier `code_path` contract, the one-way door) must NOT auto-apply before V23's live parity is confirmed. Run **V23 → observe parity period → V24 by hand**. (Greenfield needs no action.)

## 4. Cutover steps
1. Provision Postgres; run Flyway (§3). Confirm `now at v31`.
2. Set the env contract (§2) — all secrets present, `NODE_ENV=production`.
3. Deploy the api image → it provisions config on boot. Confirm `GET /health` = `{"status":"ok"}` and `GET /api/bootstrap` returns the config (`schemaVersion: 5`).
4. Build + serve `geostat` (renderer) and `panel` (Constructor) static bundles.
5. Smoke: bootstrap loads · a page renders · the Constructor saves a config (JWT-gated; publish = `admin`).

## 5. Post-ship flips (deliberate, not blockers)
- `ENFORCE_CONFIG_VALIDATION=false` → flip WARN→REJECT after `scripts/audit-config-validity.ts` confirms the stored corpus is clean. WARN is the correct safe initial state.
- `PUBLISH_ROLES=['admin']` → expand to a dedicated `publisher` role if publish ≠ admin is needed.

## 6. Deferred doors (open on their trigger — YAGNI)
D-HREF (remote/url sources) · ApiResponse envelope · per-source auth · data-blending (Mixed) · SDMX REST surface. Each is additive behind a named trigger.
