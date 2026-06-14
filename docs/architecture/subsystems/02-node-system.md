# Node System

> ყველა renderable unit = Node. Registry dispatches by type. Parent is blind.

---

## NodeBase — ყველა node-ის საფუძველი

```ts
interface NodeBase {
  type:         string           // dispatch key — registry.get(type) → renderer
  variant?:     string           // visual variation — renderer reads via def pass-through
  visibleWhen?: Expr             // boolean expr → engine skips node if false
  enabledWhen?: Expr             // boolean expr → for interactive nodes (future)
  layout?:      LayoutHints      // positioning hints — CSS-first
  derive?:      DeriveMap        // computed scope values before rendering
  data?:        DataSpec         // data declaration — interpretSpec resolves at runtime
  view?:        ViewParams       // display options (subtitle, hero, collapse...)
}

interface LayoutHints {
  position?: 'sticky-top' | 'sticky-bottom' | 'flow' | 'overlay' | string
  order?:    number              // render order within parent
  span?:     'full' | 'half' | 'third' | 'auto' | string
  label?:    string             // tab header, accordion title
  role?:     string             // 'chart' | 'table' | 'tab' | 'panel' | open string
}
```

---

## NodeDef Union — engine/react/ built-ins only

```ts
type NodeDef =
  | SectionNode         // { type: 'section'; children: NodeDef[] }
  | ChartNode           // { type: 'chart'; def: ChartDef }
  | TableNode           // { type: 'table' }
  | FilterBarNode       // { type: 'filter-bar'; bars: FilterBarSpec[] }
  | KpiStripNode        // { type: 'kpi-strip'; items: KpiDef[] }
  | InnerPageNode       // { type: 'inner-page'; children: NodeDef[]; title?: string }
  | TabPageNode         // { type: 'tab-page'; children: NodeDef[] }
  | ContainerPageNode   // { type: 'container-page'; children: NodeDef[] }
  // app-specific types NOT here — registered via engine.extend()
```

**Critical:** `LandingHeroNode`, `LandingStatsNode` → `src/features/landing/types.ts`.
They never appear in this union. Engine handles them via registry.

---

## NodeRegistry — T extends { type: string }

> **⚠️ DEPRECATED — 2-arg register + get(type only)**
> ახალი canonical: `register(type, variant, renderer)` + `get(type, variant)`.
> Canonical pattern: `migrate.md` → NodeRegistry Update ①.
> მიზეზი: variant dispatch requires registry-level lookup (pure table), not shell-internal if/else.
> examples/theme-config.md:431 — ✅ `nodeRegistry.register('container-page', 'landing', Shell)`.

```ts
// ❌ DEPRECATED — 2-arg, no variant support
interface NodeRegistry {
  register<T extends { type: string }>(
    type:     string,
    renderer: NodeRenderer<T>,
  ): void

  get(type: string): NodeRenderer | undefined
}

// ✅ CANONICAL — 3-arg with variant
interface NodeRegistry {
  register<T extends { type: string }>(
    type:     string,
    variant:  string,          // 'default' | 'landing' | 'compact' | any open string
    renderer: NodeRenderer<T>,
  ): void

  get(type: string, variant?: string): NodeRenderer | undefined
  // get(type, variant) → exact match → fallback to get(type, 'default')
}
```

**Why `T extends { type: string }` not `T extends NodeDef`?**

- `NodeDef` = only engine/react/ built-ins
- App-specific types (LandingHeroNode) extend `NodeBase`, not in `NodeDef`
- `T extends NodeDef` would block `nodeRegistry.register('landing-hero', 'default', LandingHeroRenderer)`
- `T extends { type: string }` = any object with a `type` field — fully open

---

## NodeRenderer — signature

```ts
type NodeRenderer<D extends NodeBase = NodeBase> =
  (def: D, ctx: RenderContext, children: ChildrenArg) => ReactNode
```

**Three args always:**
- `def` — the node definition (typed)
- `ctx` — full render context (theme, stores, dims, rows, derived, view, scope)
- `children` — pre-rendered children + original defs (ChildrenArg)

**Returns:** `ReactNode` — synchronous, pure function.

**NOT a React component.** Cannot call hooks directly. Use component wrapper pattern for hooks.

---

## ChildrenArg — array-only children (Agreement #16)

> **⚠️ DEPRECATED — `{ defs, rendered }` without `renderChild`**
> ახალი canonical: `{ defs, rendered, renderChild }`.
> მიზეზი: TabPageShell-ს lazy render სჭირდება — `renderChild(i)` ამ გარეშე shell-ი
> nodeRegistry-ს import-ავს პირდაპირ (circular dep). PRINCIPLES.md Rule 8: shared concern → core.

```ts
// ❌ DEPRECATED — missing renderChild
interface ChildrenArg {
  defs:     NodeDef[]
  rendered: ReactNode[]
}

// ✅ CANONICAL
interface ChildrenArg {
  defs:        NodeDef[]     // original defs — layout metadata: role, label, span, position
  rendered:    ReactNode[]   // pre-rendered by engine (same index as defs)
  renderChild: (i: number) => ReactNode  // lazy — only renders i-th child on demand
}
// renderChild(i): TabPageShell renders only active tab. No hidden DOM. No wasted fetch.
// Shells that don't need lazy: ignore renderChild, use rendered[i] directly. ISP: OK.
```

**Invariant:** `defs.length === rendered.length` and `rendered` contains no `null`.
Nodes where `visibleWhen` evaluated to `false` are **filtered out by the engine** before
`ChildrenArg` is built. Shell never receives invisible children — it never checks for null.

This is the engine's responsibility (Grafana/Builder.io pattern: invisible component =
removed from parent's child list, not rendered as null placeholder).

**Why both?**
- `rendered[i]` — display the child
- `defs[i].layout.label` — tab header, accordion title
- `defs[i].layout.role` — identify chart vs table for toggle
- `defs[i].layout.span` — column span in container layout

**Example — GeostatTabPageShell:**
```tsx
// ❌ DEPRECATED — children.rendered[activeTab] renders ALL tabs eagerly
// function GeostatTabPageShell({ def, children }: PageShellProps<TabPageNode>) {
//   const [activeTab, setActiveTab] = useState(0)
//   return (
//     <div>
//       <div className="tab-headers">
//         {children.defs.map((d, i) => (
//           <button key={i} onClick={() => setActiveTab(i)}>
//             {d.layout?.label ?? `Tab ${i + 1}`}
//           </button>
//         ))}
//       </div>
//       <div className="tab-content">
//         {children.rendered[activeTab]}  // ← all tabs pre-rendered, hidden DOM
//       </div>
//     </div>
//   )
// }

// ✅ CANONICAL — renderChild(i): only active tab renders. No hidden DOM. No wasted fetch.
function GeostatTabPageShell({ def, children }: PageShellProps<TabPageNode>) {
  const [activeTab, setActiveTab] = useState(def.defaultTab ?? 0)
  return (
    <div className="tab-page">
      <div className="tab-bar" role="tablist">
        {children.defs.map((d, i) => (
          <button key={i} role="tab" aria-selected={i === activeTab} onClick={() => setActiveTab(i)}>
            {d.layout?.label ?? String(i + 1)}
          </button>
        ))}
      </div>
      <div role="tabpanel">{children.renderChild(activeTab)}</div>
    </div>
  )
}
```

---

## SectionControl Pattern — chart ↔ table toggle

```ts
// SectionNode config:
{ type: 'section',
  data: { type: 'timeseries', indicator: 'B1G' },
  children: [
    { type: 'chart', layout: { role: 'chart' } },
    { type: 'table', layout: { role: 'table' } },
  ]
}

// GeostatSectionShell receives ChildrenArg:
function GeostatSectionShell({ def, children }: SectionShellProps) {
  const [showChart, setShowChart] = useState(true)

  const chartIdx = children.defs.findIndex(d => d.layout?.role === 'chart')
  const tableIdx = children.defs.findIndex(d => d.layout?.role === 'table')

  return (
    <section>
      <button onClick={() => setShowChart(s => !s)}>
        {showChart ? 'ცხრილი' : 'გრაფიკი'}
      </button>
      <div className={showChart ? 'visible' : 'hidden'}>
        {children.rendered[chartIdx]}
      </div>
      <div className={showChart ? 'hidden' : 'visible'}>
        {children.rendered[tableIdx]}
      </div>
    </section>
  )
  // no remount on toggle — both pre-rendered, CSS controls visibility
}
```

---

## RenderContext — full context object

```ts
interface RenderContext {
  theme:   ThemeConfig                    // injectable shells + chrome
  stores:  Record<string, DataStore>      // all stores — interpretSpec picks by storeId
  dims:    Record<string, DimVal>         // filter params — user selections
  derived: Record<string, DimVal>         // computed by evalDerived()
  rows:    DataRow[]                      // resolved by interpretSpec()
  view:    ResolvedViewParams             // evalViewParams() output — plain scalars
  scope:   ExprScope                      // { dims, derived } shortcut for evalExpr
}
```

---

## Registration — app extends engine

```ts
// ❌ DEPRECATED — 2-arg register, no variant (old pattern)
// nodeRegistry.register('landing-page', LandingPageRenderer)

// ✅ CANONICAL — registerSlice hub (migrate.md → ⑦ Bootstrap Pattern)
// src/setupRegistrations.ts
import * as Landing from '../plugins/landing/nodes'
import { registerSlice } from '@geostat/react'
;[...Object.values(Landing)].forEach(registerSlice)
// registerSlice reads slice.META.type + slice.META.variant → nodeRegistry.register(type, variant, Shell)
// plugins/landing/nodes/landing-hero/index.ts:
//   export const META: NodeSliceMeta = { sliceType: 'node', type: 'landing-hero', variant: 'default', label: '...' }
//   export const Shell: NodeRenderer<LandingHeroNode> = (def, ctx, children) => ...
```

---

## NodeBase.variant — registry dispatch key (canonical)

> **⚠️ DEPRECATED — Agreement I-3: "engine ignores variant, shell reads def.variant internally"**
> მიზეზი: shell-internal variant dispatch = if/else ან lookup table shell-ში = OCP დარღვევა.
> ყოველი ახალი variant → shell-ის კოდი იცვლება. Constructor ვერ ამატებს variant-ს deploy-ის გარეშე.
> examples/theme-config.md:425 — ❌ `if (def.variant === 'landing')` inside shell (explicitly marked).
> examples/theme-config.md:431 — ✅ `nodeRegistry.register('container-page', 'landing', Shell)`.

```ts
// ❌ DEPRECATED — shell-internal variant dispatch (Agreement I-3, old pattern)
function GeostatContainerShell({ def, children }) {
  if (def.variant === 'landing') return <LandingLayout>{children.rendered}</LandingLayout>
  return <DefaultLayout>{children.rendered}</DefaultLayout>
  // every new variant = code change. Constructor cannot add variants without deploy. ❌
}

// ❌ DEPRECATED — CSS-only cva inside shell (acceptable only for pure style variants)
function GeostatSectionShell({ def, children }: SectionShellProps) {
  const variant = def.variant ?? 'default'
  return <section className={`geostat-section geostat-section--${variant}`}>{children}</section>
  // acceptable for CSS-only. NOT acceptable for structural layout differences.
}

// ✅ CANONICAL — variant-in-registry (pure table dispatch, OCP-clean)
// register:
nodeRegistry.register('container-page', 'default', GeostatContainerPageShell)
nodeRegistry.register('container-page', 'landing', GeostatLandingShell)
// dispatch (renderNode):
const shell = nodeRegistry.get(node.type, node.variant ?? 'default')
// → GeostatLandingShell for variant:'landing' — pure table lookup. Zero if/else. ✅
// Constructor: adds variant → registers Shell → JSON config variant field → renders. ✅
```

**CSS-only exception:** `variant` used purely for CSS class (no structural difference) → cva inside shell is acceptable. Structural difference → separate registration.

**Source of truth:** `NodeSliceMeta.variant` field on each registered slice. Constructor reads `nodeRegistry.list()` → palette groups by type+variant.

---

## visibleWhen — two levels, two responsibilities

Two fields, two distinct concerns. Shell handles neither — engine owns both.

```
NodeBase.visibleWhen   → STRUCTURAL visibility  (engine step 2)
ViewParams.visibleWhen → VISUAL visibility      (engine step 6, slot wrapper)
```

### NodeBase.visibleWhen — structural (step 2)

```ts
evalExpr<boolean>(node.visibleWhen ?? true, ctx.scope)
// → false → return null → filtered from ChildrenArg entirely
```

Node does not exist in the tree. No DOM artifact. No slot div.

**Use when:** completely different node sets per page state.
```ts
{ type: 'section',
  visibleWhen: { op: 'eq', left: { $ctx: 'mode' }, right: 'year' },
  children: [/* year-specific chart + table */]
}
// section + entire subtree only exists in year mode
// In range mode: ChildrenArg has zero trace of this section
```

### ViewParams.visibleWhen — visual (step 6)

```ts
// Resolved at step 4: ctx.view.visibleWhen: boolean
// Applied at step 6 by slot wrapper:
<div className={`slot slot--flow ${ctx.view.visibleWhen === false ? 'slot--hidden' : ''}`}>
  {node}
</div>
// CSS: .slot--hidden { visibility: hidden; pointer-events: none; }
```

Node stays mounted in DOM. CSS hides it. Transition animations work.

**Use when:** animated collapse, progressive disclosure (ONS pattern).
```ts
{ type: 'section',
  view: {
    visibleWhen: { op: 'gt', left: { $derived: 'rowCount' }, right: 0 }
  }
}
// section fades in/out as rowCount crosses 0 — stays mounted for CSS transition
```

### Summary

| | `NodeBase.visibleWhen` | `ViewParams.visibleWhen` |
|---|---|---|
| Engine step | 2 | 6 (slot wrapper) |
| DOM | removed | stays, `visibility: hidden` |
| Subtree | destroyed | mounted |
| Animation | no | yes (CSS transition) |
| Shell concern | none | none |
