---
name: time-dimension-seam
description: timeDimension first-class time concept (ADR R5); core/time-dimension.ts is the fold SSOT; fromDim/toDim fold byte-identically via ctx-ref bounds; YearsSpec kept-and-coexists
metadata:
  type: reference
---

# timeDimension — first-class time concept [ADR R5]

`TimeDimensionSpec { dim; range?: YearsSpec | [TimeBound,TimeBound]; granularity? }` added ADDITIVELY (optional) to query/timeseries/growth in `config/data-spec.ts`. Cube.dev `timeDimensions` parity. `dim` is the GENERIC time key (Law 1) — set to `TIME_DIM`, resolved via that SSOT, never hardcoded `'time'`.

**SSOT seam:** `core/time-dimension.ts` — `resolveTimeDimension` / `effectiveBounds` / `effectiveYears` / `clampYears` / `clampToBounds`. Folds `timeDimension` into the legacy-shaped `(years, from, to)` inputs the resolvers already consumed → ONE resolution path, no behaviour fork. (Lives in its own module, NOT resolvers.ts, because the bloat hook caps resolvers.ts at 400 lines.)

**Fold verdict:**
- `fromDim`/`toDim` (the ADR smell) → FOLDED byte-identically via `range: [{$ctx:'from'},{$ctx:'to'}]` (ctx-ref bounds reproduce the `Number(ctx.dims[...] ?? d)` clamp). Legacy fields KEPT + WIN on overlap (Postel).
- `YearsSpec` (`years`) → KEPT + coexists; `years` stays REQUIRED on timeseries/growth (removing it breaks validation/pipeline.ts + every config). `effectiveYears`: legacy `years` wins; `timeDimension.range` supplies years only when `years` absent.
- time-in-`filter` (query requirement extraction) → untouched, orthogonal.

**Disambiguation:** 2-literal tuple `[2022,2023]` = YearsSpec (selects those years). `[from,to]` CLAMP form reserved for ctx-ref bounds (`isYearsSpec` = all-numbers ⇒ YearsSpec). Granularity = carried-but-inert metadata (LOD door).

**FF-TIMEDIMENSION:** `core/time-dimension.fitness.test.ts` (12 tests) — legacy vs equiv timeDimension row-identical + Law-1 source-scan guard (no quoted 'time' in the module, comments stripped). Schema emitter does NOT deep-expand DataSpec time fields (same as fromDim/toDim pre-R5 — not a regression).
