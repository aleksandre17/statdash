# packages/ — Engine + React Layer Orientation

> ავტოლოადი packages/-ის ნებისმიერ ფაილზე მუშაობისას.
> **Layer orientation only** — field-level ✅/❌ patterns → `.claude/rules/data.md` (when in `packages/engine/src/data/**`).

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

**DataSpec types:** `query` · `row-list` · `timeseries` · `growth` · `ratio-list` · `pivot` · `by-mode` · `custom`

---

## FilterSchema API (the shape only)

```ts
defineFilters({
  bars: { barId: { position: 'sticky'|'float', order?: number, filters: { key: ParamDef } } },
  effects?:       Effect[],
  crossValidate?: CrossValidator[],
  computed?:      DeriveMap,
  context?:       { timeMode, dims },
  store?:         DataStore,
})
// Returns: bars · typed values · ctx · errors · isLoading
// FlatFilters<B> = UnionToIntersection<B[keyof B]['filters']>
```

**ParamDef types:** `hidden` · `year-select` · `cascade` · `select` · `range` · `multi-select`

---

## Dependency Rule (the arrow)

```
packages/engine  ← packages/react  ← plugins  ← src
```

Violation = instant red flag. Full canonical definition (per-layer ❌/✅ · module augmentation pattern)
→ `.claude/individual/knowledge/principles.md` §Clean Architecture
