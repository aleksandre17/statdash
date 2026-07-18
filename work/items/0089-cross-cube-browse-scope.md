---
id: "0089"
title: "CROSS-CUBE BROWSE SCOPE — a picked raw cube must read ITS OWN store, not the page's (0084 finding #1)"
status: DONE (2026-07-18 — architect decided the seam [ADR-046 Addendum 3] + landed the minimal build; commit 733af93 on main; gates green; live wire-proven on :3013)
class: S-M
priority: P0
owner: lead → architect (seam decision) → build agent
implements: Law 11 (a browse that shows ANOTHER cube's data is a lying grid) · the ONE store-resolution cascade (renderNode:252) extended to steward heads
links:
  - work/items/0084-raw-source-get-entry.md    # finding #1 — the live browse is page-store-scoped
  - platform/apps/panel/src/features/data-layer/workbench/workbenchModel.ts   # withStewardCube — where the picked cube is known
---
**The gap (live-proven, flagged not papered):** a steward `source(query)` head carries no dataset/dataSource → `resolveStore` falls to the page's store → picking REGIONAL_GVA from a GDP page browses GDP rows under a REGIONAL title. The cube LIST + debt inventory are correct; only the live BROWSE is page-scoped.

**The decision needed (architect, ≥2 alts):** (a) the steward head names its dataset (`query.dataset` or a head-level `dataSource`) honored by the ONE cascade — mirrors how governed heads route via the metric's declared home (the semantic twist, SSOT-pinned by 0083); or (b) session-scoped store descriptors (the picked cube joins the live store map for the session). Bias per our canon: the HEAD should declare its home (config carries the truth; a session-side map is state the config can't replay) — but the architect rules, incl. expand-contract for stored specs.

**DoD.** Pick ANY cube from ANY page → the browse shows THAT cube's rows (live, wire `dataset=<picked>`); promotion still roundtrips; FF pinning the routing (a steward-head fixture with page-store ≠ picked-store); gates green; zero console errors.

---

**RESOLVED (architect, 2026-07-18).** Decision **(a)**: the steward head DECLARES its home — an OPTIONAL `dataSource` field (a `storeKey`, the SAME vocabulary the governed head uses via `MetricDef.dataSource`), honored FIRST by `specDataSource`. Recorded as **ADR-046 Addendum 3** (≥2 rejected alts: datasetCode-as-2nd-routing-vocabulary; session-scoped store descriptors). The datasetCode→storeKey map is the INVERSE of the existing SSOT `datasetCodeOf` (new `storeKeyForDataset` in `cubeProfile.store`), resolved ONCE at the pick gesture and frozen into config (expand-contract: additive optional field, stored specs never rewritten). **The identity is clean, NOT a fork:** storeKey=`source.name` (live-map key), datasetCode=`source.config.datasetCode`, 1:1 per session source.

**Build (commit `733af93`, main):** engine `SourceStep` steward variant gains `dataSource?` + `specDataSource` honors it (`declaredSourceHome`); `withStewardCube(m, measures, storeKey?)`; both pick sites resolve the storeKey (`SourcesBody` at click → `sourcesHandoff.PendingCube.dataSource` → `DataModelingPanel`; `DataWorkbench.pickCube` in place). **Guard `FF-STEWARD-HEAD-NAMES-STORE`** (6 cases, `metric-store.fitness.test.ts`).

**Gates:** panel 1168/1168 · core/react vitest EXIT 0 · api FF-PIPELINE-EQUIV 11/11 · `tsc -b` panel+geostat+api EXIT 0 · lint 0 errors. **LIVE (`probe-0089-cross-cube.mjs`, :3013):** each picked cube browses its OWN store — REGIONAL_GVA→`dataset=REGIONAL_GVA`, ACCOUNTS_SEQUENCE→`dataset=ACCOUNTS_SEQUENCE`, GDP_ANNUAL (foreign)→`dataset=GDP_ANNUAL` **crossCube=TRUE**, each 200 rows, zero console errors. Shots → `work/authoring-truth/0089/`.

**Follow-up (ledgered):** a picked cube that is NOT a session source has no live-map store → `resolveStore` falls to first-key/page store (degraded, no regression). Provisioning a picked-but-unbound cube into the session store map is a separate concern from the routing identity.
