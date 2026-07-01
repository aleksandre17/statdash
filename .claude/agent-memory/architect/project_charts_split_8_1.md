---
name: charts-split-8-1
description: Phase 8.1 — splitting @geostat/charts out of @geostat/engine; the registry-cycle resolution pattern (two registries split by package)
metadata:
  type: project
---

Phase 8.1 splits chart interpretation into a new `@geostat/charts` package at `platform/engine/charts/`, sitting between `@geostat/react` and `@geostat/engine` in the arrow: `src → plugins → @geostat/react → @geostat/charts → @geostat/engine → @geostat/expr`.

**Why:** roadmap Layer 8.1 — "a table-only/headless consumer never bundles chart code." Engine-core must end with ZERO chart code.

**The core architectural decision (reusable):** the cycle risk is that `EngineRegistry` (in core) typed `ChartInterpreter` with `ChartDef`/`ChartOutput`. Moving chart types out while keeping the registry in core would cycle engine→charts→engine. **Resolution = TWO registries split by package**, not one shared one:
- `EngineRegistry` (core) becomes spec-only (`registerSpec`/`spec`/`specTypes`/`hasSpec`).
- New `ChartRegistry` + `chartRegistry` singleton lives in `@geostat/charts`, owns `registerChart`/`chart`/`chartTypes`/`hasChart`.
- Rejected: opaque-type chart methods in core (leaks concept); shared `Registry<K,V>` base (YAGNI until a 3rd registry — note as future Protected-Variations seam).

**Also:** the `setChartRegistry` lazy-injection shim in core gets DELETED — it only existed to dodge an intra-core import-order cycle; once charts is its own package, `interpretChart` references the local `chartRegistry` directly. `ChartType` (string alias) STAYS in core/context.ts (it's a primitive, not chart logic), re-exported from both engine and charts.

**How to apply:** when splitting any package in this monorepo, watch for a registry/factory in the lower layer that is generically-typed over an upper-layer type — that's the cycle seam. Split the registry by package rather than parameterizing it. And remember alias resolution is path-based: a new package = entries in ~6 alias maps (platform/tsconfig, both apps' tsconfig+vite, relevant vitest.configs), per [[project_geostat_alias_resolution]]. SemVer contract framing per [[project_panel_external_product]].
