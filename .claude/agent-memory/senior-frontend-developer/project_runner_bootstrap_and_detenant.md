---
name: runner-bootstrap-and-detenant
description: "ADR-0026 Phase A (manifest is runtime SSOT for the geostat runner) + ADR-0028 Phase 2 STRIP (geostat de-tenanted into a pure generic SDUI runner) — the two foundational runner-shape facts everything else in apps/geostat builds on. Consolidated distillate."
metadata:
  type: project
---

> Consolidated 2026-07-22 from 2 sibling files (bootstrap-runner-phasea, detenant-phase-strip).

## ADR-0026 Phase A — the manifest is the runtime SSOT for pages
- **`PageLoader` resolves the current page via `usePageById(pageId)` from `SiteContext`**
  (where `App` injected `manifest.pages`), NOT the standalone `loadPage()` in
  `data/pages/registry.ts`. The render path is identical whether the manifest came from
  `/api/bootstrap` or a local `buildManifest()`.
- `data/pages/registry.ts` is now LOCAL-FALLBACK ONLY — `listPages()` feeds `buildManifest()` +
  locale-coverage tests; `loadPage()` was removed (no callers after PageLoader switched).
- **Two orthogonal flags (ISP), do not fold one into the other:** `VITE_SITE_MODE=api` selects the
  manifest source (api-or-local fallback); `VITE_STORE_MODE=stats|api|static` selects the store
  source.
- Modes + locale formatters register POST-bootstrap from the manifest (`App.tsx` effect, before
  `setBootstrap`) — `setupRegistrations.ts` no longer hardcodes them. Safe because `App` gates
  render on `bootstrap` and `AppSkeleton` has no formatted content.
- i18n note: only the locale LIST was de-hardcoded (formatters iterate `manifest.i18n.locales`
  using the locale code directly as the Intl tag, no `ka-GE`/`en-US` mapping).
- **How to apply:** treat `SiteManifest` (`data/site-manifest.ts`) as the contract and
  `SiteContext` as the runtime SSOT — add capabilities as manifest data registered at boot, never
  hardcoded app constants.

## ADR-0028 Phase 2 STRIP — geostat is now a pure generic runner
Executed the one-way STRIP (after PROVE+TAG were green). geostat must carry ZERO tenant content
(Law 1) — all content lives as provisioning (`apps/api/provisioning/geostat.provisioning.json`) +
seed-data (`ops/seed-data/geostat/`); the runner boots content from the API, offline → a generic
empty state.

**Runner shape now:** `apps/geostat/src/data/site-manifest.ts` `bootstrapSite()` is API-first
(`GET /api/bootstrap` for the manifest + `config.data_source` rows for stores, both fail-soft).
`emptyManifest()` is the brand-free fallback: one en-only `__offline` inner-page with a `text`
node, empty nav/chrome/modes/datasources, locale `['en']`. See
[[reference_render_path_browser_verify]] for why that fallback path is itself currently broken
(a chrome shell throw un-mounts to a fully blank page).

**DELETED from the runner:** `src/data/{gdp,accounts,regional}`, the hardcoded
`store-manifest|metrics|nav.config|chrome-config|site-config|modes.config.ts`, `src/data/pages/`,
`src/pages/`, `src/mocks/`, `src/assets/`, the geojson/mockServiceWorker public assets, the
export-provisioning + locale-coverage tests, `scripts/export-provisioning.ts`.
**STAYS (generic shell):** `src/app/**`, `setupRegistrations.ts`, `stats-api.ts`,
`fetch-store-manifest.ts`, `stats-registrations.ts`, `i18n/{formatters,feedback}.ts`,
`extensions/**`. `i18n/feedback.ts` is KEPT en-only (backs generic packages/react chrome —
EmptyState/ExportBar/PreliminaryBadge/SharePermalink — not editorial content); tenant locales for
it now arrive via the manifest i18n catalog, see [[project_i18n_map]] ADR-019.

**Consumer re-points:** `apps/api/scripts/{seed.ts,verify-parity.ts,seed-pipeline.ts}` now READ
`ops/seed-data/geostat/*.bundle.json` instead of the deleted TS bundles (pre-projected: codes
resolved, geo='GE' injected, seqPos in obs_attribute). `seed.ts` collapsed the three per-dataset
seed functions into one generic loader.

**Still open (not this lane's scope):** `apps/api/scripts/seed-pipeline-payloads.ts` +
`export-seed-data.ts` still import the deleted TS bundles (extraction tooling that CONSUMES TS to
PRODUCE files — can't re-point the same way). Per the ADR they should be deleted; left for the
api-owner to decide on a regenerate-from-TS path. This keeps `tsc -p tsconfig.scripts.json` red on
3 pre-existing errors in `seed-pipeline-payloads.ts` until resolved.
