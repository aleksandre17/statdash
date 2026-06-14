# Non-Negotiables

> ეს წესები არ განიხილება. ყოველი PR, ყოველი feature, ყოველი refactor ამას იცავს.

---

## Dimension Access

```ts
✅  ctx.dims['time'] as number
✅  ctx.dims['geo']  as string
❌  ctx.year
❌  ctx.regionId
❌  hardcoded dimension names anywhere
```

**Why:** dims are runtime values from filter params. Hardcoding breaks Phase 2 (Constructor changes dim keys).

---

## Data Declaration

```ts
✅  data: DataSpec                     // in config, JSON-serializable
❌  getRows: (ctx) => DataRow[]        // function in config — breaks JSON, breaks Constructor
❌  fetch() in renderer                // side effect in pure function
❌  async in renderer                  // NodeRenderer is sync — component wrapper pattern instead
```

---

## Logic Location

```ts
✅  if/switch in renderer function     // renderer is TypeScript code
❌  if/switch in config                // config is JSON — use ExprVal (op: 'if') instead
✅  visibleWhen: { op: 'eq', ... }    // declarative, JSON, Constructor-ready
❌  visibleWhen: (ctx) => boolean      // function — not JSON
```

---

## Type Definitions

```ts
✅  import { DataRow } from '@geostat/engine'
❌  interface Row { value: number; geo: string }   // local Row interface
```

**Why:** DataRow is the universal contract. Local interfaces fragment the type system.

---

## Filter Bar Declaration

```ts
✅  bars: FilterBarSpec[]              // from defineFilters()
❌  groups: ReactNode[]                // JSX in config
✅  defineFilters({ bars: { main: { filters: { ... } } } })
❌  <FilterBar><YearSelect /><GeoSelect /></FilterBar>
```

---

## ParamDef Type Names

```ts
✅  type: 'hidden'
❌  type: 'param'                      // old name — removed
```

---

## Config Purity

```ts
✅  JSON-serializable config           // strings, numbers, booleans, null, plain objects/arrays
❌  JSX in config                      // not JSON
❌  functions in config                // not JSON
❌  class instances in config          // not JSON (DataStore is injected, not in config)
```

---

## Database / SDMX

```ts
✅  SDMX codes in DB (P1, B1g, etc.)
❌  Georgian column names in DB        // breaks SDMX compatibility

✅  fromSDMX() at the boundary         // one adapter, one place
❌  DB format leaking into UI          // SDMX raw format should never reach renderers

✅  extra_dims JSONB                   // flexible dimension storage
❌  hardcoded dim columns per dataset  // breaks new datasets
```

---

## Deduplication / SNA

```ts
✅  isCarryForward: 0 filter           // standard SNA deduplication
❌  side: 'U' for SNA dedup           // non-standard, fragile
```

---

## Table / Column Footer

```ts
✅  ColumnDef.footer per-column        // different totals per column
❌  footer on homogeneous data only    // over-restricted — real data is heterogeneous
```

---

## Generic Algorithms

```ts
✅  groupBySpan<T>(items, getSpan)     // generic, reusable, not tied to any type
❌  algorithm tied to SectionDef       // breaks Open/Closed principle

✅  .filter(predicate) directly        // standard JS
❌  filterBy<T>(items, wrapper)        // unnecessary abstraction over filter()
```

---

## New Feature Workflow

```
1. Reference check  — "Eurostat/ONS/WorldBank ამ პრობლემას როგორ წყვეტს?"
2. Config design    — JSON object-ად ჯერ; renderer მოგვიანებით
3. Type definition  — discriminated union, full inference, no `any`
4. Renderer         — pure function; config → ReactNode; no side effects
5. Build verify     — npx tsc --noEmit → 0 errors
```

---

## Architecture Direction

> **ახალი არქიტექტურა = სტანდარტი.**
> კოდი ეგუება ახალ არქიტექტურას. არქიტექტურა კი არ ეგუება არსებულ კოდს.

ეს ნიშნავს:
- "ახლა ასეა კოდში" — არ არის argument ახლანდელი approach-ის შესახებ
- Migration plan-ი (Strangler Fig) — explicit step-by-step კოდის გადმოყვანა
- `tsc → 0 errors` migration-ის ყოველ ნაბიჯზე
