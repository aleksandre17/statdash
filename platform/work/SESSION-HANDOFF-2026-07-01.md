# Session Handoff — 2026-07-01 (end-of-session, clean stop for restart)

## BRANCH + DEPLOY STATE (consolidated — read first)
- **ONE branch: `main`.** Local + `origin/main` + the server build clone (`/tmp/statdash-build`) are ALL on `main` @ `b5bf242`. `feat/tenant-agnostic-platform`, `master`, and the stale `worktree-agent-*` branches are DELETED. Going forward: **commit on `main`, deploy from `main`** (no more fetch-by-name). Safety = commit-granularity + revert + deploy `:rollback` images + `pg_dump` backups.
- **LIVE `http://192.168.1.199:3002`** serves `main`@`b5bf242` (all session work). Server = `statdash-{geostat,panel,api,postgres}` on `statdash-net`, flyway at **V38**.

## DEPLOY RUNBOOK (I did these directly via SSH this session — works)
1. `git push origin main`.
2. SSH `administrator@192.168.1.199`: `cd /tmp/statdash-build && git fetch origin main && git reset --hard origin/main`.
3. Tag rollback: `docker tag statdash-geostat:latest statdash-geostat:rollback` (+ api/panel).
4. **FE code change** → `docker-compose -f ops/compose/docker-compose.prod.yml up -d --build geostat` (geostat bundle). **provisioning.json change** → rebuild the **api** too (`up -d --build` all, or `statdash-api`) so its boot `runProvisioning` re-bakes+re-loads the config. Compose service names: `postgres flyway statdash-api ingest panel geostat`.
5. Verify: bundle hash changed (`curl -s :3002/ | grep index-…js`), pages 200. **Grep on provisioning strings is UNRELIABLE** (account/classifier codes persist in retained sections) — verify VISUALLY / by section-count, not string-grep.

## SHIPPED THIS SESSION (all on main, all green)
Styles body-sizing+R2/R3, TM DimBinding axis, V38 AgencyScheme + api DRY, P1 authoring-semantics SSOT, fail-soft chrome, choropleth+donut color, layout-node adoption/section-uniformity, AR-5 maximal CSS-Grid, i18n LocaleString contract fix, AR-13 theme-switcher, AR-14 chart dark-theming, AR-8 context-proportional sizing (solo 1.68× paired @1440), AR-15 table scroll+scrollbars, AR-27 header-wrap, AR-34 sticky, **AR-35 SNA PivotTable align+bounded-scroll** (the accounts table — was the long saga), D1 sync-theme no-FOUC, RouteScrollManager (soft-nav scroll reset), accounts redundant-chart-section removal. DB proof: V38 + 396 fitness on real Postgres.

## PENDING / NEXT (ranked)
1. **chief-engineer coherence QC** on `main` — offered, NOT yet run. Degradation/anti-pattern check across the session's ~115 commits before treating main as fully certified. (Guardian duty — owner asked to use the strongest agent for QC.)
2. **AUDIT-live-product.md remaining (F14, F2):** F14 degraded-states render raw RFC-9457 JSON to users (error boundary → design-system); F2 per-section export is a stub. Plus F5/F13 chart-theming DONE, F1 switcher DONE, F3 i18n DONE, F4 dark DONE.
3. **D2 (map theme-reactive):** the choropleth ramp does not recompute on a RUNTIME theme toggle (only on load, fixed by D1) — add `useThemeVersion` (AR-14 seam) to `GeoMap.tsx colorByGeo` memo deps.
4. **AR-8 @2560:** solo/paired differential drops to ~1.4× at ultrawide (1.68× at 1440–1920) — tune if ultrawide-consistency wanted (minor).
5. **DESIGNED-but-unbuilt** (see ARCHITECTURE-REGISTRY): AR-4/AR-11 framework-grade style system + StyleField, AR-7 parts, AR-10 P2/P3/P4 authoring, AR-12 RX-16 one-map-node, AR-21 V33 fresh-DB ordering, AR-22 TM P-final, AR-28 SSG north-star (DEFERRED).
6. **DEFERRED (owner):** MT SaaS (AR-30, seam preserved), perspective-lattice (AR-31).

## SSOT POINTERS (consult at session start)
- **`work/ARCHITECTURE-REGISTRY.md`** — every high-concept architecture + lifecycle status (AR-1…AR-35). The "never lose visions" SSOT.
- **`work/AUDIT-live-product.md`** — the F1–F18 live-product defect inventory.
- `work/DESIGN-*.md` — composition, framework-style, authoring-SSOT, proportional-sizing, rendering-architecture, map-consolidation.
- `work/HUNT-{adoption,antipatterns,future-vantage}.md` — capability/defect hunts.
- Orchestrator memory `.claude/agent-memory/orchestrator/MEMORY.md` → the **operating doctrine** ([[lead-methodology-mastery]]): dynamic best-method-per-problem, **ROOT-CAUSE + verify the OWNER'S REAL path FIRST** (the table saga: ~15 turns chasing symptoms because probes hard-loaded while the owner soft-navigated + the table was a PivotTable, not SimpleTable), prep-then-delegate (prep context, free judgment), QC with chief-engineer, economy via probes/fitness over screenshots, no degradation ever.
