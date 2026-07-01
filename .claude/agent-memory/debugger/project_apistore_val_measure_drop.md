---
name: apistore-val-measure-drop
description: Live value mis-binding class — ApiStore dropped the val measure pin and extractRequirements ignored query filter, collapsing per-measure KPIs and crossing approach-pinned panels
metadata:
  type: project
---

Two engine defects of the same class — a per-spec pin (measure / filter) that scopes correctly on the in-memory ExternalStore but is silently dropped on the async ApiStore — caused real value-correctness bugs on the live GDP page (all three `_Z` KPIs showed the same per-capita number; the Expenditure panel rendered Production's values).

**Bug A — val measure drop.** `storeVal` issues `{ type:'val', code }`. `ApiStore.toObsParams` never mapped `q.code` to the wire `filter`, so every val read returned ALL measures in the (time×dims) slice and `storeVal` took `rows[0]`. The in-memory `ExternalStore._val` honored the contract (match `obs['measure'] === code`); the async store did not. Fix: `toObsParams` pins `filter[MEASURE_DIM] = q.code` for `'val'` queries. Added `MEASURE_DIM = 'measure'` SSOT in `core/context.ts` (mirrors `TIME_DIM`).

**Bug B — query filter ignored by extractRequirements.** `extractRequirements('query')` built req dims from `ctx.dims` + time but NOT `spec.query.filter`. Two `query` specs differing only by a filter pin (approach PROD vs EXP) produced identical requirements → identical `specDimKey` (react `useNodeRows`) → the module-level `_promiseCache` returned the first panel's rows for the second. Fix: fold the query's non-time filter pins (resolved via `resolveFilterForReqs`, single-value only) into requirement dims.

**Why this class is dangerous:** the render probe only checks empty/errors (`obsEmpty`, console errors) — it passes while values are wrong. Caught only by reading screenshots. The wire-URL fanout in the probe `result.json` is the tell: a KPI val query missing `measure` in its filter, or two panels firing the identical filterless query, both signal a dropped pin.

**Why:** the architecture has TWO store implementations (sync in-memory + async Api) that must satisfy the SAME query contract; a contract honored by one but not the other is invisible until live. **How to apply:** when adding a StoreQuery discriminant or a per-spec scope field, verify BOTH stores thread it to the read, and that `extractRequirements`/`specDimKey` reflect every field that changes the resolved data (else cache identity collides). Guard: `platform/packages/core/src/data/kpi-value-binding.fitness.test.ts` proves pin EFFECT (not just existence) on an Api-like store.
