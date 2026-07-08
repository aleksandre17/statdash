# ════ RESUME HANDOFF (2026-07-03, near context limit) ════
Read this first, continue AS IF UNINTERRUPTED. Prod = SSH `geostat-deploy` 192.168.1.199, `ops/compose/docker-compose.prod.yml -p statdash-prod`, geostat :3002 / panel :3003. Deploy doctrine + landmines in `.claude/agent-memory/senior-backend-developer/project_live_deploy_mechanism.md`.

## 🔴 PROD LANDMINES (owner-decision pending — do NOT trip)
1. **Postgres volume MIS-MOUNTED → DB on EPHEMERAL storage.** Data survives ONLY while postgres is not recreated. NEVER `--force-recreate` the stack / recreate postgres / `down -v`. Use `up -d --no-deps --force-recreate <api|geostat|panel>`. `pg_dump` before any DB op. **Durable fix (remount volume to `/home/postgres/pgdata`) needs owner sign-off — NOT done.**
2. **Disk /dev/sda2 tips to 100% on no-cache 3-image builds.** `df -h /` + `docker builder prune -f` + `docker image prune -f` (dangling only) before builds. Durable fix (cron prune) owed.

## ✅ DEPLOYED + LIVE-VERIFIED 2026-07-04 (main `118bde2`; backup `/tmp/statdash-prod-backup-20260704-094303.dump`; rollback tag `pre-integrity-slice-deploy`=8c45cab + `:rollback` images)
Playwright `:3002` display-verified: integrity chip YEAR-AWARE (2024→hidden, 2025→`წინასწ.` shown, დინამიკა→shown) ✓ · from→to two selectors render `დან`/`მდე` + toYear aria `საბოლოო წელი` ✓ · console 0 err · data preserved (399/415/1665, GDP-2025 P=25) · postgres NOT recreated.
**from→to render order — FIXED + DEPLOYED (`1420b99`):** ROOT = Postgres **jsonb reorders config keys by length** (`toYear`<`fromYear`) + `useFilterState.ts:45` rendered in raw key order. Fix = explicit `ParamDef.order` + stable sort (jsonb-immune, fixes latent class for ALL bars). Served config carries `order:10/20`. (client-side sort — needs browser confirm below.)
**from→to side-by-side — FIXED (`43e5ce2`), DEPLOYING (geostat-only, agent a555367):** owner req = the 4-part `[sel] დან [sel] მდე` window must ALWAYS be on one row (esp. regional/"sectors" page's wrapping `--strip` bar). Fix = FilterBarShell groups contiguous span endpoints into ONE `.filter-span-group` (nowrap, flex-shrink:0; hidden carriers don't break the run) + CSS. Test spanGroup 7/7.
**✅ BROWSER-VERIFIED LIVE (`43e5ce2`, Playwright `platform/work/verify-integrity-fromto.mjs`):** order reads `2010 დან 2025 მდე` ✓ · both endpoints in ONE `.filter-span-group`, sameRow, L→R from→to, on gdp/regional/accounts AND at 760px narrow (no wrap-split) ✓ · integrity chip 2024-hidden/2025-shown/gdp-dyn-shown/regional-dyn-HIDDEN (regional has no 2025-P → correctly data-driven) ✓ · 0 console errors. Deploy chain live: 118bde2(integrity)→1420b99(order)→43e5ce2(side-by-side); each postgres/api-safe, data 2479 preserved. Rollback tags: `pre-integrity-slice-deploy`=8c45cab, `pre-filter-order-deploy`=118bde2, `pre-filterspan-deploy`=1420b99.

## ✅ BIG PUSH COMPLETE + LIVE (`main`/prod @ `4d43b68`, 2026-07-04) — browser-verified
6 workstreams, all opus, 4 landmine-safe deploys: **DB persistent-volume (landmine CLOSED, ADR-019, postgres on statdash-prod-pgdata-v2)** · ingest-409-tolerance · **apex best-of-both** (opus sync-unmount + sonnet redrawOnParentResize:false + barFill guard) · **AR-40 P0 spine** (render/warm/preliminary unified on resolveMeasureRef; FF-RAW-CODE-IDENTICAL; gdp-total→gdp.current byte-identical) · **runner-chrome i18n** (feedback ns ka via manifest catalog, ADR-020, INV3 gate). Converged gate 2479/0. LIVE-verified (`verify-ar40-i18n-apex.mjs`): gdp KPI=104 598 real value, 0 console errors after 6 chart↔table toggles, `ბმულის კოპირება` ka, integrity chip correct. Rollback tags: pre-ar40spine-deploy=43e5ce2 etc. Data 2479 preserved.
**⏳ NOW BUILDING: AR-40 featured-slider P1-P3** (`feat/ar40-featured-slider`, ad7b943) — replaces the HARD-CODED stale landing stats-carousel (204000/Tbilisi-54100-vs-live-49374) with a data-bound slider through the semantic layer. P1 populate 11 metrics · P2 featured-slider node (core featured.ts→react useFeaturedRows→plugin, reuse interpretKpi via point KpiSpec, ResolvedMeasure.format read-point) · P3 Strangler-retire carousel. On land → gate → deploy → live-verify.

## (prior push log)
Lead OWNS all calls now (no owner sign-off bounces). Model policy corrected: DEFAULT opus for substantive work (see [[model-agnostic-agents]]).
**Active agents (all opus):** DB persistent-volume+cron (ae6b99a) · runner-chrome i18n+ADR (a00b019) · ingest-409 (ab93cf9) · apex-NaN sync-unmount (af471e0) · **AR-40 P0 spine (af607bb)**. ⚠️ DISCARD zombie sonnet runs adfc274(ingest)+af44b6a(apex) — superseded, do NOT merge.
**AR-40 DESIGNED + APPROVED (spec `docs/architecture/proposals/SPEC-AR40-semantic-layer-and-featured-slider.md`).** Lead approved all 6 decisions: (1) `format` on MetricDef+wire ✅ (2) 11 featured units/labels from FEATURED.json+seed, never fabricate methodology ✅ (3) hand-author FEATURED→provisioning first, generator later ✅ (4) NEW `featured-slider` node (not evolve stats-carousel) ✅ (5) Strangler-retire landing stats-carousel ✅ (6) page-level drill now, deep-link later(AR-42) ✅.
**SHARP FINDING:** KPI RENDER path not metric-aware while WARM path is → live latent cache-miss/dead-badge for any metric-id KPI; landing stats-carousel is HARD-CODED + already stale (Tbilisi 54100 vs live 49374). P0/U1 fixes render/warm asymmetry at root (byte-identical for raw codes, FF-RAW-CODE-IDENTICAL).
**PHASES:** P0 spine (building) → P1 populate 11 metrics in provisioning → P2 featured-slider node (core featured.ts→react useFeaturedRows→plugin) → P3 Strangler-replace landing carousel → P4(gated) provenance drift. **Serialize provisioning.json edits** (P1 + runner-chrome may both touch it → sequence to avoid conflict).
**Merge/deploy plan:** as opus agents land → converged gate (tsc+lint+laws+full vitest, PARSE `Tests N failed`) → landmine-safe deploy(s) → live-verify by display. Build P2/P3 AFTER P0 lands.

## QUEUE — (integrity+from-to epic DONE+LIVE; big-push above absorbs the rest)

## LIVE NOW (main HEAD `081d796`; last frontend deploy `4727c76`; DATA ingested)
- Map = **declarative d3-geo SVG choropleth** (Leaflet retired — the 5-attempt blank saga CLOSED; immune to hidden-container class). AR-38 directional sector cross-filter. Income treemap = img_15 (=/+ contribution markers). i18n: engine-resolved labels track locale on ROUTE-LOAD **and CLIENT TOGGLE** (cache keyed on locale). AR-39 integrity = ONE section indicator (about to move to page-header, see below). Perspective-tabs flush-left, kpi single freshness badge, section-header order (link·info·status·toggle), hero one-line+spacing, low-cardinality bar px-cap.
- **DATA REFRESHED + LIVE (ingested, backup `/tmp/statdash-prod-backup-20260703-221933.dump`):** GDP_ANNUAL **399** (deflator merged as `gdp-deflator` measure, 2025 obs_status=P), REGIONAL_GVA **1665** (2024 added + 2010–2015 REVISED to vintage 2026-07-03; _T-2010=22148.65 now reconciles w/ GDP), ACCOUNTS 415. Preliminary = source **`*`-marked** cells (currently only 2025 GDP+deflator) → obsStatus=P; year-agnostic (Law 1). `DATA/canonical/FEATURED.json` = 11 featured obs.

## ⏳ INTEGRATION STATE (main @ `4c3e29e`+ — NOT yet deployed)
MERGED to main this session: **from→to control** (`feat/from-to-control-2` — span-role composition, params stay `type:select`, both fromYear+toYear ctx-keys intact) + **visible-fold** (`fix/integrity-visible-fold` — NodeStatusContext gates publish on panel visibility; hidden panels don't fold) + **toYear WCAG label** (a11y accessible-name, aria-only via SelectShell). All green at merge; files disjoint.

**🔴 REAL integrity root (deeper than visible-fold) — FIX IN FLIGHT `fix/integrity-displayed-slice` (engine-specialist opus, agent `aaa101ba`):**
The 2024-chip leak is NOT (only) the view-toggle — it's **dataset-wide provenance** firing year-blind in TWO seams:
1. `core/data/kpi.ts:~266` — `prev = prov?.status==='p'` (measure's DATASET provenance) → KPI on final-2024 still reports preliminary because 2025-P exists in the dataset. Fix: derive from the DISPLAYED obs status (via `storeObs`), any-contributing-coord P.
2. `react/engine/resolvePreliminary.ts` step 3 — dataset-wide MetadataPort fallback, contradicts its own step-2 contract. REMOVE; steps 1(config)+2(displayed rows) are authoritative.
Owner law: preliminary = obsStatus=P of the VISIBLE slice, year-agnostic. Adds FF-INTEGRITY-DISPLAYED-SLICE.
**On its land:** converged gate (pnpm install; tsc geostat+panel; eslint; check-laws; vitest PARSE `Tests N failed`) → deploy (provisioning changed → 3-image + API re-provision; MIND prod landmines) → LIVE-VERIFY by DISPLAY: (a) chip 2025-shows/2024-hidden/dynamics-shows, (b) from→to renders `[2010] დან [2024] მდე` AND re-scopes CAGR/range charts+KPIs, (c) occupied-red dynamics still ok.

## QUEUE (cleanups)
- ingest-driver `publish_job`: treat converged-409 as success (else every refresh aborts).
- apex NaN = pre-existing NON-BREAKING console noise (ApexCharts redrawOnParentResize race on chart↔table hide); root fix = unmount chart synchronously on hide (thread `viewToggle.isHidden` to ApexRenderer). Low-priority.
- getComputedStyle-teardown pageerror (minor). Constructor i18n P4 + runner-chrome catalog (feedback.ts EN-only /ka — needs ADR-0028 catalog wire, one-way-door → owner).
- **featured-slider NOT built yet** — FEATURED.json ready; build the landing slider from featured-metrics via semantic layer (AR-40 first consumer). See orchestrator memory `project_landing_slider_featured.md`.

## REGISTRY / VISIONS (`docs/architecture/ARCHITECTURE-REGISTRY.md`)
AR-40 semantic/metrics layer (spine; kills number-consistency bug-class + powers slider) · AR-41 reactive dataflow core · AR-42 grammar-of-interaction→Constructor · AR-43 lineage · AR-44 explorable · (declarative choropleth = DONE). AR-37 i18n (P0-P2 live) · AR-38 directional (live) · AR-39 integrity (moving to page-header).

## DOCTRINE reinforced this session (owner)
Economy via logistics (batch, done-once, cheap-model-per-task, short status). Dynamic delegation (do trivial edits myself). Anticipate/trust real-mechanism gates (not ritual screenshots) BUT read screenshots for visual-match + real-wire. Principled refusal / guardian-of-canon (agents rightly refused gate/filter-breaking #5). Be initiator/ideologue, full-picture, steps-ahead, flawless.
