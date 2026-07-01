---
name: async-store-acl-parity
description: The async ApiStore/stats-adapter contract — classifier i18n labels, obs numeric coercion, display overlay wiring, range warm/read key SSOT
metadata:
  type: project
---

The single async-store ACL contract that restores+exceeds old static-app render fidelity (demo parity). One concern across plugins/datasources + core/data + react/engine.

**Contract decisions (locked by fitness functions):**
- **Classifier label shape (GAP 5b):** `StatsClassifierRow.label: Record<string,string>|string|null` (LocaleString `{en,ka}`), `parent_code: string|null`. `fromStatsClassifiers` keeps the LocaleString INTACT (no flatten — the store builder runs at boot with NO user locale) and maps `parent` DIRECTLY from `parent_code` (dropped the old codeById id→code indirection). null/empty label degrades to `code`.
- **Obs coercion (GAP 3):** `RawStatsObsRow.obs_value: string|number|null` (pg serializes numeric as STRING). `fromStatsObsRow` → `value: Number|null` (null preserved = suppressed≠0; non-finite→null). `liftObsAttributes` surfaces `obs_attribute` generically snake→camel (`seq_pos`→`seqPos` as a number) — accounts config sorts `by:'seqPos'` + filters `seqPos>0`.
- **Display overlay (GAP 5):** `ApiStore` gained a `readonly display` field (mirrors `classifiers`); CachedStore already forwards `source.display`. `buildDisplayOverlay(Classifier)→DisplayMap` lives in `stats-display.ts` (split from stats-api.ts at the 400-line ceiling), keyed by `code` (array-form classifier id==code, matching resolveDisplayRef's join), carrying label{en,ka}/color/order. SSOT: same classifier rows, no 2nd endpoint. $cl/$d separation preserved (structural attrs NOT carried in).
- **Range warm/read key (GAP 4):** added `queryReadObs(query)` (core/registry/resolvers, exported from engine index) = the EXACT obs StoreQuery the QueryResolver read issues (resolveQueryMeasures, NO time bound). useNodeRows warms via it → warm-key≡read-key in BOTH modes. `extractRequirements` query branch is range-aware: when no time filter AND time unset (isUnsetTimeDim), emits ONE unbounded req (no time:0 pin) matching the unbounded read.

**Engine-type widening (Class-M, additive):** added `AttrVal = DimVal | LocaleString`; `ClassifierEntry`/`DisplayMap` attr bags admit it; `resolveDisplayRef`/`resolveDimRef`/`DimViewResult` return `AttrVal`. `EngineRow`/`DataRow` stay scalar — LocaleString is a TRANSIENT `$d`-join artifact.

**i18n resolution seam:** `resolveNodeRows` (react, holds `ctx.locale`) resolves LocaleString cells to a concrete string — on RAW rows BEFORE applyEncoding (which String()-flattens the label channel → "[object Object]") AND once after node transforms. No-op for scalar cells (single-locale = byte-identical). charts/core stay locale-agnostic.

**FFs added:** FF-OBS-NUMERIC + GAP-5b mapping (stats-api.test.ts), FF-DISPLAY-WIRED (stats-display.test.ts), FF-WARM-READ-KEY-EQ (core/data/warm-read-key.fitness.test.ts), i18n boundary (resolveNodeRows.test.ts).

**Coordination for the converge (orchestrator):**
- (a) seed work landing an `aggregates` + de-duped `geo` classifier — the display overlay + classifier mapping consume whatever dims `nonTimeDims` lists; no code change needed when those land.
- (b) frontend `$ne:'_T'` config tweak — config-only, orthogonal to this seam.
