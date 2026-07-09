---
name: project-panel-m0-boot-gaps
description: AR-49 M0 MetricPalette boot gaps — FIXED 2026-07-09 (Gap A catalog boot + Gap B i18n init); guards added
metadata:
  type: project
---

As of 2026-07-09, branch `feat/ar49-m0-metric-first-authoring`, the AR-49 M0 MetricPalette
in `apps/panel` cannot be exercised live out of the box because of TWO boot gaps that are
masked by tests (so the suite is green while the running app is broken). Both discovered
during a run/verify task; verify they still exist before acting.

**Gap A — no metric-registration boot path.** The palette reads `describeApp().metrics/
.dimensions` = the engine's process-global registry (`listMetricDefs`). The panel NEVER
registers metrics: `initFromApi` (store/api-actions.ts) loads `/api/config/*` only, and
`setupCanvasRegistry` registers slices/store-builders/projectors but NOT metrics. Only
`apps/geostat` registers them, via `bootstrapSite()` → `registerManifestMetrics/
registerManifestDimensions` from the `/api/bootstrap` manifest (site-manifest.ts). So even
with API+DB up, the panel palette shows the empty state. The real Geostat catalog (17
metrics + 6 dims) lives in `apps/api/provisioning/geostat.provisioning.json` under
`siteConfig` keys `metrics`/`dimensions`.

**Gap B — panel main.tsx omits `i18next.init()`.** geostat/src/main.tsx calls it (init
assigns `addResources`/`addResourceBundle`); panel/src/main.tsx does not. When PageStep
lazy-loads CanvasView → `setupCanvasRegistry` → `registerSlice` → `registerSliceI18n` →
`i18next.addResources`, it throws "addResources is not a function" and white-screens the
Page step (no error boundary around ConstructorWizard). Masked because
`apps/panel/vitest.setup.ts` calls `i18next.init()` for tests (its comment even says
"geostat does this in main.tsx").

**Proposed fixes (not applied — was a no-product-change task):** (B) add `i18next.init()`
to panel main.tsx mirroring geostat; (A) add a panel boot seam that fetches `/api/bootstrap`
(or reads the config) and calls registerManifestMetrics/Dimensions, the peer of geostat's
bootstrapSite. See [[project_bootstrap_runner_phasea]], [[project_runner_chrome_i18n_adr019]].

**RESOLVED 2026-07-09 (branch feat/ar49-m0-metric-first-authoring).**
- Gap B: `apps/panel/src/boot/initI18n.ts` (`initPanelI18n()`) — ONE init SSOT called by
  BOTH `main.tsx` (before render) AND `vitest.setup.ts` (killed the drift that masked it).
- Gap A: `apps/panel/src/store/bootstrapCatalog.ts` (`bootstrapCatalog()`) fetches
  GET /api/bootstrap (the SAME public delivery manifest geostat boots; the catalog is
  global site_config, NOT publish-versioned, so authoring catalog == runner catalog) and
  registers both channels. Wired into `App.tsx startApp` via `Promise.all([initFromApi(),
  bootstrapCatalog()])` before appState 'ready'.
- DRY seam relocation: `registerManifestMetrics`/`registerManifestDimensions` MOVED from
  `apps/geostat/src/data/site-manifest.ts` to `@statdash/engine` (packages/core
  `src/data/manifest-catalog.ts`, exported from core index) — the layer owning
  MetricDef/DimensionDef + importing the contracts wire mirror. geostat re-exports them
  from './site-manifest' so its importers (parity-harness, metric-delivery.fitness) are
  unchanged. Both apps now register through ONE path (Law 8).
- Guards: `store/bootstrapCatalog.fitness.test.ts` (boot-parity: both channels populate
  describeApp via the panel's own boot), `boot/mainI18nInit.test.ts` (source assert
  main.tsx inits before render — the definitive Gap-B RED-on-revert; reads main.tsx?raw,
  strips comments first), `boot/bootSmoke.test.tsx` (real registry + real MetricPalette
  e2e). Verified empirically: reverting Gap A → fitness+smoke RED; reverting Gap B →
  source guard RED. Harness files deleted.
- STILL PROVABLE ONLY LIVE (no Docker here): the actual /api/bootstrap response carrying
  the 17 metrics/6 dims from geostat.provisioning.json against a running api+db.
