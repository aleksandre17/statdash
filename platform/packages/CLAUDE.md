# packages/ — Engine + React Layer Orientation

> ავტოლოადი packages/-ის ნებისმიერ ფაილზე მუშაობისას.
> **Layer orientation only** — field-level ✅/❌ patterns → `.claude/rules/data.md` (when in `packages/core/src/data/**`).

---

## Data Pipeline (the canonical flow)

```
defineFilters({ bars }) → FiltersResult { ctx: SectionContext, bars: FilterBarSpec[] }
        ↓
SectionContext { timeMode: 'year'|'range', dims: Record<string, DimVal> }
        ↓
DataSpec → interpretSpec(spec, ctx, store) → DataRow[]
        ↓                    ↓
   DataTable           interpretChart(def, rows, ctx) → ChartOutput → toApexOptions → <ReactApexChart />
```

**DataSpec types:** `query` · `row-list` · `timeseries` · `growth` · `ratio-list` · `pivot` · `transform` · `custom`

---

## FilterSchema API (the shape only)

```ts
defineFilters({
  bars: { barId: { position: 'sticky'|'float', order?: number, filters: { key: ParamDef } } },
  crossValidate?: CrossValidator[],
  computed?:      DeriveMap,
  context?:       { dims },
  store?:         DataStore,
})
// Returns: bars · typed values · ctx · errors · isLoading
// FlatFilters<B> = UnionToIntersection<B[keyof B]['filters']>
```

**ParamDef types:** `hidden` · `year-select` · `cascade` · `select` · `range` · `multi-select`

---

## Dependency Rule (the arrow)

```
packages/contracts ← packages/expr ← packages/core ← packages/charts ← packages/react ← packages/plugins ← apps/*
packages/contracts ← apps/api
```

- `packages/contracts` — zero-dep shared boundary types (innermost; importable by ALL, incl. `apps/api`).
- `packages/core` is the pure engine (`@statdash/engine`); `packages/react` is the React adapter.
- The dir layout is `packages/{contracts,expr,core,charts,styles,react,plugins}`; the npm scope is `@statdash/*`
  (de-tenanted from the old first-tenant scope — ADR platform-structure-rearchitecture, Phase 5).

Violation = instant red flag, enforced as a build gate by `eslint no-restricted-imports` (`platform/eslint.config.js`).
Full canonical definition (per-layer ❌/✅ · module augmentation pattern)
→ `.claude/individual/knowledge/principles.md` §Clean Architecture
