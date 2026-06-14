# Anti-Patterns

> ყველა ეს pattern-ი გამოიყენებოდა. ყველა ჩაანაცვლეს. ეს document ახსნის რატომ.

---

## ctx.year / ctx.regionId

```ts
❌  const rows = ctx.year === 2023 ? ... : ...
✅  const rows = ctx.dims['time'] === 2023 ? ... : ...
```

**Problem:** Hardcoded dimension names. Phase 2: Constructor changes dim keys → breaks silently.
**Fix:** `ctx.dims['key']` — generic access, works with any dimension name.

---

## Functions in Config

```ts
❌  { getRows: (ctx) => store.query({ year: ctx.year }) }
✅  { data: { type: 'timeseries', storeId: 'gdp', dims: { time: { $ctx: 'time' } } } }
```

**Problem:** Function → not JSON → Constructor cannot store/generate → Phase 2 dead end.
**Fix:** `DataSpec` — declarative, JSON-serializable, engine resolves at runtime.

---

## Local Row Interface

```ts
❌  interface GDPRow { value: number; geo: string; year: number }
✅  import { DataRow } from '@geostat/engine'
```

**Problem:** Each feature defines own Row type → diverges from DataRow → breaks reuse.
**Fix:** `DataRow = Record<string, DimVal>` — universal contract.

---

## JSX / ReactNode in Config

```ts
❌  { header: <div>მშპ</div> }
✅  { header: 'მშპ' }
// renderer creates the JSX from the string
```

**Problem:** JSX is not JSON. Config becomes imperative. Constructor cannot serialize.
**Fix:** Config = plain values. Renderer = JSX creator.

---

## Logic in Config (if/switch)

```ts
❌  { visibleWhen: (ctx) => ctx.dims['mode'] === 'year' }
✅  { visibleWhen: { op: 'eq', left: { $ctx: 'mode' }, right: 'year' } }
```

**Problem:** Function not JSON, not Constructor-ready.
**Fix:** `ExprVal` — declarative, composable, JSON-safe.

---

## getRows in Config

```ts
❌  section.getRows = (ctx, store) => store.query({ ... })
✅  section.data = { type: 'timeseries', storeId: 'gdp' }
```

**Problem:** Function in config (see above). Also: tightly couples to specific store API.
**Fix:** `DataSpec` — declarative, store-agnostic, engine handles.

---

## named fields on SectionNode (chart?, table?)

```ts
❌  { type: 'section', chart: { type: 'chart', ... }, table: { type: 'table', ... } }
✅  { type: 'section', children: [
      { type: 'chart', layout: { role: 'chart' } },
      { type: 'table', layout: { role: 'table' } },
    ]}
```

**Problem:** Named fields → parent knows child types → parent not blind → Open/Closed violated.
**Fix:** `children: NodeDef[]` + `layout.role` — parent reads metadata, not type.

---

## SlotRegistry / SlotWrapper

```ts
❌  slotRegistry.register('filter-bar', { wrapper: FilterBarWrapper })
❌  <FilterBarWrapper>{children}</FilterBarWrapper>
✅  layout: { position: 'sticky-top' }  // in NodeDef
    // engine wraps: <div className="slot slot--sticky-top">
    // CSS handles positioning — JS handles nothing
```

**Problem:** JS-side wrapping duplicates what CSS can do. Adds complexity, breaks CSS-first.
**Fix:** `layout.position` hint + CSS class. Engine wraps, CSS positions.

---

## renderSlots() / SlotRegistry in engine.extend()

```ts
❌  engine.extend(nodeRegistry, slotRegistry)
✅  engine.extend(nodeRegistry)
```

**Problem:** SlotRegistry removed (Agreement #18). SlotWrapper removed.
**Fix:** One arg — nodeRegistry only.

---

## LandingHeroNode / LandingStatsNode in engine/react/ NodeDef union

```ts
// engine/react/src/engine/types.ts
❌  type NodeDef = ... | LandingHeroNode | LandingStatsNode
✅  type NodeDef = SectionNode | ChartNode | TableNode | FilterBarNode | KpiStripNode
                 | InnerPageNode | TabPageNode | ContainerPageNode
                 // app-specific types → src/ → registered via engine.extend()
```

**Problem:** engine/react/ imports app-specific types → circular concern, breaks agnostic rule.
**Fix:** `T extends { type: string }` in NodeRegistry. App registers via `engine.extend()`.

---

## T extends NodeDef in NodeRegistry

```ts
❌  class NodeRegistry { register<T extends NodeDef>(type, renderer) }
✅  class NodeRegistry { register<T extends { type: string }>(type, renderer) }
```

**Problem:** `NodeDef` is engine/react/ built-ins only. App-specific types (LandingHeroNode) cannot register.
**Fix:** Constraint → `{ type: string }`. Any object with a `type` field can register.

---

## ctx.store (single store)

```ts
❌  const store = ctx.store   // single DataStore — breaks multi-store
✅  const store = ctx.stores[storeId]  // registry, engine picks by storeId
```

**Problem:** Single store context → GDP page must use accounts store → impossible.
**Fix:** `ctx.stores: Record<string, DataStore>` — all stores in registry, picked by key.

---

## PageConfig.nav (nav embedded in page)

```ts
❌  pageConfig.nav = { label: 'მშპ', icon: 'bar-chart', items: [...] }
✅  // nav.config.ts:
    export const NAV: NavItem[] = [
      { label: 'მშპ', icon: 'bar-chart', path: '/gdp', pageId: 'gdp' },
    ]
```

**Problem:** Page knows its nav position → coupling. Landing page not in nav → exception. Phase 2: nav and page are separate DB tables.
**Fix:** `nav.config.ts` — site-level concern, independent of PageConfig.

---

## async in NodeRenderer

```ts
❌  async function SectionRenderer(def, ctx): Promise<ReactNode> {
      const rows = await ctx.store.query(...)
      return <Section rows={rows} />
    }
✅  // Component wrapper pattern:
    function SectionRenderer(def, ctx): ReactNode {
      return <SectionControl def={def} stores={ctx.stores} dims={ctx.dims} />
    }
    function SectionControl({ def, stores, dims }) {
      const { data } = useStoreQuery(stores, def.storeId, spec)
      return <Section rows={data} />
    }
```

**Problem:** `NodeRenderer` is a plain function called by engine — NOT a React component. `async` + `hooks` forbidden in plain functions.
**Fix:** Component wrapper pattern. Renderer returns `<InnerComponent />`. Inner component uses hooks.

---

## buildNav() — nav derived from pages

```ts
❌  const nav = buildNav(pages)  // nav derived from pages — coupling
✅  import { NAV } from './nav.config'  // nav declared independently
```

**Problem:** `buildNav()` assumes 1:1 page→nav. Breaks for: hidden pages, nav headers without pages, different order.
**Fix:** `nav.config.ts` declares `NavItem[]` directly. `pageId?` is optional link.

---

## Direct import of src/ in engine/react/

```ts
// engine/react/src/page/SiteRenderer.tsx
❌  import { GeostatSectionShell } from '../../../../src/components/theme/...'
✅  const Shell = ctx.theme.shells['section']
```

**Problem:** engine/react/ depends on src/ → circular dependency, breaks package isolation.
**Fix:** ThemeConfig bridge. Shell is injected via ctx.theme, never imported directly.
