---
name: grain-store-port
description: valAt point-read port primitive + internal point-series lowering primitive + generic grain model (DESIGN-grain-store-port G0-G2 landed; G3 escalated)
metadata:
  type: reference
---

# grain / store-port frontier (DESIGN-grain-store-port.md)

The declarative **coordinate-addressed point read** that makes the implicit `_val`
grain-sum explicit + generic (Law 1) + declarative (Law 2). Design at
`platform/work/DESIGN-grain-store-port.md`. Phases G0-G2 LANDED, G3 escalated.

## What landed (all packages/core only)
- **G0 — `valAt` port primitive.** New `StoreQuery` discriminant `valAt {code, at?, grain?, rollup?}` in `data/store.ts`. `at` = GENERIC coordinate override of `ctx.dims` (no ctx clone). `GrainLevel = string` + `RollupOp` types added. **`storeValAt()` helper is the resolver-facing seam** — its default (rollup sum + no grain) routes through the EXISTING `val` query at the merged coordinate, so async ApiStore (warms `val`/`obs` only) stays byte-identical and never sees `valAt`. Reducer = `rollupValues()` in NEW `data/grain.ts` (the grain concern's own module; G4 grows it). `ExternalStore._val` refactored to share `_matchedValues()` loop; `_valAt` added. CachedStore default-`valAt` → `_val(merged)` (shares valCache slot, byte-identical to atTime read). FF-VALAT-COORD-IDENTICAL + FF-GRAIN-GENERIC in `data/store-valAt.fitness.test.ts`.
- **G1 — `point-series` INTERNAL lowering primitive.** `PointSeriesSpec` + `ResolvableSpec = DataSpec | PointSeriesSpec` in `config/data-spec.ts`. Resolver in NEW `registry/point-series-resolver.ts` (enumerate `over` coords → fan out storeValAt → emit `{id,label,value,pct}` → pipe). Registry widened: `SpecResolver<T extends ResolvableSpec>` (was DataSpec). `resolveCode` extracted to NEW `registry/spec-helpers.ts` (shared, no cycle).
- **G2 — desugar `timeseries` → `point-series`.** `desugar()` return type widened to `ResolvableSpec`; `TimeseriesResolver` is now a thin delegate (mirrors `PivotResolver`). `extractRequirements` switches on `lowered` (the desugared spec) with a `point-series` case warming the SAME per-coord val reads. FF-DESUGAR-EQUIV timeseries corpus (8 shapes incl 'all'/clamp/timeDimension) in `data/desugar.fitness.test.ts`.

## CRITICAL design decision (one-way door, do not re-litigate)
**point-series is NOT a public `DataSpec` discriminant.** It is internal (like `joinByField` is the internal underside of `blend`). Reason: a public discriminant would force the panel `coverage.fitness.test.ts` (iterates `DATASPEC_DISCRIMINANTS`, requires an editor/allowlist) + `discriminant-manifest.ts` Exact assertion + SPEC_CATALOG — all out of the core-only scope. Constructor manifest sources `specTypes` from `SPEC_CATALOG` (NOT the registry), and both core/panel coverage gates iterate the TYPE-derived `DATASPEC_DISCRIMINANTS`, so an internal registered resolver leaks nowhere. Authors use timeseries/growth; point-series is the lowering target only.

## G3 ESCALATED (not byte-identically lowerable in-scope)
- **growth single-code**: blocked by no declarative "drop first row of ordered partition" op — `window` omits the FIELD not the ROW; `derive` field-of-missing returns 0 (indistinguishable from real prev=0, see `transform/derive.ts:29`); `filter` has no presence predicate. A new transform op would hit the panel coverage gate (out of scope).
- **growth multi-code**: needs `point-series code: string[]` + a measure-meta join (label/accountColor/color from storeObs) — a point-series extension.
- **ratio-list**: NOT unblocked by valAt at all — its reads are at the CURRENT ctx (no coordinate addressing); it's a pairwise num/den "point-table" shape, a different primitive. Design mis-grouped it.
GrowthResolver + RatioListResolver left BESPOKE/unchanged (green).
