---
name: bootstrap-runner-adr
description: ADR-0026 — turn apps/geostat into a generic content-agnostic "runner" (Server-Driven UI shell) that boots any site from GET /api/bootstrap; geostat content becomes seed/provisioning data
metadata:
  type: project
---

# ADR-0026 — Generic Bootstrap Runner (Server-Driven UI shell)

**Status:** Proposed (2026-06-22). Supersedes the informal "Phase 1→2 single switch" note in apps/geostat/src/CLAUDE.md.

## Decision
Make `apps/geostat` a **generic Server-Driven-UI runner**: it composes engine+react+plugins (compiled), and boots ANY site by fetching one unified manifest from the API. All Geostat-specific content (pages, nav, chrome, datasets, i18n, branding) moves to DB/provisioning, served as data. Do NOT extract a separate `@geostat/runner` package yet (YAGNI — single deployable; promote only when a 2nd app shell is real). The runner stays `apps/geostat` but is gutted of content.

**Plugin model: COMPILED-IN, content from API.** All nodes/panels/slices stay registered via `setupRegistrations.ts` (microkernel — fixed capability set). The runner is "generic" w.r.t. CONTENT, not w.r.t. CODE. Dynamic plugin loading / module federation is explicitly OUT OF SCOPE until a real tenant needs a node type not in the catalog. This is the pragmatic line: Grafana/Superset ship a fixed core panel set + config-from-DB; only Grafana's plugin *marketplace* is dynamic, which we don't need.

**Multi-tenant: single-tenant-per-deployment now, host-resolved manifest later.** `GET /api/bootstrap` returns the one site. Add `?site=` / Host-header resolution in Phase D only when a 2nd tenant is real. Keep the manifest contract host-agnostic so this is additive.

## The 3 entanglement points (the ONLY blockers) + resolutions
1. `src/data/site-manifest.ts buildManifest()` — static imports of STORE_MANIFEST/listPages/NAV/CHROME_CONFIG/GLOBAL_CHROME/I18N_CONFIG. → Replace with `fetch('/api/bootstrap')`. buildManifest stays as the OFFLINE FALLBACK only (same resilience pattern fetchStats already uses for stores).
2. `src/data/pages/registry.ts ALL_PAGES` — 4 static page-config imports. → loadPage/listPages already exist as the seam; bodies become reads from the bootstrap payload (pages already in manifest, so registry mostly dissolves).
3. `src/app/LocaleGuard.tsx` — imports LANDING_CONFIG directly for the index route. → use `manifest.pages['landing']` (the index page id becomes manifest.indexPageId, configurable). NOTE: LocaleGuard.tsx line 50 also has a stray `NodeRegistry.getByCapability` token in JSX (pre-existing bug, fix in passing).
Minor: setupRegistrations modeRegistry.register calls carry Georgian labels (app data in runner) → move mode definitions into the manifest (manifest.modes) seeded from DB. i18n/formatters.ts hardcoded locale list → derive from manifest.i18n.locales.

## SiteManifest contract (what GET /api/bootstrap returns — superset of today's SiteManifest)
JSON-serializable, no functions. Fields: `datasources` (DatasourceInstanceConfig[]), `pages` (Record<id,NodePageConfig>), `indexPageId` (string), `nav` (NavEntry[]), `chrome` (Record<slot,ChromeEntry>), `chromeConfig` (ChromeConfig — branding), `i18n` (I18nConfig), `modes` (ModeDef[] — moved out of setupRegistrations), optional `schemaVersion` (for migratePageConfig-style forward-compat on the whole manifest). SiteBootstrap (runtime) stays = { manifest, stores }; stores built by buildStoreManifest(manifest.datasources) — already live.

## /api/bootstrap endpoint — NEW, but cheap (pieces all exist)
A PUBLIC, UNGUARDED, read-only sibling route (exactly the `publicDataSourcesRoutes` pattern at apps/api/src/routes/data-sources/index.ts — sibling to the JWT-guarded config/*). It COMPOSES the existing reads server-side: published pages (config.page + page_version where is_published, with migratePageConfig), nav tree (config.nav_item recursive CTE), site_config key/value → chromeConfig+i18n+indexPageId+modes, connected data_source rows → datasources. Returns ONE payload so the client makes one boot call (Grafana bootData / Retool fetchAppManifest pattern). Do NOT reuse the JWT-guarded config/site routes for this — keep authoring surface (config/*, guarded) separate from delivery surface (bootstrap, public, published-only, minimal projection). ISP + least-privilege at the boundary.

## Already DONE (leverage, do not rebuild)
- Store half of the switch is LIVE: VITE_STORE_MODE=stats → fetchStats → fetchStoreManifest → GET /api/data-sources → buildStoreManifest. Resilience fallback to static STORE_MANIFEST already coded.
- Render path fully generic + data-driven: App → LocaleGuard → PageLoader → NodePageRenderer driven by nodeRegistry + injected stores. Nothing names Geostat.
- Server has config.page/page_version (with publish FSM + lazy migratePageConfig), config.nav_item, config.site_config, config.data_source, public /api/data-sources, file provisioning loader (GitOps: pages/nav/dataSources upsert on boot).

## Roadmap (expand→contract, reversible)
- Phase A: add GET /api/bootstrap (compose existing reads). Add fetchBootstrap in geostat; bootstrapSite gains VITE_SITE_MODE=api branch that fetches manifest, falls back to buildManifest on failure. Resolve 3 entanglement points behind the manifest. GATE: env flag flips back to local. FITNESS: with API up, geostat renders identically from /api/bootstrap (snapshot/e2e parity).
- Phase B: seed all geostat content into config.* via provisioning JSON (pages/nav/site_config/data_source). What's MISSING: site_config must carry chromeConfig+i18n+indexPageId+modes (today it's open key/value — define the keys); a chrome provisioning path. GATE: provisioning is idempotent + dryRun. FITNESS: fresh DB + provisioning dir → /api/bootstrap returns full geostat manifest.
- Phase C: make the runner the deployable; delete store-manifest.ts (offline fallback), ALL_PAGES body, mocks/**, src/pages/**, src/data/<dataset>/**, nav/chrome/site configs. Content now lives only as seed data. GATE: keep one git tag pre-deletion. FITNESS (THE SUCCESS TEST): a SECOND demo tenant (different dims, pages, branding, locales) provisioned from JSON renders with ZERO code change.
- Phase D (only if real): host→site resolution in /api/bootstrap; ModeDef/locale from manifest already done in A so this is pure routing. FITNESS: two hostnames serve two sites from one deployment.

## Alignment with project laws
Law 1 (no privileged dims): manifest carries dims as data; modes moved to manifest.modes (generic ModeDef) not hardcoded. Law 3 (arrow + react agnostic): runner composes, content imports only TYPES; bootstrap is app-layer. Law 5 (API-readiness): bootstrap IS the swap-DataStore-in-one-param principle generalized to the whole site. Law 7 (architecture leads): legacy content migrates to provisioning (Strangler-Fig), runner is the target. Constructor Phase 2: the Constructor writes config.* (authoring surface); the runner reads /api/bootstrap (delivery surface) — same SSOT, two projections.

## Rejected alternatives
1. Separate @geostat/runner package now — rejected (YAGNI; one deployable; promote when 2nd shell real).
2. Dynamic plugin loading / module federation now — rejected (no tenant needs a non-catalog node; massive complexity for zero current benefit; revisit when a tenant needs a custom node).
3. Reuse guarded config/site for boot read — rejected (conflates authoring vs delivery; would force a public token or weaken the admin guard; violates ISP/least-privilege).
4. Per-resource boot (client fetches /pages + /nav + /data-sources separately) — rejected (N round-trips, no atomic site snapshot, client orchestrates server concerns; one /api/bootstrap is the Grafana bootData pattern).
