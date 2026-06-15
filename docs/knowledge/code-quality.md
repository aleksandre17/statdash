# Geostat — Code Quality Reference

> წაიკითხე სანამ: ახალი კოდის წერა, code review, SOLID გადამოწმება.
> (Platform Mindset + 8 Rules → `principles.md` · Arch decisions → `architecture.md`)

---

## SOLID — ყოველ კლასზე, ყოველ interface-ზე

SOLID = ჩვენი კოდბეისის ენა. სახელი ვერ გამართლებს pattern-ს. pattern-ი ამ 5 კრიტერიუმს უნდა აკმაყოფილებდეს.

### S — Single Responsibility Principle
**ერთი კლასი = ერთი ცვლილების მიზეზი.**

```
NodeRegistry      → dispatches only.
resolveNodeRows() → data resolution only.
renderNode()      → tree traversal + dispatch only.
DataStore         → data access only.
FilterBarShell    → bridge (config → runtime bars) only.
YearSelectShell   → year select UI only.

❌ renderer that also fetches data
❌ adapter that also validates
✅ one file = one concern. renderer file ≠ 150+ lines — split it.
```

### O — Open/Closed Principle
**გაფართოება → open. მოდიფიკაცია → closed.**

```
❌ modify packages/ to add Geostat node types
✅ declare module '@geostat/react' { interface NodeTypeMap { 'my-type': MyNode } }
❌ if/switch on node.type inside engine or packages/
✅ nodeRegistry.get(type, variant) — pure table lookup, no branching
✅ new DataSpec type → defaultRegistry.register() — engine/ 0 ცვლილება
```

```ts
// ახალი node type: packages/ არ იცვლება.
declare module '@geostat/react' {
  interface NodeTypeMap { 'landing-hero': LandingHeroNode }
}
// registerSlice(landingHeroSlice) → done ✅
```

### L — Liskov Substitution Principle
**ყველა implementation-ი მისი interface-ის contract-ს ასრულებს.**

```
❌ if (store instanceof ExternalStore) { ... }         — LSP violation
❌ if (store.type === 'static') { ... }                — LSP violation
✅ engine dispatches by type string only. All DataStore impls are substitutable.
✅ StaticDataStore / ExternalStore / HttpDataStore — same interface, swap freely.
✅ SectionShell, ChartShell, KpiStripShell — same NodeRenderer signature.
```

### I — Interface Segregation Principle
**კლიენტი არ უნდა დამოკიდებული იყოს interface-ზე, რომელსაც არ იყენებს.**

```
❌ one large ShellProps with 20 fields, most optional
✅ per-shell typed props: SectionShellProps · ChartShellProps · FilterBarShellProps
✅ FilterCodec<T> separate from FilterControlSlice — codec only when needed
✅ StoreCaps: { batching?: boolean; streaming?: boolean } — capability opt-in, not required
✅ NodeRenderer არ იცის chrome. ChromeSlice არ იცის data.
✅ filterControlRegistry.get(type) → Shell — 0 cross-dependencies between controls.
```

### D — Dependency Inversion Principle
**High-level module → abstract interface. NOT concrete implementation.**

```
❌ ChartShell imports ExternalStore directly
✅ Shell depends on DataStore interface — any impl works

❌ SiteRenderer knows about GDP, accounts, regional
✅ SiteRenderer depends on SiteManifest — pure config, no data knowledge

packages/engine/  → depends on: nothing
packages/react/   → depends on: @geostat/engine interfaces
plugins/          → depends on: @geostat/react interfaces
src/              → depends on: everything (outermost)

engine never imports: React · specific DataStore class · Geostat anything
react  never imports: src/ · plugins/ · specific Shell
plugins never imports: src/ (except @geostat/* packages)
```

---

## Design Patterns — კოდბეისის ენა

| Pattern | გამოყენება |
|---------|-----------|
| Registry + Strategy | nodeRegistry / chromeRegistry / filterControlRegistry → `register(type, variant, impl)` → `get(type, variant)` → call. new type = zero change in engine. |
| Adapter | `fromSDMX(raw): Observation[]` — only format boundary. `ExternalStore.query()` adapts Observation[] → EngineRow[]. Wire format never leaks past adapter. |
| Repository | `DataStore` interface — consumers don't know static/HTTP/cached. `interpretSpec(spec, ctx, store)` — store injected, not imported. |
| Factory | `DatasourcePlugin.create(config) → DataStore` · `createNodeRegistry()` + `createChromeRegistry()` — test isolation |
| Composite | NodeDef tree — `renderNode()` recursive |
| Facade | `SiteManifest` — single entry point (stores + pages + nav + chrome). `fetchSiteManifest()` hides Phase 1/2 complexity from App.tsx. |
| Null Object | `NullChromeSlot: () => null` — hidden chrome slot, zero null checks in AppChrome |
| Plugin | `registerSlice()` — sliceType discriminant → registry dispatch |
| Observer | `FilterContext` → URL params → re-render. URL = permalink. Filter change → URL update → reload → same state. |
| Strangler Fig | new code → switch import → delete old (never coexist long-term) |
| Module Augmentation | `NodeTypeMap` — open type system without packages/ change |

---

## OOP — კლასი სად, სად არა

```
✅ გამოიყენე class:
  DataStore implementations  — StaticDataStore · ExternalStore · HttpDataStore · CachedStore
                               has internal state (cache, observations), methods map to interface
  Registry singletons        — NodeRegistry · ChromeRegistry · FilterControlRegistry
                               manages Map<string, impl>: register / get / list / snapshot
  Error types                — ExprEvalError extends Error (message + context)
  Adapters with state        — HttpDataStore (cache + fetchPromise + fetchError internal)

❌ ნუ გამოიყენებ class:
  Renderers          — NodeRenderer = plain function (def, ctx, children) => ReactNode
  React components   — function components only (no class components)
  Page configs       — plain JSON objects (Constructor ვერ serialize-ებს class instance-ს)
  Pure functions     — interpretSpec · applyEncoding · evalExpr — standalone functions
  Hooks              — function useFilterState() — not a class
```

```ts
// DataStore implementation pattern:
class ExternalStore implements DataStore {
  private readonly observations: Observation[]
  constructor(obs: Observation[], opts?: { classifiers?, display? }) {
    this.observations = obs
  }
  query(q: ObsQuery): EngineRow[] { ... }
  invalidate(): void              { ... }
}

// Registry pattern (+ test isolation factory):
class NodeRegistryImpl implements NodeRegistry {
  private readonly map = new Map<string, Map<string, NodeRenderer>>()
  register(type, variant, renderer, meta?) { ... }
  get(type, variant): NodeRenderer | undefined { ... }
  list(type?): Array<...> { ... }
  snapshot(): RegistrySnapshot { return new Map(this.map) }
  restore(snap: RegistrySnapshot): void { this.map.clear(); ... }
}
export const nodeRegistry = new NodeRegistryImpl()
export function createNodeRegistry(): NodeRegistry { return new NodeRegistryImpl() }
```

---

## Clean Code

**Naming:**
```ts
✅ resolveNodeRows · ChildrenArg · NodeRenderer · registerSlice
❌ handleData · process · doRender · tmp
```

**File size limits:**
```
Renderer file   → ≤ 80 lines   (plain function + inner component)
Hook file       → ≤ 100 lines  (one hook, pure logic)
Types file      → ≤ 150 lines  (types only, no runtime code)
Adapter file    → ≤ 80 lines   (one format boundary)
If over → split.
```

**Named exports always:**
```ts
❌ export default function SectionShell   // tree-shaking opaque, refactoring hard
✅ export const SectionShell: NodeRenderer<SectionNode> = ...
```

**index.ts = barrel only:**
```ts
❌ logic in index.ts
✅ re-exports only. index.ts = public API surface of the module.
```

**Pure functions:**
```ts
✅ interpretSpec(spec, ctx, store): DataRow[]    — pure, testable, no side effects
✅ applyEncoding(rows, enc): DataRow[]           — pure
✅ evalVisibility(expr, params): boolean         — pure
❌ function that reads module-level mutable state
```

**Immutable patterns:**
```ts
✅ return { ...ctx, rows: newRows }   — spread, not mutation
❌ ctx.rows = newRows                 — mutation = bugs in render pipeline
```

**Co-location:**
```
plugins/nodes/section/
  SectionShell.tsx      SectionSkeleton.tsx   SectionShell.css
  index.ts              SectionShell.test.ts
```

**Comments — only WHY, never WHAT:**
```ts
❌ // render the node
✅ // lazy: only active tab renders — avoids mounting hidden tabs and their data fetches
✅ // ALL children rendered — CSS controls visibility — no remount on toggle
```

---

## Clean Architecture

```
src/         (outermost — knows everything)
  plugins/   (app slices — knows react)
    packages/react/  (adapter)
      packages/engine/  (core — zero external deps)

Arrow direction: inward only.
```

**Dependency Rule violations (automatic red flags):**
```
❌ packages/engine importing React
❌ packages/react importing from src/
❌ packages/react importing from plugins/
❌ plugins/ importing from src/ (except @geostat/* aliases)
❌ packages/ containing Geostat-specific anything
```

**სად რა კოდი ეკუთვნის (canonical split logic):**
```
packages/engine/    Pure TS computation. Zero React. Zero app knowledge.
                    ← interpretSpec · applyEncoding · applyPipeline · evalExpr
                    ← DataStore interface + implementations
                    ← fromSDMX (format adapter) · groupBySpan · formatValue

packages/react/     React adapter. Registries + RenderContext + hooks. DEFAULTS only.
                    ← NodeRegistry · ChromeRegistry · FilterControlRegistry
                    ← renderNode() pipeline · useFilterState() · SiteContext
                    ← DEFAULT shells (pass-through, zero brand)

plugins/            Generic shells + chrome + controls. Brand = tokens only.
                    ← SectionShell · ChartShell · FilterBarShell · AppChrome
                    ← FilterControlSlice implementations
                    ← Module augmentation (NodeTypeMap extensions)

src/data/           App-specific DataStore instances + adapters.
                    ← fromGDPFacts · gdpStore · fromAccountsFacts · accountsStore
                    ← manifest.ts (THE SEAM)

src/pages/          Track A: JSON NodeDef trees. Constructor-compatible.
src/app/            Bootstrap only: App.tsx · routes.tsx · setupRegistrations.ts
```

**WRONG PLACE red flags:**
```
❌ Business logic in renderer   → move to interpretSpec or hook
❌ App brand in packages/       → move to plugins/ or src/
❌ DataStore impl in plugins/   → move to src/data/
❌ Page config in features/     → move to src/pages/
❌ Hooks in renderer body       → component wrapper pattern (inner component)
❌ Type definitions scattered   → colocate with implementation or types.ts
```