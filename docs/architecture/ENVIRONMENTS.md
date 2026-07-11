# Environments — the three-tier line (dev → staging → prod)

> Canonical model for the deployed lines on the server (192.168.1.199). Each tier is a
> **fully-isolated** stack — its own compose project, network, volumes, ports, and secrets —
> sharing NOTHING at runtime with the others. Isolation is the safety guarantee: an action on
> one tier can never reach another (esp. **prod is untouchable** from dev/staging work).

## The three tiers

| Tier | Compose | Project / network | Source | Data | Purpose |
|------|---------|-------------------|--------|------|---------|
| **dev** | `ops/compose/docker-compose.dev.yml` | `statdash-dev` / `statdash-dev-net` | a **feature branch** | test / may be empty | active development, fast iteration; the place to preview in-progress work. Can carry **live-watch** (kit Mode ③, source-synced HMR). Ports: api 3011 · geostat 3012 · panel 3013 · pg 5458. |
| **staging** | `ops/compose/docker-compose.staging.yml` | `statdash-stg` / `statdash-stg-net` | the **release candidate** (main / release branch) | **prod-like** | final release-candidate validation — a prod MIRROR — before a prod cutover. Image-based (prod-like), not live-watch. Ports: api 3007 · panel 3008 · geostat 3009 · pg 5457. |
| **prod** | `ops/compose/docker-compose.prod.yml` | `statdash-prod` / `statdash-net` | **main** | real | the live system. **UNTOUCHABLE** from any dev/staging operation. Ports: geostat 3002 · panel 3003 · api/pg internal. |

## Why all three (not just dev + prod)
- **dev** optimizes for iteration speed (feature branches, fast reload, disposable data).
- **staging** optimizes for release confidence (prod-mirror image + config + prod-like data) — it catches environment/data issues that dev's fast-loose setup hides, BEFORE they reach prod.
- **prod** is live and never a testing surface.
This is the standard promotion pipeline: **build on dev → validate on staging → cut over to prod.**

## Isolation invariants (the hard floor)
- Each tier: distinct compose **project**, **network**, **volume(s)**, **published ports**, **secrets**. Zero shared runtime.
- No tier references another's network/alias/volume at runtime (dev/staging carry their OWN api + db; a dev/staging app never proxies to prod).
- Prod is modified ONLY by a deliberate prod release from `main` — never as a side effect of dev/staging work.

## Notes / debt
- **Fresh-from-zero full-data boot** is currently gated by the V33/V34 migration-ordering defect (a corrective migration with a runtime data dependency on a later pipeline step) — see the AR-50-adjacent db fix. Until fixed, a fresh dev/staging volume caps at flyway `-target=32` (config tier live, observation cube empty). Fixing it lets staging carry true prod-like data on a clean boot.
- **live-watch** (kit Mode ③, `dev up … --mode remote` / `<alias> dev watch`) belongs to the **dev** tier only; staging/prod are image-based. Toolchain (pwsh + rsync + ssh) provisioning: see `.claude/agent-memory/orchestrator/project_remote_dev_cli.md`.
