---
name: wire-measure-pin
description: measurePin() in store-filter.ts is the ONE helper pinning a query's MEASURE_DIM into the obs/val wire filter; val+obs unified so the AR-38 obs-arm measure-drop cannot recur
metadata:
  type: reference
---

`buildObsFilterParam` (platform/packages/core/src/data/store-filter.ts) builds the observations wire `filter` JSON. A private `measurePin(measure: string | readonly string[])` helper is the SSOT expressing "which MEASURE_DIM code(s) this query scopes to" in wire shape: single concrete → scalar, OR-set → array (route reads `= ANY`), `'*'` wildcard / empty → `undefined` (no pin = all measures; the metric-swap pattern supplies the real scope via `q.filter[MEASURE_DIM]:{$ctx}` downstream). BOTH branches pin through it: `val` from `q.code`, `obs` from top-level `q.measure`. Pin lands BEFORE the q.filter loop so an explicit `q.filter[MEASURE_DIM]` overrides.

**Why it exists (root fix, card 0104):** the obs branch historically folded ONLY `q.filter` and never pinned top-level `q.measure` — the metric-ref path (`resolveQueryMeasures` → `queryReadObs`) keeps the measure TOP-LEVEL, not in filter. Result: obs fetch/cache key went out measure-LESS → ApiStore read the covering `{geo,approach}` slice (ALL measures) → chart collapsed each time coordinate to a last-wins measure (GDP charts 1/2 rendered a foreign real-growth series). This was the obs arm of [[reference_measure_ref_seam]]'s query-vs-val asymmetry. ExternalStore was never affected (`_observe` matches measure client-side via `measures.includes`); the defect was ApiStore-only.

**The single choke point:** `buildObsFilterParam` is the ONLY obs WIRE-key builder (used solely by store-api.ts `toObsParams`; `cacheKeyFor` derives from it). `CachedStore.obsCacheKey` already includes `q.measure`. Every obs read (browse/pipeline-resolver, relative-coord, metric-natural/grain, warm via `queryReadObs`) funnels through `storeObs` → this choke point, so fixing it here closes the whole class.

**Gates:** FF-OBS-MEASURE-PIN (top-level obs measure → scalar/array/wildcard-skip/explicit-override, driven through `queryReadObs`) + FF-QUERY-RENDER-TRUTH (sibling ApiStore obs reads, same dims / diff measure ⇒ distinct wire filter + distinct series; measure-aware server double makes a measure-less regression RED). Both in store-filter.fitness.test.ts. The prior false-green: warm-key ≡ read-key (both from this helper) asserted CONSISTENCY not TRUTH — no fitness had asserted two sibling measures render DISTINCT until FF-QUERY-RENDER-TRUTH.

**How to apply:** any "which measure does a store query fetch" question routes through `measurePin`; never re-pin MEASURE_DIM ad hoc in a branch. If asked to restore mis-bound charts via config, the config is NOT the defect — point here.
