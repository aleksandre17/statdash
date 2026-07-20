---
name: dev-runtime-topology
description: How the panel/api/geostat dev servers + remote DB tunnels are wired locally on this machine (ports, proxy, auth dependency)
metadata:
  type: reference
---

Local dev runtime topology (observed 2026-07-20), for grounding live recon on this machine.

- **Panel app** (`apps/panel`) dev = plain `vite`; port from `APP_DEV_PORT` env (owner runs `:3013`), else Vite default `:5173`. Title "Constructor — Panel". Page title differs from geostat's "Statistical Dashboard".
- **Geostat app** (`apps/geostat`) = the other Vite app; when up it took `:5173`. NOTE it uses `postcss.config.js` with tailwind and can 500 on CSS if tailwind module resolution breaks — panel has NO postcss/tailwind so it boots clean independently.
- **API** (`apps/api`, tsx `src/index.ts`) = `:3001` (0.0.0.0). Panel proxies `/api` → `process.env.VITE_DEV_API_PROXY ?? 'http://statdash-api:3001'` (a DOCKER hostname). Outside Docker the default 502s — must set `VITE_DEV_API_PROXY=http://localhost:3001`.
- **DB is REMOTE over SSH tunnels** to host alias `geostat-deploy` (`ops/config/ssh/config`): `:5455` → remote Postgres (pgbouncer), `:3010` → remote deploy API. `DATABASE_URL` default targets `pgbouncer:5432`. When the `:5455` tunnel/remote pg is down, the API's `/api/auth` returns 500 `ECONNRESET` (auth calls `hasAdminUser(app.pg)` first) → **login impossible, whole authed shell unreachable**.
- Panel has **NO dev auth-bypass and no mock store** (grep clean) — so a downed DB blocks ALL live UI recon; cannot forge a token without `JWT_SECRET`.

How to apply: before live UI recon, confirm (1) panel is the server you're hitting (check page title), (2) `VITE_DEV_API_PROXY` points at the live API, (3) the `:5455` DB tunnel is up (`POST /api/auth` returns non-500). If auth 500s ECONNRESET, the remote DB tunnel is the blocker — a remote/infra one-way-door, not a code fix.
