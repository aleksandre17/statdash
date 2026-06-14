# Computed · Derive · Effects — Architecture

> Three enrichment mechanisms. Different scopes. Different moments. Never mixed.
>
> "Request or expression" — every entry is one of:
>   `ExprVal`    — declare how to compute (pure logic, no external data)
>   `LookupSpec` — declare what to fetch + what to extract (DataSpec + field accessor)
>
> Both are JSON. Constructor stores both. Zero functions in config.

---

## Platform precedent

| Concern                           | Grafana                               | dbt                          | Observable                        | Retool                        |
|----------------------------------|---------------------------------------|------------------------------|-----------------------------------|-------------------------------|
| Filter-level computed             | Query variable (refs other variables) | Macro (pure SQL expression)  | Derived cell from input cells     | Transformer on state          |
| Render-level enrichment (data)    | Panel → separate Stat panel           | Ref (data request to model)  | Cell with data fetch              | Query result                  |
| Render-level enrichment (pure)    | Panel → field override expression     | Calculated column            | Derived cell (pure)               | Computed property             |
| Dependency resolution             | Variable order (explicit)             | DAG (topological)            | Auto-topological                  | Manual (query order)          |
| Cycle detection                   | Dashboard validation                  | dbt parse error              | Runtime error                     | None                          |
| Cross-filter reactive rules       | Variable chaining                     | —                            | —                                 | On-change event handlers      |

**Universal consensus:** filter state and rendering state are evaluated at different times, with different scopes. They are never mixed. Data requests and pure expressions are always two distinct primitives.

---

## The three mechanisms

```
FilterSchemaInput.computed   ExprVal[]         filter params only → ctx.dims
FilterSchemaInput.effects    Effect[]           filter params → mutate filter params
NodeBase.derive              DeriveEntry[]      dims + stores → ctx.derived
```

```
FILTER TIME  ─── useFilters() ──────────────────────────────────────────────────
  1. URL params + defaults → raw dims
  2. evalComputed(computed, dims) → computed values → merged into dims
  3. applyEffects(effects, dims)  → side effects applied → final dims
  → FiltersResult.ctx.dims contains: filter params + computed values

RENDER TIME  ─── engine.renderNode step 1 ──────────────────────────────────────
  evalDerived(node.derive, ctx)   → derived values → ctx.derived
  → Available to this node + all children via ctx.derived

DATA TIME    ─── engine.renderNode step 3 ──────────────────────────────────────
  interpretSpec(node.data, ctx)   → DataRow[] → ctx.rows
```

---

## FilterSchemaInput.computed — ExprVal only

Values derived **from filter params only**. Pure logic. No DataStore.

```ts
type ComputedEntry = {
  key:   string
  expr:  ExprVal   // scope: { $ctx: filterParam, $derived: earlierComputedKey }
  deps?: string[]  // optional explicit deps — auto-detected from expr if absent
}
type ComputedMap = ComputedEntry[]
```

**Evaluator:** `evalComputed(entries, filterParams)` inside `useFilters()`.
**Output:** flows into `ctx.dims` alongside filter params.

```ts
// Declare in any order — topological sort handles evaluation:
computed: [
  // References isRangeMode (declared below) — evaluator resolves order automatically:
  { key: 'activeLabel',
    expr: { op: 'if', cond: { $derived: 'isRangeMode' },
            then: { op: 'template', tmpl: '{fromYear}–{toYear}' },
            else: { op: 'template', tmpl: '{year}' } } },

  // isRangeMode has no deps — evaluated first (regardless of position):
  { key: 'isRangeMode',
    expr: { op: 'eq', left: { $ctx: 'mode' }, right: 'range' } },

  // _geoMode drives filter bar showWhen (single vs multi selection):
  { key: '_geoMode',
    expr: { op: 'contains', source: { $ctx: 'region' }, sub: ',', match: 'multi', fallback: 'single' } },
]
// Evaluation order (auto): isRangeMode → _geoMode → activeLabel ✅
```

**What `computed` is for:**
- Driving filter control `showWhen` conditions (`_geoMode`, `isRangeMode`)
- Constructing subtitle/label strings from filter state (`activeLabel`)
- Any boolean flag or formatted string derived from filter params only

**What `computed` is NOT for:**
- DataStore access → that's `derive`
- Mutating other params → that's `effects`
- Validation → that's `crossValidate`

---

## FilterSchemaInput.effects — reactive cross-filter rules

When filter param A reaches condition → set/clear filter param B.

```ts
interface Effect {
  when:  ExprVal                          // condition (scope: dims + computed)
  set:   Record<string, ExprVal | null>   // null = clear; ExprVal = set to computed value
}
```

**Evaluator:** `applyEffects(effects, dims)` inside `useFilters()`, AFTER `evalComputed`.
Effects' `when` and `set` have access to computed values (full `ctx.dims` scope).

```ts
effects: [
  // computed value used in when — evaluated after computed step:
  { when: { $derived: 'isRangeMode' },
    set:  { year: null, sector: '_T' } },

  { when: { op: 'not', expr: { $derived: 'isRangeMode' } },
    set:  { fromYear: null, toYear: null } },
]
```

**Single-pass rule (Grafana: same decision):**
Array order = evaluation order. One pass, no cascading re-evaluation. If Effect B reads a value set by Effect A, place A before B. Cascading re-evaluation → circular dependency risk.

**What `effects` is for:**
- Clearing incompatible params when mode changes
- Resetting dependent params when parent param changes

**What `effects` is NOT for:**
- DataStore queries (`set` values are ExprVal over dims, not data requests)
- Validation (`crossValidate` is the right mechanism)
- Dependencies between filter controls (`dependsOn` on ParamDef)

---

## NodeBase.derive — ExprVal + LookupSpec

Values derived from **ctx.dims + DataStore**. Two entry shapes.

```ts
type DeriveEntry =
  | { key: string; expr:   ExprVal;    deps?: string[] }  // pure expression
  | { key: string; lookup: LookupSpec; deps?: string[] }  // data request + extraction
```

**Evaluator:** `evalDerived(entries, ctx)` in engine `renderNode` step 1.
**Output:** flows into `ctx.derived`. Available to this node + all its children.

### ExprDeriveEntry — pure expression

Same ExprVal as `computed`, but full render scope:
- `{ $ctx: 'filterKey' }` — filter params + computed (full `ctx.dims`)
- `{ $derived: 'key' }` — any earlier derive entry (other computed or lookup result)

```ts
// References regionObj (a lookup entry below) — evaluator orders correctly:
{ key:  '_regionTitle',
  expr: { op: 'get', source: { $derived: 'regionObj' }, field: 'label', fallback: '' } }
```

### LookupDeriveEntry — data request + extraction

`LookupSpec` — four types, all JSON:

```ts
type LookupSpec =
  | { type: 'map';    data: DataSpec; by: ExprVal; idField?: string; field: string; fallback?: DimVal }
  | { type: 'tree';   data: DataSpec; by: ExprVal; idField?: string; field: string; fallback?: DimVal }
  | { type: 'first';  data: DataSpec;                                field: string; fallback?: DimVal }
  | { type: 'reduce'; data: DataSpec; op: 'count'|'sum'|'avg'|'min'|'max'; field?: string; fallback?: DimVal }
```

| Type | When to use |
|------|-------------|
| `'map'` | Flat key-value lookup: find row where `row[idField] === by`, return `row[field]` |
| `'tree'` | Hierarchical lookup: walk parent-child tree to find node matching `by`, return `row[field]` |
| `'first'` | Return first matching row's field — no ref matching needed (single-row query) |
| `'reduce'` | Aggregate over rows: count / sum / avg / min / max |

`map` and `tree` replace `DataLookupOp { op: 'map-field' | 'tree-field' }` — same semantics, cleaner naming.

```ts
derive: [
  // map — find geo record for selected region:
  { key: 'regionObj',
    lookup: { type: 'map', data: GEO_QUERY, by: { $ctx: 'region' }, idField: 'code', field: '*' } },

  // map — extract color from same dataset:
  { key: '_pageColor',
    lookup: { type: 'map', data: GEO_QUERY, by: { $ctx: 'region' }, idField: 'code', field: 'color', fallback: '#0080BE' } },

  // tree — hierarchical breadcrumb path:
  { key: '_pageCrumbs',
    lookup: { type: 'tree', data: GEO_QUERY, by: { $ctx: 'region' }, idField: 'code', field: 'crumbs', fallback: [] } },

  // first — latest GDP value for current dims:
  { key: 'latestGDP',
    lookup: { type: 'first', data: { type: 'timeseries', indicator: 'B1G', dims: { geo: { $ctx: 'geo' } } }, field: 'value', fallback: null } },

  // reduce — count of years in selected range:
  { key: '_rangeYearCount',
    lookup: { type: 'reduce', op: 'count', data: { type: 'query', storeId: 'time', indicator: 'TIME_LIST' }, fallback: 0 } },

  // ExprEntry — references lookup result (auto-ordered after regionObj):
  { key: '_regionTitle',
    expr: { op: 'get', source: { $derived: 'regionObj' }, field: 'label', fallback: '' } },
]
// Evaluation order: regionObj, _pageColor, _pageCrumbs, latestGDP, _rangeYearCount (parallel — no shared deps)
//                   _regionTitle (after regionObj)
```

---

## Topological sort — shared by both computed and derive

Same algorithm for both mechanisms. Entries can be declared in any order.

```
buildDependencyGraph(entries):
  1. For each entry: collect declared deps? OR scan expr/$derived refs automatically
  2. Kahn's BFS topological sort — O(V + E)
  3. Cycle → throw "[computed|derive] Circular dependency: A → B → A"
  4. Independent entries (no shared deps) remain in declaration order
```

**Parallel evaluation:** entries with no dependency relationship can fetch data in parallel.
In our sync + Suspense model: independent `LookupDeriveEntry` items fire `interpretSpec` in
declaration order; React's concurrent rendering retries them independently as data resolves.
No explicit parallelism mechanism needed — Suspense handles it.

**Cycle detection at render time:**
```ts
// This throws immediately when the page renders:
derive: [
  { key: 'a', expr: { op: 'not', expr: { $derived: 'b' } } },  // a → b
  { key: 'b', expr: { op: 'not', expr: { $derived: 'a' } } },  // b → a → cycle!
]
// Error: "[derive] Circular dependency: a → b"
// NodeErrorBoundary catches → shows clear error node. Page continues.
```

---

## Namespace separation — the invariant

```
ctx.dims     ← filter params + computed values (FilterSchemaInput)
               Reference: { $ctx: 'key' }
               Source: useFilters() → evalComputed() + raw params

ctx.derived  ← render-level derived values (NodeBase.derive)
               Reference: { $derived: 'key' }
               Source: engine evalDerived() at renderNode step 1

ctx.rows     ← data rows (NodeBase.data → interpretSpec)
               Reference: in shell as ctx.rows
               Source: interpretSpec(node.data, ctx) at renderNode step 3
```

`{ $ctx: 'key' }` and `{ $derived: 'key' }` are **always distinct namespaces**.
A filter param key never collides with a derived key in expr evaluation.

**`computed` flows into `ctx.dims`** — not `ctx.derived`.
`{ $ctx: 'isYearMode' }` references a computed value, NOT `{ $derived: 'isYearMode' }`.
This is intentional: computed values are part of the filter state, not the render state.

---

## Correct placement for old REGIONAL_FILTER_SCHEMA values

| Value          | Old placement           | Correct placement                          | Type      | Reason                                              |
|----------------|-------------------------|--------------------------------------------|-----------|-----------------------------------------------------|
| `_geoMode`     | `FilterBarNode.derive`  | `FilterSchemaInput.computed`               | ExprVal   | Drives filter `showWhen` — needed at filter time    |
| `isRangeMode`  | missing                 | `FilterSchemaInput.computed`               | ExprVal   | Drives `showWhen` + effects — needed at filter time |
| `regionObj`    | `FilterBarNode.derive`  | `InnerPageNode.derive` lookup `'map'`      | LookupSpec | Page-wide, requires DataStore                      |
| `_pageColor`   | `FilterBarNode.derive`  | `InnerPageNode.derive` lookup `'map'`      | LookupSpec | Page chrome — needs to reach AppChrome             |
| `_pageCrumbs`  | `FilterBarNode.derive`  | `InnerPageNode.derive` lookup `'tree'`     | LookupSpec | Navigation — needs to reach AppHeader              |
| `_regionTitle` | `FilterBarNode.derive`  | `InnerPageNode.derive` expr (refs regionObj) | ExprVal  | Depends on regionObj lookup — render time          |
| `effects`      | `FilterBarNode.effects` | `FilterSchemaInput.effects`                | Effect[]  | ✅ Was already correct — cross-filter reactive rules |

---

## Anti-patterns

```ts
// ❌ DataStore access in computed — no DataStore at filter time:
computed: [{ key: 'regionObj', lookup: { type: 'map', ... } }]   // lookup not valid in computed
// ✅ DataStore access → always in NodeBase.derive

// ❌ Computed value placed in derive — evaluated too late for showWhen:
derive: [{ key: '_geoMode', expr: { op: 'contains', ... } }]
// → filter bar showWhen reads _geoMode — but derive runs at render step 1, filter bar already built
// ✅ Values driving filter UI → FilterSchemaInput.computed

// ❌ Page-level derive on FilterBarNode (sibling problem):
{ type: 'filter-bar', derive: [{ key: '_pageColor', lookup: { type: 'map', ... } }] }
// → FilterBarNode is sibling of SectionNode. Derive flows to children, not siblings.
// ✅ InnerPageNode.derive — parent of all children

// ❌ effect.set referencing ctx.derived (not available at filter time):
{ effects: [{ when: ..., set: { x: { $derived: 'renderLevelValue' } } }] }
// ✅ effects.set scope = ctx.dims (filter params + computed) only

// ❌ Manual ordering as dependency management:
computed: [{ key: 'isYearMode', ... }, { key: 'label', expr: { ... isYearMode ref ... } }]
// "Works" but fragile — reordering breaks silently.
// ✅ Declare in any order. evalComputed() topologically sorts. Cycle → clear error.

// ❌ DataLookupOp (op: 'map-field' / 'tree-field') — old API:
derive: [{ key: 'x', op: 'map-field', data: ..., ref: ..., field: ... }]
// ✅ LookupSpec { type: 'map', data: ..., by: ..., field: ... } — explicit discriminated union
```

---

## Code reference

```
docs/architecture/examples/derive-effects.md
  — full type definitions: ComputedEntry, DeriveEntry, LookupSpec, Effect
  — buildDependencyGraph() — topological sort + cycle detection (Kahn's)
  — evalComputed() — filter-level evaluator
  — evalDerived()  — engine-level evaluator
  — applyEffects() — single-pass effect evaluator
  — regional + GDP usage examples
```