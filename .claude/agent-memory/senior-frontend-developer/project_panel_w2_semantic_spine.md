---
name: project-panel-w2-semantic-spine
description: AR-52 W2 "Semantic Spine, lived" — data-first front-door hoist, the corpus FLIP onto governed metric handles (now MIGRATED), FF-DATA-BOUNDED, and the probe-mechanics fix. Supersedes the "corpus is UNMIGRATED" intel.
metadata:
  type: project
---

AR-52 Wave 2 (Canon C1 "data first, always"). **CODE+GATES LANDED on `main` 2026-07-17**
(commits `02d2cf9` front door · `04b39af` corpus + FF-DATA-BOUNDED · `90fb21c` probes ·
`5dc19c1` card). Card `work/items/0072`. Live J1/J2/J4 walks + reprovision PEND the owner's
:3013 stack (DOWN this session — curl 000; that's why no `work/authoring-truth/w2/` shots).

## What landed
- **Front door (outcome 1).** CanonicalUpload was buried inside Steward-only `ModelSurface`
  (rail Data → flip lens → upload). HOISTED to `studio/DataModelBody.tsx` ABOVE the role-lens
  split → onboard-data door (`data-testid=data-front-door` + `canonical-upload`) renders in the
  DEFAULT author lens, ONE step from the shell, both lenses. Governance preserved (publish =
  server-FSM; the raw-source modeler stays behind Steward Edit). `DataModelBody.test.tsx` proves
  it. FF-AUTHOR-NO-QUERY holds — CanonicalUpload is the blessed FRONT-DOOR component, NOT in the
  RAW_SOURCE_MACHINERY regex (that's ExcelUpload/DataModelingPanel/SourceAuthoringPanel); and
  DataModelBody is not a scanned `surfaces/*` file.
- **CORPUS NOW MIGRATED (outcome 3) — SUPERSEDES the "138×measure, 0×metricId, UNMIGRATED"
  intel.** 53 author-plane single-value bindings in `apps/api/provisioning/geostat.provisioning.json`
  flipped raw code → governed id. The 1:1 map (every code already had a governed metric — the
  catalog "expand" was done, this was the FLIP): **B5G→accounts.gni · B9→accounts.netLending ·
  B1G→accounts.gdp · P1→accounts.output · B6G→accounts.disposableIncome · B8G→accounts.savings ·
  GVA→regional.gva · gross-domestic-product-at-current-prices→gdp.current · gdp-per-capita-usd→
  gdp.perCapita · real-gdp-growth-rates→gdp.realGrowth**. Mechanics: `"measure": "CODE"` is an exact
  string only at author pins → `Edit replace_all` is safe EXCEPT **B1G** (also a calc-input at
  prov:5435 — target the wider `measure`+`to:{$ctx:toYear}`+`type:cagr` block) and **D1** (calc-only,
  SKIP). KPI specs already carried `format`/`unit` inline → the swap is RENDER-identical, not just
  coordinate-identical.
- **STEWARD PLANE stays raw by design (Canon C3):** catalog `code` fields (key `code`, not `measure`),
  calc-input coordinates (D1/B1G with an `at` sibling), and `type:query` fan-out DataSpecs (breakdown
  charts + raw-code exprs like `measure == 'P1'` that match the RESOLVED cube row — a governed id would
  never match). e.g. `non-observed-economy-share` (prov:2574) is inside a `type:query` — untouched.
- **FF-DATA-BOUNDED (outcome 4)** — new `apps/api/src/provisioning/data-bounded.fitness.test.ts`.
  Walks page `config.children`, STOPS at any `type:'query'` node (steward-plane fan-out), collects
  kpi value/trend/num/denom scalar `measure` pins, asserts each ∈ the siteConfig `metrics` id set.
  Planted-raw-code test proves it bites. THIS is the DoD's "0 author-plane raw-source configs".
- **Probe mechanics (folded fix).** New home `platform/e2e/probes/` — a probe UNDER the platform
  subtree resolves `@playwright/test` + `@statdash/*` from `platform/node_modules` natively (walk-up),
  so the old `cp ../work/probe.mjs ./_probe.mjs` dance is GONE (work/ is a SIBLING of platform/, Node
  never reaches platform/node_modules from there; NODE_PATH doesn't help ESM). Run from platform/:
  `node e2e/probes/probe-w2-semantic-spine.mjs`. W2 J1/J2/J4 probe lives there.

## Already built (verified, no W2 work)
- **Outcome 2 metric drag→bind** is FULLY WIRED: `canvas/CanvasOverlay.tsx` (hasMetricDrag/
  readMetricDrag) → `useCanvasController.bindMetric` → `discovery/metricBinding` (firstMetricField→
  bindMetricToProps, byte-identical); the Inspector DATA facet `inspector/controls/DataFacetField.tsx`
  mounts `MetricPalette` for click+drag. Both gestures, one write. **Gap (flagged, deep):** the honest
  UNBOUND-KPI card is NOT yet a drop target — kpi-strip measure is nested in `items[]`, not top-level
  bindable (`isMetricBindable` reads `firstMetricField` = top-level enum-ref source:'metrics'), so
  drag-onto-unbound-card needs a nested-part bind seam.
- **Outcome 5 DataFlowMap** is embedded since M4.3 — Region 0 of ModelSurface + top of
  DataDictionarySurface. Not exiled.

## The on-disk migration GUARD (reusable)
`apps/api/src/provisioning/config-cube-contract.fitness.test.ts` already resolves measure pins
THROUGH the catalog (`resolveMeasureCodes` mirrors engine `resolveMeasureRef`) before the DSD
existence check, reading the canonical workbook (`DATA/canonical/*.xlsx`) off disk. So a governed-id
swap is PROVED coordinate-safe with NO live db — run it after any corpus measure edit. Pair with
`packages/core` bind-parity (FF-BIND-PARITY, resolveMeasureRef byte-identity, 8 tests).

## Gate (parsed, 2026-07-17)
panel vitest 977/977 · tsc -b apps/panel clean · lint 0-err/6-warn · apps/api 379 pass/0 fail
(config-cube-contract 4/4, data-bounded 4/4) · core bind-parity 8/8. No packages/* touched → no dist
rebuild. See [[project-panel-w1-honest-canvas]], [[panel-data-model-reachable-m5b]], [[panel-data-flow-spine-m43]].
