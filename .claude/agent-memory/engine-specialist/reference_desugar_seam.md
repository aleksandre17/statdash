---
name: desugar-seam
description: data/desugar.ts is the R3 SSOT lowering convenience DataSpecs to primitives; only pivot desugars (val-cell specs blocked); FF-DESUGAR-EQUIV gates row-identity
metadata:
  type: reference
---

`data/desugar.ts` — `desugar(spec): DataSpec` is the SSOT rewrite that lowers a CONVENIENCE DataSpec to its primitive equivalent (ADR R3, fault line F-A). Pure, JSON-free, no ctx/store. Called FIRST by `interpretSpec` AND `extractRequirements` (one resolution path). Total: any spec with no rule (every primitive) returns the SAME reference (identity ⇒ untouched path). Exported from `data/index.ts` + root `index.ts`.

**Only `pivot` desugars** → `transform` + `[melt, cast value, rename keyField→label, cast label/series→string, concat→id '::', lookup color by series]`. PivotResolver collapsed into a 3-line desugar-delegate (kept registered so `pivot` stays a KNOWN spec type for `validateDataSpec` + Constructor `specTypes()` + by-mode→pivot nesting).

**The R3 GAP (left direct, NOT desugared):** `timeseries`/`growth`/`ratio-list`/`row-list` read via `storeVal` = `{type:'val'}` OLAP cell = auto-apply ALL ctx.dims (hierarchy leaf-expand + comma-multi) + exclude isCarryForward + SUM + roundAgg(2dp). `query` reads via `storeObs` = `{type:'obs'}` = no ctx.dims auto-filter, no sum, no round, raw Observations. For a generic store (ApiStore) val≠obs are different queries. No `query`+pipe can reconstruct the val-cell row-identically. **Missing capability to close this:** a transform op (or query mode) that reproduces the `val` OLAP-cell semantics on `obs` rows — ctx.dims leaf-aware filter + carry-forward exclusion + group-sum + roundAgg. Until then, those branches keep their direct resolvers (correct partial Strangler-Fig).

FF-DESUGAR-EQUIV: `data/desugar.fitness.test.ts` — inlines the frozen pre-R3 PivotResolver as oracle, asserts `interpretSpec(pivot) toEqual pivotDirect` across a shape corpus (multi-valueField, colors present/partial/empty, numeric key, missing value, string coercion, empty rows) + per-row key-set equality (proves conditional `color` spread, no `undefined` leak). Row-identity = deep-equal; intra-row key insertion order is NOT load-bearing (encoding addresses fields by name).
