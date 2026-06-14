# @geostat/engine — Data Pipeline

> Pure TypeScript. Zero React. Zero app content.
> interpretSpec · evalDerived (with DataLookupOp) · fromSDMX · engine.renderNode

---

## Package Location

```
engine/core/
  src/
    sdmx/
      types.ts              — Observation · DsdDimension · SdmxJson raw types
      fromSDMX.ts           — fromSDMX(raw): Observation[]  ← ONLY format boundary

    core/
      types.ts              — DataRow · DimVal · ObsQuery
                              DeriveEntry = ExprVal | DataLookupOp
                              DataLookupOp: { op, data:DataSpec, ref:ExprVal, field, fallback? }
      interpretSpec.ts      — interpretSpec(spec, ctx, stores): DataRow[]
      evalNodeDerive.ts     — evalNodeDerive(map: NodeDeriveMap, ctx): Record<string, DimVal>
                              Naming: NodeDeriveMap → evalNodeDerive (mirrors DeriveMap → evalDerived)
                              Pure — returns new record, never mutates ctx.
                              DataLookupOp → interpretSpec + field lookup
                              ExprVal      → evalDerived (@geostat/expr)

    data/
      store.ts              — interface DataStore { query(q: ObsQuery): DataRow[] }  ← SYNC
      specs.ts              — DataSpec union (all 9 types incl. type:'url')
      stores/
        StaticDataStore.ts  — in-memory filter, sync, zero network  (dev / tests)
        HttpDataStore.ts    — built-in 'http' store
                              Handles type:'url' DataSpec + href on any DataSpec
                              TRANSFORM_MAP: open Record<string, fn> — any project registers its own keys
                              Default entries: 'fromSDMX' + 'raw' (identity)
                              Loading:  throws Promise  → React Suspense catches → shows skeleton
                              Error:    throws Error    → React NodeErrorBoundary catches → shows error node
                              Registered at startup: engine.registerBuiltinStore('http', new HttpDataStore())

    field/
      groupBySpan.ts        — groupBySpan<T>(items, getSpan): T[][]  (generic)
      formatValue.ts        — formatValue(v, fmt): string

    chart/
      interpretChart.ts     — interpretChart(def, rows, ctx): ChartOutput
      toApexOptions.ts      — toApexOptions(output): ApexCharts.ApexOptions

    registry/
      engine.ts             — engine: { renderNode(node, ctx), extend(nodeRegistry) }

  index.ts
```

---

## Public API

```ts
export { fromSDMX }        // SDMX-JSON wire → Observation[]  (production boundary)
export { fromRawSQL }      // raw SQL rows → Observation[]     (dev / static store)
export { interpretSpec }
export { groupBySpan, formatValue }
export { interpretChart, toApexOptions }
export { engine }
// engine methods:
//   engine.extend(nodeRegistry)                          — register node renderers
//   engine.extendSpec(type, resolver)                    — register custom DataSpec types
//   engine.registerTransform(name, fn)                   — register TRANSFORM_MAP entry
//   engine.listTransforms(): string[]                    — Constructor: transform dropdown keys
//   engine.registerBuiltinStore(id, store)               — register built-in DataStore
export type { DataRow, DimVal, Observation, DataSpec, DataSpecBase, ObsQuery, DataStore }
export type { ChartOutput }
export type { DeriveEntry, DataLookupOp, NodeDeriveMap }

// Classifier subsystem (architecture/18-classifier-pipe.md):
export type { Classifier, ClassifierEntry, ClassifierRef, ClassifierView }
export type { DisplayMap, DisplayRef, DimRef, DataBundle }
export { codelistOf, itemsOf, leavesOf, rollupsOf, codesOf }   // generic views over a Classifier
export { isClassifierRef, isDisplayRef, isDimRef }              // ref guards
export { resolveClassifierRef, resolveDisplayRef, resolveDimRef } // structural / UI / dispatch

// Pipe ops live inside transform.ts — exposed as TransformStep union:
export type { TransformStep, PipelineContext, DeriveExpr, RawRow }
export { applyPipeline, applyStep }                             // run a TransformStep[] over RawRow[]
// NodeDeriveMap = Array<{ key: string; expr: DeriveEntry }>
//   — engine-level ordered derive entries (superset of DeriveMap: allows DataLookupOp)
//   — Constructor uses this type in JSON Schema for the derive field on any node
```

---

## DeriveEntry — handles both pure + data-access

```ts
type DeriveEntry = ExprVal | DataLookupOp

type DataLookupOp =
  | { op: 'tree-field'; data: DataSpec; ref: ExprVal; field: string; fallback?: DimVal }
  | { op: 'map-field';  data: DataSpec; ref: ExprVal; field: string; fallback?: DimVal }

// engine.evalDerived():
// DataLookupOp → interpretSpec(op.data, ctx, stores) → lookup row[field] where row[refField] = evalExpr(ref)
// ExprVal      → evalExpr (@geostat/expr)
// Entries evaluated in array declaration order
```

---

## engine.renderNode — tree traversal

```ts
engine.renderNode(node: NodeDef, ctx: RenderContext): ReactNode

// Per node:
// 1. evalDerived → ctx.derived
// 2. evalExpr<boolean>(visibleWhen) → false → return null
// 3. interpretSpec(data) → ctx.rows
// 4. evalViewParams(view) → ctx.view (resolved scalars)
// 5. renderNode(child, ctx) per child → ChildrenArg
// 6. registry.get(type)(node, ctx, children) → ReactNode
```

---

## engine.extendSpec — custom DataSpec types

```ts
engine.extendSpec(type: string, resolver: SpecResolver): void

type SpecResolver = (
  spec:   Record<string, unknown>,       // full DataSpec object (app-typed)
  ctx:    RenderContext,
  stores: Record<string, DataStore>,
) => DataRow[]

// Registration (src/app/setupEngine.ts — alongside engine.extend):
engine.extendSpec('account-sequence', (spec, ctx, stores) => {
  const store = stores[(spec.storeId as string) ?? 'accounts']
  const rows  = store.query({ filter: evalFilter(spec.filter, ctx.scope) })
  return buildAccountSequence(rows, ctx.dims)
})

// interpretSpec sees 'account-sequence' → specRegistry lookup → resolver()
// Renderer receives DataRow[] — does not know the spec type that produced it ✅
```

Mirrors `nodeRegistry.register(type, renderer)` — same pattern, spec side.
App-specific DataSpec types live in `src/app/setupEngine.ts`, never in packages/.

---

## TRANSFORM_MAP — registration pattern (H-1)

> **Who owns it:** `HttpDataStore` holds the map internally. It is NOT exported.
> **Who populates it:** `engine.registerTransform(name, fn)` — called in `src/app/setupEngine.ts`.
> **When:** before the first render — same file as `engine.extend(nodeRegistry)`.

```ts
// src/app/setupEngine.ts — single setup file, called once before React renders

import { engine, nodeRegistry }  from '@geostat/react'
import { fromSDMX }              from '@geostat/engine'
import { setupFilterControls }   from '../components/theme/filter/setupFilterControls'
import { LandingPageRenderer }   from '../features/landing/LandingPageRenderer'

// 1. Node type renderers
nodeRegistry.register('landing-page',  LandingPageRenderer)
// ...

// 2. Custom DataSpec types
engine.extendSpec('account-sequence', accountSequenceResolver)

// 3. Transform functions — keyed strings in DataSpec.transform resolve here
engine.registerTransform('fromSDMX', fromSDMX)   // default — included by engine?  No — explicit always
engine.registerTransform('raw',      identity)   // pass-through: DataRow[] already parsed

// 4. Filter controls + URL codecs
setupFilterControls()   // calls registerFilterControl() for each ParamDef type

// 5. Built-in stores
engine.registerBuiltinStore('http', new HttpDataStore())
```

**Registration order matters:**
1. Transforms must be registered before any `type:'url'` DataSpec is resolved
2. Stores must be registered before `SiteProvider` mounts
3. Node types must be registered before `engine.renderNode()` is called
4. All of these happen before React renders — `setupEngine()` is called at top-level in `main.tsx`

**Default transforms — NOT pre-registered:**
```ts
// engine ships with empty TRANSFORM_MAP.
// Every transform must be explicit. Why:
//   - zero implicit deps on fromSDMX at engine level
//   - app controls which parsers are bundled (tree-shaking works)
//   - 'fromSDMX' registered in setupEngine.ts = one place to see all transforms
```

**`engine.listTransforms()` — Constructor dropdown:**
```ts
engine.listTransforms()
// → ['fromSDMX', 'raw']
// Constructor uses this to populate the transform picker in DataSpec editor
```

---

## HttpDataStore — dual error paths (K-1)

> **Two distinct throws. Two distinct React boundaries. Never confuse them.**

```ts
class HttpDataStore implements DataStore {
  private cache: DataRow[] | null = null
  private fetchPromise: Promise<void> | null = null
  private fetchError: Error | null = null

  query(q: ObsQuery): DataRow[] {
    // Path 1 — cache hit: always sync, always DataRow[]
    if (this.cache) return applyObsQuery(this.cache, q)

    // Path 2 — previous fetch failed: throw Error → NodeErrorBoundary catches
    if (this.fetchError) throw this.fetchError

    // Path 3 — first call or cache miss: throw Promise → Suspense catches, shows skeleton
    if (!this.fetchPromise) {
      this.fetchPromise = fetch(this.href)
        .then(r => r.json())
        .then(raw => { this.cache = this.transform(raw) })
        .catch(err => {
          // Network failure, bad JSON, transform error → convert to Error
          // On retry: React re-renders → query() → Path 2 → NodeErrorBoundary shows error node
          this.fetchError = err instanceof Error ? err : new Error(String(err))
          this.fetchPromise = null   // allow future retry (page refresh)
        })
    }

    throw this.fetchPromise  // React Suspense protocol — skeleton shown until resolved
  }
}
```

**Boundary mapping:**

| query() throws | Caught by | User sees |
|---|---|---|
| `Promise` | `<Suspense>` | Skeleton (loading state) |
| `Error` | `<NodeErrorBoundary>` | Error node ("მონაცემი მიუწვდომელია") |
| Nothing | — | DataRow[] returned, render proceeds |

**Rule:** NodeErrorBoundary MUST wrap every `engine.renderNode()` call. Without it, HttpDataStore errors bubble to the page-level ErrorBoundary — breaking the whole page instead of just the affected node.

---

## DataStore.query() — WHY sync, not async (K-8)

> **Phase 2 risk:** a new store author might write `async query(): Promise<DataRow[]>`.
> This would silently break Suspense — the engine cannot `await`, and React cannot catch a Promise that's buried inside an async function.

```ts
// ✅ Correct interface — always sync:
interface DataStore {
  query(q: ObsQuery): DataRow[]
}

// ❌ NEVER — breaks Suspense protocol:
interface DataStore {
  async query(q: ObsQuery): Promise<DataRow[]>  // engine never awaits → rows always undefined
}
```

**Why sync is the correct contract:**

```
DataStore.query() is the async boundary, not the async implementation.
Async behavior lives INSIDE the store (HttpDataStore: fetch, cache, throw Promise).
The interface surface is always sync — the store decides loading vs ready vs error.

Engine: calls store.query() synchronously.
         if store returns DataRow[]  → sync render path ✅
         if store throws Promise     → Suspense catches → skeleton → retry ✅
         if store throws Error       → ErrorBoundary catches → error node ✅

Phase 2 new DataStore author rule:
  — wrap async fetch in the same pattern as HttpDataStore
  — cache miss → throw Promise (Suspense)
  — fetch complete → fill cache → next query() returns DataRow[] sync
  — fetch error → store Error → next query() throws Error (ErrorBoundary)
  — NEVER make query() return Promise<DataRow[]>
```

---

## Key Rules

```
✅ Zero React — importable in non-React environments
✅ interpretSpec = pure sync function (engine never awaits)
✅ fromSDMX = ONLY format boundary (one place for SDMX → Observation[])
✅ DataLookupOp handled here (not in @geostat/expr)
✅ engine.extend(nodeRegistry) — node types
✅ engine.extendSpec(type, resolver) — custom DataSpec types (app-specific)
✅ Both registered in src/app/setupEngine.ts — never in packages/
✅ DataStore.query() = SYNC interface — async handled inside via Suspense pattern
✅ HttpDataStore: throw Promise (loading) vs throw Error (failure) — two distinct paths
✅ Classifier (structural) + DisplayMap (UI overlay) split — engine reads classifier only
✅ DataStore.classifiers + DataStore.display — both optional, engine merges via { $cl } refs
✅ codesOf(c) replaces dataset *_CATALOGUE static exports — single source of truth
```

---

## Classifier subsystem (D-1, D-2, D-3 — see architecture/18-classifier-pipe.md)

```
DataBundle           — { facts, classifiers?, display? }                    universal per-dataset shape
ClassifierEntry      — { code, parent?, …structural attrs }                  engine reads here
DisplayMap           — Record<id, Record<attr, DimVal>>                      id-keyed (uniform with classifier); engine ignores
ClassifierRef        — { $cl: 'dim', view? }   STRUCTURAL ref (classifier entries)
DisplayRef           — { $d:  'dim', view? }   UI ref (display entries w/ code injected)
DimRef               = ClassifierRef | DisplayRef
PipelineContext      — { classifiers?, display?, section? }                  threaded by callsites

DimResolver (internal to ExternalStore)
  code → leaf id set    (rollup expansion via parent edges)
  id   → code           (output translation)

resolveClassifierRef(ref, classifiers, defaultView)
  → classifier entries; pure structural; no display
resolveDisplayRef(ref, classifiers, display, defaultView)
  → display entries with `code` injected; classifier filters view (leaves/rollups)
resolveDimRef(ref, classifiers, display, defaultView)
  → dispatches by ref kind; one helper for callsites that accept both

Pipe ops (transform.ts TransformStep union, full set):
  melt · rename · cast · filter · sort · addField · select
  derive    — { as, expr: tree | string }                                    string formula parsed
  aggregate — { by, measure, agg, as? }     OR   { groupBy, aggregations[] }
  rollup    — { dim, as, of, agg, field? }                                   APPEND totals row
  lookup    — { key, from: ClassifierRef | dict, fields, rename? }
  join      — { with: ClassifierRef | array, on, onRight?, fields?, rename? }
  filter    — supports { $ctx: 'time' } CtxRef; resolves via PipelineContext.section
  sort      — supports { using: ['code1','code2'] } explicit ordering

InlineSource (data/source.ts):
  { type: 'inline', items: ClassifierRef | rows[], pipe?: TransformStep[] }  selects backed by classifier
```
