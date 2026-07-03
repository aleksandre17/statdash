# ════ RESUME HANDOFF (2026-07-03, near context limit) ════
Read this first, continue AS IF UNINTERRUPTED. Prod = SSH `geostat-deploy` 192.168.1.199, `ops/compose/docker-compose.prod.yml -p statdash-prod`, geostat :3002 / panel :3003. Deploy doctrine + landmines in `.claude/agent-memory/senior-backend-developer/project_live_deploy_mechanism.md`.

## 🔴 PROD LANDMINES (owner-decision pending — do NOT trip)
1. **Postgres volume MIS-MOUNTED → DB on EPHEMERAL storage.** Data survives ONLY while postgres is not recreated. NEVER `--force-recreate` the stack / recreate postgres / `down -v`. Use `up -d --no-deps --force-recreate <api|geostat|panel>`. `pg_dump` before any DB op. **Durable fix (remount volume to `/home/postgres/pgdata`) needs owner sign-off — NOT done.**
2. **Disk /dev/sda2 tips to 100% on no-cache 3-image builds.** `df -h /` + `docker builder prune -f` + `docker image prune -f` (dangling only) before builds. Durable fix (cron prune) owed.

## LIVE NOW (main HEAD `081d796`; last frontend deploy `4727c76`; DATA ingested)
- Map = **declarative d3-geo SVG choropleth** (Leaflet retired — the 5-attempt blank saga CLOSED; immune to hidden-container class). AR-38 directional sector cross-filter. Income treemap = img_15 (=/+ contribution markers). i18n: engine-resolved labels track locale on ROUTE-LOAD **and CLIENT TOGGLE** (cache keyed on locale). AR-39 integrity = ONE section indicator (about to move to page-header, see below). Perspective-tabs flush-left, kpi single freshness badge, section-header order (link·info·status·toggle), hero one-line+spacing, low-cardinality bar px-cap.
- **DATA REFRESHED + LIVE (ingested, backup `/tmp/statdash-prod-backup-20260703-221933.dump`):** GDP_ANNUAL **399** (deflator merged as `gdp-deflator` measure, 2025 obs_status=P), REGIONAL_GVA **1665** (2024 added + 2010–2015 REVISED to vintage 2026-07-03; _T-2010=22148.65 now reconciles w/ GDP), ACCOUNTS 415. Preliminary = source **`*`-marked** cells (currently only 2025 GDP+deflator) → obsStatus=P; year-agnostic (Law 1). `DATA/canonical/FEATURED.json` = 11 featured obs.

## ⏳ IN-FLIGHT branches (unmerged — INTEGRATE these next)
- `feat/integrity-pageheader` (X): move AR-39 integrity indicator SECTION→PAGE (page-header__right, NodeStatusContext page-scope); remove kpi freshness badge + redundant `badge--preliminary`; section-actions responsive-wrap (drops below long title at low res).
- `feat/from-to-control`: options-driven **[from] დან [to] მდе** / **from [x] to [y]** year control — MUST keep writing BOTH `fromYear`+`toYear` ctx keys (filtering intact); words in slice `meta.ts` (INV1 doesn't scan meta). (Rejected: `type:range` breaks 2-key filtering; provisioning `suffix` breaks INV1 — `მდე` has no EN.)
- `feat/range-map-hero` (Y, DONE): occupied-red in dynamics map (geo-map-range `occupiedIso` added) + hero title top margin.
**Integration:** merge Y + X + from-to → full gate (`pnpm install`; tsc geostat+panel; eslint; check-laws; vitest — PARSE `Tests N failed`) → deploy (provisioning changed → 3-image + API re-provision) → LIVE-VERIFY by DISPLAY (I read screenshots): integrity in page-header only, occupied red in dynamics, from→to words render AND still filter, section responsive wrap.

## QUEUE (cleanups)
- ingest-driver `publish_job`: treat converged-409 as success (else every refresh aborts).
- apex NaN = pre-existing NON-BREAKING console noise (ApexCharts redrawOnParentResize race on chart↔table hide); root fix = unmount chart synchronously on hide (thread `viewToggle.isHidden` to ApexRenderer). Low-priority.
- getComputedStyle-teardown pageerror (minor). Constructor i18n P4 + runner-chrome catalog (feedback.ts EN-only /ka — needs ADR-0028 catalog wire, one-way-door → owner).
- **featured-slider NOT built yet** — FEATURED.json ready; build the landing slider from featured-metrics via semantic layer (AR-40 first consumer). See orchestrator memory `project_landing_slider_featured.md`.

## REGISTRY / VISIONS (`platform/work/ARCHITECTURE-REGISTRY.md`)
AR-40 semantic/metrics layer (spine; kills number-consistency bug-class + powers slider) · AR-41 reactive dataflow core · AR-42 grammar-of-interaction→Constructor · AR-43 lineage · AR-44 explorable · (declarative choropleth = DONE). AR-37 i18n (P0-P2 live) · AR-38 directional (live) · AR-39 integrity (moving to page-header).

## DOCTRINE reinforced this session (owner)
Economy via logistics (batch, done-once, cheap-model-per-task, short status). Dynamic delegation (do trivial edits myself). Anticipate/trust real-mechanism gates (not ritual screenshots) BUT read screenshots for visual-match + real-wire. Principled refusal / guardian-of-canon (agents rightly refused gate/filter-breaking #5). Be initiator/ideologue, full-picture, steps-ahead, flawless.
