---
name: three-tier-environments
description: The LIVE 3-tier line (dev→staging→prod) on 192.168.1.199 — ports, per-tier creds, network isolation, live-watch, fresh-boot fix. Built 2026-07-11.
metadata:
  type: project
---
**Three fully-isolated tiers are LIVE on the server `192.168.1.199` (SSH alias `geostat-deploy`, `administrator@192.168.1.199`).** Canon doc: `docs/architecture/ENVIRONMENTS.md`. Each tier = own compose project + network (distinct /24 subnet) + volume + ports + throwaway secrets — sharing NOTHING at runtime.

| Tier | project / net | subnet | api | geostat | panel | pg | admin login |
|---|---|---|---|---|---|---|---|
| **prod** | `statdash-prod` / `statdash-net` | 172.27 | internal | :3002 | **:3003** | internal | (real — UNTOUCHABLE) |
| **staging** | `statdash-stg` / `statdash-stg-net` | 172.28 | :3007 | :3009 | **:3008** | :5457 | `admin` / `stg_admin_pw_123` |
| **dev** | `statdash-dev` / `statdash-dev-net` | 172.29 | :3011 | :3012 | **:3013** | :5458 | `admin` / `dev_admin_pw_123` |

Creds are per-tier THROWAWAY (already in `ops/compose/docker-compose.{dev,staging}.yml`; dev/staging isolated, never real data). PROD creds unknown + untouchable.

**Isolation — PROVEN (2026-07-11):** `statdash-api` is a **network-scoped alias**, not a hardcoded host (both `apps/{panel,geostat}/nginx.conf` `proxy_pass http://statdash-api:3001` + `apps/panel/vite.config.ts` dev proxy). Each tier's frontend resolves `statdash-api` to ITS OWN tier api (verified: panel×3 + geostat×3 → 172.27/28/29 own-api; zero cross-tier bleed). One config, N isolated tiers (12-factor).

**Data:** **dev has REAL data** (`stats.observation` = 2479, real 4-dim GDP) loaded via the ADR-035 fresh-boot path. staging = a prior build. prod = live. **Fresh-from-zero boot** now works (`ADR-035` `ops/postgres/migrations/beforeEachMigrate.sql` seeds geo/sector/account STRUCTURE before V33 → plain `flyway migrate` reaches V38, ingest is additive) — closes the V33-asserts-ingest-data defect; **prod is now DR-capable** (was not).

**Live-watch (dev tier):** WORKS on **:3013** — the dev-line panel is a source-mounted Vite container (HMR proven: local `apps/panel/src` edit → instant on :3013, no rebuild). Sync from Windows: `bash ops/scripts/dev-watch-panel.sh` (MSYS2 rsync+ssh recipe). **⚠ CORRECTED 2026-07-17: the real mount source is `/tmp/statdash-dev-line/platform/apps/panel/src` — the dev line runs from its OWN server clone `/tmp/statdash-dev-line` (compose labels prove it), NOT `/home/administrator/statdash-dev-src` (stale; a sync there lands nowhere and the container serves old code silently — verify with `docker inspect statdash-dev-panel-full` Mounts + in-container md5sum, never trust the sync alone).** Script fixed same day. Dev api image rebuilds work from EITHER clone (`/tmp/statdash-build` or the dev-line clone) — the image tag `statdash-api:dev` is host-global. The kit `dev watch` bug was ALSO fixed canonically (`ebaa9a9`, Dev-Remote.ps1 — rsync stdout leaked into the fn return → false exit-1); toolchain/recipe in [[remote-dev-cli]]. **Work on dev, not local vite** (owner pref). Deploy method + build-context: [[server-deploy-build-context]]; isolation model origin: [[infra-pattern]].
