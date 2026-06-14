# Filter System

> defineFilters (pure schema) + useFilters (hook). Constructor Phase 2 ready.

---

## Two Functions — Two Concerns

```
defineFilters(schema)  →  FilterSchema    pure, no hooks, JSON-in, DB-storable
useFilters(schema)     →  FiltersResult   hook, reads URL state, live dims
```

---

## FilterBarNode.bars — config vs runtime: two different stages (K-6)

> **Grafana:** `PanelOptions` (config, saved in DB) vs `PanelData` (runtime, resolved by datasource).
> Same concept, different names, different types. Our `bars` field follows the same pattern.

```
Stage 1 — Config (NodeDef, stored in DB):
  FilterBarNode.bars: Record<string, BarDef>
  — keyed by barId: { position, order, filters: Record<string, ParamDef> }
  — JSON-serializable, written by Constructor
  — this is what engine.renderNode() receives as node.bars

Stage 2 — Runtime (after defineFilters + useFilters):
  FilterBarShellProps.bars: FilterBarSpec[]
  — resolved: values filled from URL, cascade options loaded, errors computed
  — Array (not Record) — ordered by BarDef.order for render
  — this is what FilterBarShell receives

Pipeline:
  FilterBarNode.bars (Record<string,BarDef>)
    → defineFilters() → FilterSchema
    → useFilters()    → FiltersResult.bars: FilterBarSpec[]
    → FilterBarShell  → filterBars.map(bar => filterControlRegistry.render(bar))
```

**Why the same field name:**
Both describe "the bars in this filter bar." Stage 1 is the config shape. Stage 2 is the resolved runtime shape. Shell always receives the resolved stage 2 shape — never the raw config.

**Rule:** Never pass `FilterBarNode.bars` (Record) directly to a shell. Always go through `defineFilters → useFilters` pipeline first.

**Naming convention:** `FilterBarShellProps.filterBars` (not `bars`) — runtime props must not shadow `def` field names where the type difference is not self-evident. `def.bars: Record<string,BarDef>` (config) vs `filterBars: FilterBarSpec[]` (runtime) are clearly distinct by name.

**Why split?**

Phase 2: Constructor stores `filterSchema` as JSON in DB.
```ts
// Phase 2:
const pageConfig = await loadPage(id)    // from DB
const schema     = defineFilters(pageConfig.filterSchema)   // JSON input ✅
const result     = useFilters(schema)                        // hook, URL sync ✅
```

`defineFilters` is a pure validation function — no React, no hooks, importable anywhere.
`useFilters` is a hook — called only in React components (SiteRenderer).

---

## defineFilters — pure schema builder (I-4 architectural fix)

> **PRINCIPLES.md non-negotiable:** `JSON-serializable config ✅`.
> `DataStore` is a runtime object — NOT JSON-serializable. Mixing it into `FilterSchemaInput` violated this rule.
> **Fix:** `FilterSchemaInput` = 100% JSON-serializable. Runtime deps passed separately to `useFilters`.

```ts
// FilterSchemaInput — 100% JSON-serializable (Constructor stores this in DB)
interface FilterSchemaInput {
  bars:           Record<string, BarDef>           // keyed bar definitions
  params?:        Record<string, ParamDef>         // page-level params: always tracked, never in UI
                                                   // Declared once — not duplicated across bars
                                                   // Grafana: variable hide:2. Retool: App State.
                                                   // Examples: measure, account, priceBase
  contracts?:     Record<string, DimContract>      // per-dim null semantics (default: 'required')
  effects?:       Effect[]                         // cross-filter side effects
  crossValidate?: CrossValidator[]                 // complex cross-dim validation rules
  computed?:      DeriveMap                        // pure ExprVal → evaluated by useFilters → filter dims
                                                   // ≠ NodeBase.derive (engine-level → ctx.derived)
  context?:       {
    timeMode?: 'year' | 'range'
    dims?:     Record<string, DimVal>              // default values
  }
  // store REMOVED — runtime object, not JSON. Cascade stores resolved by useFilters via useStores()
}

function defineFilters(input: FilterSchemaInput): FilterSchema
// Pure function — no runtime deps, no hooks, importable anywhere.
// Validates schema, computes initial ctx.dims from defaults, returns FilterSchema.
```

**Why store was wrong here:**
```ts
// ❌ Before — runtime object in JSON config:
defineFilters({ bars: { ... }, store: myDataStore })
//                              ↑ NOT JSON-serializable → Constructor can't store it

// ✅ After — pure JSON in, runtime in useFilters (hook context):
defineFilters({ bars: { ... } })              // pure, storeable in DB
// ↓
useFilters(schema)                            // hook — accesses stores via useStores() hook
//   cascade loading: interpretSpec(paramDef.options.data, ctx) via useStoreQuery
```

interface BarDef {
  position: 'sticky' | 'float'
  order?:   number
  filters:  Record<string, ParamDef>         // keyed filter definitions
}
```

---

## ParamDef — filter control types

> **Grafana pattern:** variable dependency is variable-level — not type-specific.
> `dependsOn` lives on `ParamDefBase` so ANY filter type can declare a parent.

```ts
// ParamDefBase — shared across all filter types
interface ParamDefBase {
  dependsOn?: string[]  // ALL listed keys must be non-null (AND logic).
                        // Any null key → ActiveFilter.waitingFor = [blocking keys].
                        // cascade: skips options query too. other types: disabled only.
                        // string[] always — consumer never needs to normalize.
}

type ParamDef =
  | (ParamDefBase & { type: 'hidden';       defaultValue:  DefaultSpec })
  | (ParamDefBase & { type: 'year-select';  defaultValue?: DefaultSpec; years?: YearsSource })
  | (ParamDefBase & { type: 'range';        defaultValue?: DefaultSpec })
  | (ParamDefBase & { type: 'select';       options: OptionsSource;     defaultValue?: DefaultSpec })
  | (ParamDefBase & { type: 'multi-select'; options: OptionsSource;     defaultValue?: DefaultSpec })
  | (ParamDefBase & { type: 'cascade';      options: OptionsSource;     defaultValue?: DefaultSpec })
```

**`OptionsSource`** — how select/cascade/multi-select get their items:

```ts
type OptionsSource =
  | { type: 'static';  items: SelectOption[] }
  //  hardcoded — same as old options: SelectOption[] (backward compat shape)

  | { type: 'inline';  items: DimRef | Record<string, unknown>[];
      valueField: string; labelField?: string; pipe?: TransformStep[] }
  //  from store classifiers/display: { $d: 'sector' } or { $cl: 'geo' }
  //  pipe: sort/filter transforms applied at resolve time

  | { type: 'query';   data: DataSpec;
      valueField: string; labelField?: string; pipe?: TransformStep[] }
  //  DataStore query → interpretSpec(data, ctx) → rows → options.
  //  DataSpec (NOT ObsQuery) — full interpretSpec pipeline.
  //  Cascade pattern: data.dims has { $ctx: 'parent' } refs.

  | { type: 'api' }   // async — component resolves independently
```

**`YearsSource`** — same discriminant, `field` instead of `valueField`/`labelField`:

```ts
type YearsSource =
  | { type: 'static';  items: number[] }
  | { type: 'inline';  items: DimRef | Record<string, unknown>[]; field: string; pipe?: TransformStep[] }
  | { type: 'query';   data: DataSpec; field: string; pipe?: TransformStep[] }
  | { type: 'api' }
```

**`DimRef`** — `$d` (display-augmented) or `$cl` (structural only):

```ts
type DimRef = { $d: string; view?: ClassifierView } | { $cl: string; view?: ClassifierView }
type ClassifierView = 'items' | 'leaves' | 'rollups' | 'byCode'
// 'items'   — rollups + leaves (default) → full selector
// 'leaves'  — atomic codes only          → terminal-only selector
// 'rollups' — aggregate codes only       → total/subtotal picker
// 'byCode'  — Record<code, entry>        → lookup dict in transforms/LookupSpec
```

**cascade vs select:** same type, different `options` shape + `dependsOn`:
```ts
// select — self-contained options, no parent dependency:
sector: { type: 'select',
          options: { type: 'inline', items: { $d: 'sector' },
                     pipe: [{ op: 'filter', where: { code: { neq: '_T' } } }],
                     valueField: 'code', labelField: 'label' } }

// cascade — options filtered by parent param, re-fetches when parent changes:
region: { type: 'cascade', dependsOn: ['country'],
          options: { type: 'query',
                     data: { type: 'query', storeId: 'geo', indicator: 'REGIONS',
                             dims: { country: { $ctx: 'country' } } },
                     valueField: 'code', labelField: 'label' },
          defaultValue: { from: 'options', pick: 'first' } }
```

> Full reference: `architecture/24-options-source.md`

---

## useFilters — hook

```ts
function useFilters(schema: FilterSchema): FiltersResult

interface FiltersResult {
  ctx:       SectionContext         // { timeMode, dims: Record<string, DimVal> }
  bars:      FilterBarSpec[]        // ready for FilterBarShell rendering
  isLoading: boolean                // cascade options loading
  errors:    Record<string, string> // cross-validation errors (UI display only)
  // isDataBlocked intentionally absent — page-level flag is wrong granularity.
  // Each node evaluates its own contract: interpretSpec(node.data, ctx) → InterpretResult.
  // SectionA blocked on geo=null does not affect SectionB's time-only query.
  // Grafana equivalent: per-panel variable check, not per-dashboard.
}

interface SectionContext {
  timeMode: 'year' | 'range'
  dims:     Record<string, DimVal>  // all filter values — passed to ctx.dims
}
```

---

## DimContract — required vs wildcard vs empty

> Grafana pattern: each variable has an explicit contract. null is never ambiguous.

```ts
// 'required' (default) — user must select before data loads:
contracts: { 'geo': 'required' }
// dims.geo = null → interpretSpec → InterpretResult { status: 'blocked', dim: 'geo' } → EmptyState

// 'wildcard' — null = all values (ONS aggregate default):
contracts: { 'time': 'wildcard' }
// dims.time = null → filter clause skipped → all years in result

// 'empty' — null = no data (dependent selector without parent):
contracts: { 'sub-indicator': 'empty' }
// dims['sub-indicator'] = null → interpretSpec returns [] immediately
```

**contracts vs crossValidate — complementary roles:**

```
contracts:     per-dim, simple, covers 90% of cases, Constructor checkbox UI
crossValidate: cross-dim, complex, Expr-based ("from ≤ to", "at least one selected")
```

Never use `crossValidate` as a substitute for `contracts: { key: 'required' }`.
`crossValidate` errors are UI feedback only — they do not block data loading.
`contracts: 'required'` → `InterpretResult { status: 'blocked' }` — engine enforces at data layer.

---

## Full Usage Example

```ts
// src/features/gdp/gdp.config.ts
// (can also be stored as plain JSON in DB — Phase 2)
export const gdpFilterSchema = defineFilters({
  bars: {
    main: {
      position: 'sticky',
      order: 1,
      filters: {
        time: { type: 'year-select', defaultValue: 2023 },
        geo:  { type: 'cascade',
                options: { type: 'query', data: { type: 'query', storeId: 'geo-store', indicator: 'GEO_LIST' },
                           valueField: 'code', labelField: 'label' } },
        mode: { type: 'hidden', defaultValue: 'year' },
      }
    }
  },
  effects: [
    { when: { op: 'eq', left: { $ctx: 'mode' }, right: 'range' },
      set:  { time: null } }   // clear year when switching to range
  ],
  crossValidate: [
    { expr: { op: 'exists', value: { $ctx: 'geo' } },
      message: 'გთხოვთ აირჩიოთ რეგიონი' }
  ],
  computed: [
    { key: 'isYearMode',
      expr: { op: 'eq', left: { $ctx: 'mode' }, right: 'year' } }
  ],
}) // → FilterSchema (pure, no hooks, DB-serializable)

// In SiteRenderer (hook context):
const filtersResult = useFilters(gdpFilterSchema)
// → { ctx: { dims: { time: 2023, geo: 'ka', mode: 'year' }, timeMode: 'year' },
//     bars: FilterBarSpec[], isLoading: false, errors: {} }

// ctx.dims → baseCtx.dims → DataSpec.$ctx references resolve against this
```

---

## Phase 2 — Constructor Compatibility

```ts
// Constructor DB row (nav table):
// { page_id: 'gdp', filter_schema: '{ "bars": { "main": { ... } } }' }

// Phase 2 runtime (zero code change):
const pageConfig = await loadPage('gdp')              // from API
const schema     = defineFilters(pageConfig.filterSchema)  // JSON.parse already done
const result     = useFilters(schema)                  // hook, URL sync

// defineFilters accepts plain JSON object — no functions, no JSX.
// Constructor builds filter_schema JSON through GUI → same runtime behavior.
```

**Three levels always separate:**
```
DB JSON       → defineFilters() → FilterSchema    (pure, typed, validated)
FilterSchema  → useFilters()    → FiltersResult   (hook — reads URL state)
FiltersResult → baseCtx.dims   → renderers        (every renderer via ctx.dims)
```

---

## URL State — permalink ready (G-6)

> **Grafana `variableAdapters` pattern:** each filter type bundles its URL codec with its component.
> One registry → component + serialization always in sync. No drift, no separate codec map.

### Architecture: codec lives in filterControlRegistry.register()

```ts
// FilterControlRegistry — open registry (Grafana variableAdapters pattern).
// One registration = component + URL codec in sync. Drift structurally impossible.
// declare const filterControlRegistry: FilterControlRegistry  (@geostat/react)

// src/app/setupEngine.ts — one call per type:
filterControlRegistry.register('year-select', YearSelectControl, {
  encode: (v)   => String(v),                           // number → '2023'
  decode: (raw) => Number(raw),                         // '2023' → 2023
})
filterControlRegistry.register('multi-select', MultiSelectControl, {
  encode: (v)   => (v as string[]).join(','),            // ['GE','GE-TB'] → 'GE,GE-TB'
  decode: (raw) => raw.split(',').filter(Boolean),       // 'GE,GE-TB' → ['GE','GE-TB']
})
filterControlRegistry.register('cascade', CascadeControl, {
  encode: (v)   => String(v ?? ''),
  decode: (raw) => raw || null,
})
// New type: register once → component + codec always in sync. Zero existing code changes.
```

### useFilters — bi-directional URL sync

```ts
// useFilters internals — reads URL on mount, writes URL on change
function useFilters(schema: FilterSchema): FiltersResult {
  const [searchParams, setSearchParams] = useSearchParams()

  // READ — URL → filter value for each param key
  function readParam(key: string, def: ParamDef): DimVal | DimVal[] {
    const raw = searchParams.get(key)
    if (raw == null) return getDefaultValue(def)          // schema default on first load
    return getFilterCodec(def.type).decode(raw)           // registry lookup — no switch/if
  }

  // WRITE — filter change → URL immediately (no save button, no debounce)
  //  setMany batches multiple keys → one history entry (no double push)
  function setMany(updates: Record<string, DimVal | DimVal[]>): void {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      for (const [key, val] of Object.entries(updates)) {
        if (val == null) {
          next.delete(key)
        } else {
          const def = schema.allParams[key]               // schema knows the type
          next.set(key, getFilterCodec(def.type).encode(val))
        }
      }
      return next
    }, { replace: false })                                // push → back button works
  }
  // ...
}
```

### URL format — examples

```
/gdp?time=2023&geo=GE&mode=year
     ↑          ↑       ↑
     year-select cascade hidden  ← all params in URL including hidden

/regional?timeFrom=2019&timeTo=2023&geo=GE-TB
          ↑ range → two params

/accounts?sectors=P1,P3,D1
          ↑ multi-select → comma-separated
```

### Rules

```
hidden filters     → ARE in URL (permalink must restore full state, hidden affects data)
localStorage       → NEVER used (URL is the single source of truth, SSR-compatible)
browser back/fwd   → works (replace: false — each change = one history entry)
default values     → omitted from URL until user changes them (clean initial URL)
```

---

## FlatFilters — type inference

```ts
// Full type inference from bar definition:
type FlatFilters<B extends Record<string, BarDef>> =
  UnionToIntersection<B[keyof B]['filters']>

// Usage:
const schema = defineFilters({ bars: { main: { filters: {
  time: { type: 'year-select' },
  geo:  { type: 'cascade', ... },
} as const }}})

type Filters = FlatFilters<typeof schema.bars>
// → { time: number; geo: string }
// TypeScript knows the types without casting
```

---

## FilterBarSpec — rendering contract

```ts
// defineFilters + useFilters produce FilterBarSpec[]
// FilterBarShell reads this for rendering

interface FilterBarSpec {
  barId:    string
  position: 'sticky' | 'float'
  order:    number
  filters:  ActiveFilter[]     // resolved values + control definitions
  errors:   string[]           // cross-validation errors for this bar
}
```

---

## Filter dependencies — `dependsOn` (type-agnostic)

> **Grafana pattern:** variable dependency is variable-level, not type-specific.
> `dependsOn` lives on `ParamDefBase` — any filter type can declare a parent.
> `ActiveFilter.waitingFor` is already on the shared base — display layer was ready.

### States per filter control

```
waitingFor.length > 0  → some deps null (AND logic)              → disabled, "select X და Y first"
isLoading=true         → cascade optionsQuery in-flight          → spinner  (cascade only)
(neither)              → ready                                   → interactive
```

`waitingFor: string[]` — all currently-null keys from `dependsOn`.
`isLoading` applies only to `cascade` (only type with async options loading).

### `dependsOn` — usage across types

```ts
// cascade — single parent blocks options query AND interaction:
{ type: 'cascade',
  options:   { type: 'query', data: { type: 'query', dims: { geo: { $ctx: 'geo' } } },
               valueField: 'code', labelField: 'label' },
  dependsOn: ['geo'],          // geo null → waitingFor=['geo'], skip query
  defaultValue: 'B1G'
}

// cascade — multiple parents, ALL must be set (AND logic):
{ type: 'cascade',
  options:   { type: 'query',
               data: { type: 'query', dims: { geo: { $ctx: 'geo' }, sector: { $ctx: 'sector' } } },
               valueField: 'code', labelField: 'label' },
  dependsOn: ['geo', 'sector'],  // either null → waitingFor=[...null keys], skip query
}

// year-select — parent blocks interaction only (no query to skip):
{ type: 'year-select',
  dependsOn:    ['geo'],          // geo null → waitingFor=['geo'], year-select disabled
  defaultValue: 2023
}

// useFilters evaluates dependsOn for every ParamDef type:
// null keys in dependsOn → ActiveFilter.waitingFor = [those keys], isLoading = false
// all non-null → proceed (cascade: issue query; others: render)
```

## Cascade — options loading wiring (I-5)

> **ParamDef.cascade:** options are not static — they come from a DataStore query.
> `useFilters` (hook) resolves cascade options via `useStoreQuery`.
> Per-filter loading state flows into `ActiveFilter` — shell uses it directly.

### `useFilters` internals — per-filter loading

```ts
function useFilters(schema: FilterSchema): FiltersResult {
  const stores = useStores()
  const dims   = useFilterContext().state

  // For each param with dependsOn:
  // 1. Check all keys in dependsOn[] — collect null ones → waitingFor
  // 2. If waitingFor.length > 0 → skip query (cascade), set ActiveFilter.waitingFor
  // 3. cascade only: issue useStoreQuery → per-cascade { data, isLoading }
  // 4. Set ActiveFilter.isLoading from per-cascade result
  const cascadeResults = useCascadeOptions(schema, stores, dims)

  // FiltersResult.isLoading = convenience aggregate for FilterBar header spinner
  const isLoading = cascadeResults.some(r => r.isLoading)
}
```

**Why useStoreQuery, not interpretSpec directly?**
```
interpretSpec — sync, throws Promise on cache miss (Suspense side channel)
useStoreQuery — hook, manages loading state reactively (isLoading boolean)

Cascade options need per-control loading state (spinner in dropdown while loading).
interpretSpec Suspense would block the entire FilterBar — wrong UX.
useStoreQuery gives independent per-cascade loading state. Year select stays interactive.
```

### CascadeControl — reads ActiveFilter state directly

```tsx
// CascadeControl — uses filter.isLoading and filter.waitingFor from ActiveFilter:
function CascadeControl({ filter, currentValue, onCommit }: FilterControlProps) {
  const paramDef = filter.paramDef as Extract<ParamDef, { type: 'cascade' }>

  // waitingFor: one or more parents not yet selected — disabled state
  if (filter.waitingFor?.length) {
    const keys = filter.waitingFor.join(' და ')
    return <Select disabled placeholder={`ჯერ "${keys}" აირჩიეთ`} />
  }

  // isLoading: options query in-flight — show spinner
  if (filter.isLoading) {
    return <Select isLoading disabled placeholder="იტვირთება..." />
  }

  // ready — options resolved, interactive
  const options = (paramDef.resolvedOptions ?? []).map(row => ({
    value: String(row[paramDef.valueField ?? 'code']),
    label: String(row[paramDef.labelField ?? 'label']),
  }))

  return (
    <CascadeSelect value={currentValue as string} options={options} onChange={onCommit} />
  )
}
```

---

## Effects — declarative cross-filter logic

```ts
// When mode switches to 'range', clear year:
effects: [
  {
    when: { op: 'eq', left: { $ctx: 'mode' }, right: 'range' },
    set:  { time: null }
  }
]
// Retool pattern — JSON, declarative, Constructor-generatable
```

---

## `params` field — page-level hidden state

> Grafana: variable `hide: 2` — URL-tracked, no UI. Retool: App State component. Same concept everywhere.

`FilterSchemaInput.params` = params that belong to the page, not to any specific bar.
Declared once. Never duplicated. Always in `ctx.dims`. Never rendered in filter UI.

```ts
defineFilters({
  params: {
    priceBase:    { type: 'hidden', defaultValue: { $ctx: 'year' } },     // Tier 2: tracks year
    dataRevision: { type: 'hidden', defaultValue: 'preliminary' },        // Tier 1: static
    compareYear:  { type: 'hidden',
                    defaultValue: { op: 'subtract', left: { $ctx: 'year' }, right: 1 } },
  },
  bars: { ... },
})
```

**Valid hidden param:** URL-tracked + no UI + used in a DataSpec `dims` or `computed` expression.
**Invalid hidden param:** anything else — see decision table below.

---

## Hidden param decision table — what replaces what

When you see `{ type: 'hidden', key: 'X' }`, ask:

| What X does | Old pattern | Correct pattern |
|-------------|-------------|-----------------|
| Tracks which bar/tab is active (`mode: 'year'\|'range'`) | hidden in every bar | **ModeBarNode** — active tab state, not a URL param |
| Same param duplicated across N bars | hidden in each bar | `params.X` — declared once at schema root |
| UI param that's hidden in one mode only | hidden in inactive bar | lives in its own bar's `filters`; ModeBarNode hides the whole bar |
| Value used in data query, user doesn't control | hidden in one bar | `params.X` — page-level |
| Value that's always the same constant | hidden with fixed default | **constant in DataSpec** — no URL param needed |
| Value set by an effect, user never sees it | hidden anywhere | investigate: if used in query → `params`; if not → delete |

---

## Accounts page — concrete analysis (2026-05-09 decision)

Old `accounts.filters.ts` has these hidden params — each needs a different fix:

**`mode: 'year'`** — duplicated in both bars.
Drives `showWhen: { mode: { neq: 'range' } }`. This is ModeBarNode's job.
→ **eliminate entirely**. ModeBarNode controls bar visibility. No URL param needed.

**`account: ''`** in range-bar — copies year-bar's interactive select as hidden.
Reason: old system had no `params` field; had to register param in every bar.
→ **eliminate from range-bar**. `account` lives in `bars['year-bar'].filters` only.
ModeBarNode hides year-bar in range mode → account is automatically absent.

**`measure: ''`** — duplicated in both bars, always `''`, reset by effects.
→ **investigate before implementing**: grep DataSpec configs for `{ $ctx: 'measure' }`.
If found → `params: { measure: { type: 'hidden', defaultValue: '' } }`.
If not found → **delete**. It's dead code.

**Accounts target schema (new API):**

```ts
defineFilters({
  // params: {} — likely empty (measure is probably dead code)
  bars: {
    'year-bar': {
      position: 'sticky',
      filters: {
        account:  { type: 'select',
                    options: { type: 'inline', items: { $d: 'account' },
                               pipe: [{ op: 'sort', by: 'order', dir: 'asc' }],
                               valueField: 'code', labelField: 'label' },
                    defaultValue: '' },
        year:     { type: 'year-select', defaultValue: ACC_LAST },
      },
    },
    'range-bar': {
      position: 'sticky',
      filters: {
        fromYear: { type: 'year-select', defaultValue: ACC_FIRST },
        toYear:   { type: 'year-select', defaultValue: ACC_LAST  },
      },
    },
  },
  effects: [
    // account resets when switching to range (ModeBarNode switches bars, effects handle data state)
    { when: { $derived: 'isRangeMode' }, set: { account: null } },
  ],
  computed: [
    { key: 'isRangeMode', expr: { op: 'eq', left: { $ctx: '_activeMode' }, right: 'range' } },
  ],
  // mode → ModeBarNode._activeMode (injected into ctx.dims by ModeBarNode, not a user param)
})
```

---

## Reference — Industry Standards

**OECD.Stat** — "Customise" panel: complex filter UI at scale; column picker + filter builder — ჩვენი `defineFilters`-ის direct inspiration  
**Eurostat dataset explorer** — filter by country/time/indicator, all equal hierarchy — ჩვენი FilterBar pattern  
**ONS** — URL permalink = shareable exact data view — ჩვენი URL-as-state სტრატეგია  
**World Bank Open Data** — filter state in URL, browser back/forward works — validated same approach

---

## Implementation Status

| | სტატუსი |
|---|---|
| FilterSchema v2 (effects, validate, select) | ✅ done |
| GDP filters (mode + year) | ✅ done |
| Accounts filters (mode + year + cascade) | ✅ done |
| Regional filters (mode + year + region) | ✅ done |
| Constructor → generates ParamDef JSON | ⏳ phase 2 |
