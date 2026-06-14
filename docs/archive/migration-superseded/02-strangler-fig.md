# Strangler Fig Migration Plan — Option B (plugins/)

> Shells implemented in their **final location** from day one.
> No intermediate `src/components/theme/` step. No second migration.
> Every step self-contained: builds · renders · types pass.

---

## Principles

```
1. Write new code (in final location — plugins/)
2. tsc --noEmit → 0 errors
3. Visual / functional check
4. Delete old code
Never skip step 4. Coexistence is temporary, never permanent.
```

---

## Plugin Anatomy — RegistrableSlice Standard

Every plugin is exactly one of three shapes. Determined by `META` discriminant.

### META Interface Definitions — `sliceType` discriminant

Platform standard: Grafana `plugin.meta.type === 'panel'|'datasource'`, Builder.io `@type` — explicit string field.
Structural typing (`'slot' in s.META`) = fragile. Field presence ≠ type identity.
`sliceType` = watertight discriminant. `switch(s.META.sliceType)` → TypeScript exhaustive check.
Constructor reads `sliceType` from JSON → palette category. New slice kind → add case. Zero breakage.

```ts
// engine/react/src/engine/types.ts — META interface definitions
interface NodeSliceMeta {
  sliceType: 'node'      // ← explicit discriminant (NOT structural)
  type:      string
  variant?:  string      // omit → 'default'
  label:     string
  icon?:     string
  category?: string
  schema?:   object      // JSON Schema → Constructor form editor
  preview?:  string
}
interface ChromeSliceMeta {
  sliceType: 'chrome'    // ← explicit discriminant
  slot:      string
  key:       string
  label:     string
  preview?:  string
}
interface FilterControlMeta {
  sliceType:   'control' // ← explicit discriminant
  controlType: string
  label:       string
  category?:   string
}
// New slice type (e.g. datasource plugin): add sliceType: 'datasource' → add case in registerSlice.
```

### NodeSlice

```
plugins/nodes/{type}/
  {Type}Shell.tsx       ← NodeRenderer<T>  — component wrapper if hooks needed
  {Type}Skeleton.tsx    ← SkeletonFn       — loading state, same signature as Shell
  {Type}Shell.css       ← token-driven CSS (no brand values hardcoded)
  index.ts              ← exports Shell · Skeleton · META (all from this file)
```

```ts
// plugins/nodes/section/index.ts  — canonical pattern
import { SectionShell    } from './SectionShell'
import { SectionSkeleton } from './SectionSkeleton'
import type { NodeSliceMeta } from '@geostat/react'

export { SectionShell    as Shell    }
export { SectionSkeleton as Skeleton }
export const META: NodeSliceMeta = {
  sliceType: 'node',          // ← required on all NodeSlice META
  type:     'section',
  variant:  'default',
  label:    'სექცია',
  icon:     'layout-section',
  category: 'layout',
  schema: {
    type: 'object',
    properties: {
      view: {
        type: 'object',
        properties: {
          subtitle:   { type: 'string'  },
          hero:       { type: 'boolean' },
          noCollapse: { type: 'boolean' },
          exportable: { type: 'boolean' },
        }
      }
    }
  },
  preview: '/previews/section.png',
}
// META is JSON-serializable: JSON.parse(JSON.stringify(META)) === META ✅
// Skeleton is a separate export (function — NOT in META, not JSON-serializable)
```

### ChromeSlice

```
plugins/chrome/{Slot}/{variant}/
  {Name}.tsx    ← () => ReactNode — ZERO PROPS. All data via hooks internally.
  index.ts      ← exports Shell · META
```

```ts
// plugins/chrome/AppHeader/default/index.ts
import { FullHeader } from './FullHeader'
import type { ChromeSliceMeta } from '@geostat/react'

export { FullHeader as Shell }
export const META: ChromeSliceMeta = {
  sliceType: 'chrome',   // ← required on all ChromeSlice META
  slot:    'AppHeader',
  key:     'default',
  label:   'სრული სათაური',
  preview: '/previews/header-full.png',
}
```

### ControlSlice (FilterControlSlice)

```
plugins/controls/{type}/
  {Name}Shell.tsx   ← ComponentType<{ filterKey: string; config: C }>
  index.ts          ← exports Shell · META · defaultValue · codec · validate? · formatValue?
```

```ts
// plugins/controls/year-select/index.ts
import { YearSelectShell } from './YearSelectShell'
import type { FilterControlMeta, FilterCodec } from '@geostat/react'

export { YearSelectShell as Shell }
export const META: FilterControlMeta = {
  sliceType:   'control',  // ← required on all ControlSlice META
  controlType: 'year-select',
  label:       'წლის ასარჩევი',
  category:    'time',
}
export const defaultValue = (config: YearSelectDef) =>
  config.range?.[1] ?? new Date().getFullYear()
export const codec: FilterCodec<number> = {
  toUrl:     v  => String(v),
  fromUrl:   s  => s ? parseInt(s, 10) : null,
  isEmpty:   v  => v == null || !Number.isFinite(v),
  normalize: raw => parseInt(String(raw), 10),
}
export const validate    = (v: number, c: YearSelectDef) =>
  c.range && (v < c.range[0] || v > c.range[1]) ? `${c.range[0]}–${c.range[1]}` : null
export const formatValue = (v: number) => String(v)
```

---

## registerSlice — The Dispatch Hub

```ts
// engine/react/src/engine/registerSlice.ts  (verify exists or create)
import { nodeRegistry, chromeRegistry, filterControlRegistry } from './registries'
import type { RegistrableSlice, NodeSlice, ChromeSlice, ControlSlice } from './types'

// sliceType discriminant — explicit, not structural (Grafana/Builder.io standard)
// switch → TypeScript exhaustive check; new category → add case, zero breakage
const isNodeSlice    = (s: RegistrableSlice): s is NodeSlice    => s.META.sliceType === 'node'
const isChromeSlice  = (s: RegistrableSlice): s is ChromeSlice  => s.META.sliceType === 'chrome'
const isControlSlice = (s: RegistrableSlice): s is ControlSlice => s.META.sliceType === 'control'

export function registerSlice(slice: RegistrableSlice): void {
  if (isNodeSlice(slice)) {
    const { type, variant = 'default' } = slice.META
    nodeRegistry.register(type, variant, slice.Shell as NodeRenderer, {
      label:    (slice.META as NodeSliceMeta).label,
      icon:     (slice.META as NodeSliceMeta).icon,
      category: (slice.META as NodeSliceMeta).category,
      schema:   (slice.META as NodeSliceMeta).schema,
      preview:  (slice.META as NodeSliceMeta).preview,
    })
    if (slice.Skeleton) skeletonRegistry.register(type, variant, slice.Skeleton)
  } else if (isChromeSlice(slice)) {
    chromeRegistry.register(slice.META.slot, slice.META.key, slice.Shell, {
      label:   slice.META.label,
      preview: slice.META.preview,
    })
  } else if (isControlSlice(slice)) {
    filterControlRegistry.register(slice as FilterControlSlice)
  }
}
```

---

## Dependency Order

```
①   → V-1    NodeRegistry: T constraint + variant system + NodeRenderer/ChildrenArg types
②a  → DeriveMap → Array                    (engine/core/src/types.ts — engine/expr/ doesn't exist)
②b  → ctx.stores + ThemeConfig             (RenderContext — engine/react)
②c  → SectionNode.children                 (type only)
②d  → TabPageNode.defaultTab               (type only)
②e  → SiteContext + SiteProvider + hooks   (new file — engine/react)
②f  → resolveNodeRows() + renderNode()     (new files — engine/react)
②g  → DEFAULT shells auto-registration     (engine/react init — zero brand)
②h  → registries + hooks                  (engine/react — BEFORE ④ ⑤ ⑥)
🗂   → V-2, V-3 + src/data/ → root data/   (file moves — BEFORE ④ ⑤)
③   → V-6    NodeDef cleanup               (needs 🗂)
④   → Node shells in plugins/nodes/        (needs ②b ②f ②g)
⑤   → Chrome shells in plugins/chrome/    (needs 🗂)
⑥   → Controls in plugins/controls/       (independent)
⑦   → setupRegistrations.ts + App restructure  (needs ② ④ ⑤ ⑥, fixes V-7 V-12 V-13)
⑧   → Renderers DELETE                    (after ⑦ confirmed, fixes V-4 V-5)
🗑   → Full cleanup                        (after ⑧, fixes V-8 V-9 V-10)
📄   → Page configs in pages/ (Track A)    (after 🗑 — platform must be ready first)
```

**ყოველი sub-step → tsc → 0 → შემდეგი.** ②a-②g შეიძლება ერთ session-ში, მაგრამ cascade error-ებს ასე ადვილად პოულობ.

**📄 Track A — page configs only, no custom React:**
```
Phase 1 (now):   developer writes NodeDef JSON in pages/*.config.ts
                 → same structure Constructor will generate via panel
Phase 2 (panel): pages/ folder deleted entirely
                 → Constructor writes to DB → manifest.ts fetches from API
                 → manifest.ts: ONE LINE CHANGE — static return → fetch('/api/site')

Rule: pages/ contains ONLY JSON-serializable NodeDef trees + raw data configs.
      Zero custom logic. Zero React. Zero functions.
      If something cannot be expressed as JSON → redesign, not workaround.
```

---

## ① NodeRegistry — T constraint + variant system + NodeRenderer type

**File:** `engine/react/src/engine/nodeRegistry.ts` + `engine/react/src/engine/types.ts`
**Type:** TypeScript only — zero visual impact. Both files in one step (they're coupled).

Current API (read from file):
```ts
register<T extends NodeDef>(type, renderer, opts?)  // 2-arg, no variant
get(type: string): Renderer | undefined              // 1-arg, no variant
children: ReactNode                                  // flat ReactNode, not ChildrenArg
```

Target API (new architecture):
```ts
// engine/react/src/engine/types.ts — ADD alongside existing Renderer type (don't delete yet)
type ChildrenArg = {
  defs:        NodeDef[]           // original child NodeDef[]  (for Shell to read layout.role etc.)
  rendered:    ReactNode[]         // pre-rendered (eager) — for most Shells
  renderChild: (i: number) => ReactNode  // lazy — for TabPageShell, virtual scroll
}
type NodeRenderer<T extends { type: string } = { type: string }> =
  (def: T, ctx: RenderContext, children: ChildrenArg) => ReactNode
// Old Renderer type (children: ReactNode) stays for transition period — deleted in ⑧.

// engine/react/src/engine/nodeRegistry.ts — update NodeRegistry class
register<T extends { type: string }>(   // V-1 fix: was T extends NodeDef
  type:     string,
  variant:  string,                     // NEW — was not in current API
  renderer: NodeRenderer<T>,
  opts?:    {
    children?: readonly string[]  // transition period — deleted in ⑧
    label?:    string             // palette display name
    icon?:     string             // palette icon key
    category?: string             // palette grouping
    schema?:   object             // JSON Schema → Constructor form editor
    preview?:  string             // palette thumbnail URL
  },
): this {
  this.map.set(`${type}::${variant}`, renderer as NodeRenderer)
  if (opts?.children?.length) this.childMap.set(type, opts.children)
  if (opts) this.metaMap.set(`${type}::${variant}`, opts)  // Constructor queries getMeta()
  return this
}

get(type: string, variant = 'default'): NodeRenderer | undefined {
  return this.map.get(`${type}::${variant}`)
    ?? this.map.get(`${type}::default`)  // fallback to default variant
}
// Old render(node, ctx, children: ReactNode) method stays — deleted in ⑧.
// getChildFields() stays — deleted in ⑧ after renderNode() takes over traversal.
```

**Verify:** `tsc --noEmit → 0 errors`

---

## ②a — DeriveMap → Array

**Scope:** `engine/core/src/types.ts` (NOT `engine/expr/` — that package does not exist yet).
Platform standard: Grafana/Builder.io keep expression types in the engine core package.
`engine/expr/` = Phase 3+ if expression language grows to warrant its own package.

```ts
// Before: type DeriveMap = Record<string, ExprVal>
type DeriveMap = Array<{ key: string; expr: ExprVal }>
// Array = ordered, deterministic topo-sort — Record = undefined evaluation order
```

**Verify:** `tsc --noEmit → 0 errors`

---

## ②b — types.ts additions (V-11 + NodeBase + NodeTypeMap + PageConfigBase)

**Scope:** `engine/react/src/engine/types.ts`

### NodeBase — shared base for all NodeDef members
Builder.io `BuilderElement`, Grafana `PanelModel` standard: every registry block shares common fields.
```ts
// NEW — add before NodeDef union
export interface NodeBase {
  type:     string
  id?:      string
  data?:    DataSpec      // engine resolves → ctx.rows before Shell is called
  view?:    ViewParams    // display config (legend, toggle, subtitle, exportable…)
  layout?:  { role?: string; label?: string }  // layout.role = 'chart'|'table'|'sidebar'
  variant?: string        // shell variant key — omit → 'default'
}
// All NodeDef members should extend NodeBase. Done incrementally — tsc flags each.
```

### NodeTypeMap — plugin extensibility (Builder.io module augmentation pattern)
```ts
// NEW — package declares empty interface; plugins augment via declare module
export interface NodeTypeMap {}
// NodeDef = core types + registered plugin extensions
// Empty NodeTypeMap → NodeDef = CoreNodeDef. Plugin augments → auto-extends NodeDef. ✅
// Zero packages/ change for new node types — module augmentation only.
```

### RenderContext — TWO changes only (V-11)
Other fields (`filterParams`, `set`, `timeModeKey`, `effects`, `color`, `sectionCtx`) stay untouched.
`paramOptions` DELETE deferred to ⑧. `rows?`, `view?` stay ✅.
```ts
// Change 1: store → stores
//   Before: store: DataStore
stores:        Record<string, DataStore>
pageStoreKey?: string   // default store key for this page

// Change 2: renderNode injected field → DELETE
//   Before: renderNode: (node: NodeDef, ctxOverride?: Partial<RenderContext>) => ReactNode
//   After: free function imported from '@geostat/react' — not injected into ctx
//   Cascade: update call sites → ctx.renderNode(n, o) becomes renderNode(n, {...ctx, ...o})
```

### PageConfigBase — ❌ DEPRECATED

> **❌ DEPRECATED:** `PageConfigBase { root: NodeDef }` wrapper pattern — replaced by intersection.
> See `.claude/migration/08-pages.md` and `refactor-plane/examples/filter-bar-page.md` for canonical.
>
> **✅ CANONICAL (implemented in `engine/react/src/engine/types.ts`):**
> ```ts
> export interface PageConfigBase {
>   id:            string
>   path?:         string
>   color?:        string
>   filterSchema?: FilterSchemaInput
>   vars?:         VarMap
>   modeOrder?:    string[]
> }
> export type NodePageConfig = (InnerPageNode | TabPageNode | ContainerPageNode) & PageConfigBase
> ```
> Page IS the root node. No `root` wrapper field. Intersection = types compose, not wrap.
> Phase 2: `src/pages/` deleted → manifest.ts fetches from API. Zero structural change.

**Verify:** `tsc → 0` (fix cascade errors from store → stores rename + renderNode ctx removal)

---

## ②c — SectionNode.children (V-14)

**Scope:** `engine/react/src/engine/types.ts` — ONLY change: `chart?/table?/tabs?` → `children`.
All other fields (id, title, label, anchor, color, data, view, prependLabel) stay unchanged.

```ts
// Before: chart?: ChartNode; table?: TableNode; tabs?: TabsNode
// After:  children: NodeDef[]  — layout.role discriminates 'chart'|'table'|'map' etc.
export interface SectionNode extends NodeBase {
  type:          'section'
  id:            string
  title:         string
  label?:        string
  anchor?:       string
  color?:        string
  data?:         DataSpec
  children:      NodeDef[]   // ← replaces chart?/table?/tabs?
  view?:         ViewParams
  prependLabel?: string
}
// chart/table children: set layout.role = 'chart' | 'table' on each child NodeDef.
// SectionShell reads children.defs[i].layout?.role for toggle visibility.
```

**Verify:** `tsc → 0`

---

## ②d — New page-level node types (TabPageNode · InnerPageNode · ContainerPageNode)

**Scope:** `engine/react/src/engine/types.ts`

```ts
// TabPageNode — page-level tab switching (≠ TabsNode which is param-driven inner tabs)
export interface TabPageNode extends NodeBase {
  type:        'tab-page'
  defaultTab?: number    // default active tab index (0 if omitted)
  children:    NodeDef[] // each child = one tab's content
}

// InnerPageNode — standard full page (chrome applied by PageLoader above)
export interface InnerPageNode extends NodeBase {
  type:     'inner-page'
  children: NodeDef[]   // order = render order (filter-bar → kpi-strip → sections → links)
}

// ContainerPageNode — generic page container (variant → shell dispatch)
// 'default' variant → ContainerLayout; 'landing' variant → LandingShell
export interface ContainerPageNode extends NodeBase {
  type:     'container-page'
  variant?: string
  children: NodeDef[]
}
```

**Verify:** `tsc → 0`

---

## ②e — SiteContext + SiteProvider + hooks

**Scope:** `engine/react/src/context/SiteContext.tsx` (verify exists or create)

```ts
interface SiteContextValue {
  stores: Record<string, DataStore>
  pages:  Record<string, PageConfigBase>
  nav:    NavItem[]
  chrome: Record<string, string>   // slot → variant key (Constructor sets)
}

export function SiteProvider({ stores, pages, nav, chrome = {}, children }) {
  return <SiteContext.Provider value={{ stores, pages, nav, chrome }}>{children}</SiteContext.Provider>
}

export const useStores     = () => useContext(SiteContext)!.stores
export const useSiteNav    = () => useContext(SiteContext)!.nav
export const useSiteChrome = () => useContext(SiteContext)!.chrome
export const useSitePages  = () => useContext(SiteContext)!.pages
export const usePageById   = (id: string) => useContext(SiteContext)!.pages[id] ?? null
```

**Verify:** `tsc → 0`

---

## ②f — resolveNodeRows() + renderNode()

**Pre-condition:** `@geostat/engine` exports `interpretSpec` — ✅ confirmed (index.ts line 141).

**Scope:** two new files in `engine/react/src/engine/`

### resolveNodeRows.ts

```ts
// engine/react/src/engine/resolveNodeRows.ts
import { interpretSpec } from '@geostat/engine'
import type { NodeBase, RenderContext, DataRow } from './types'

export function resolveNodeRows(node: NodeBase, ctx: RenderContext): DataRow[] {
  if (!node.data) return ctx.rows ?? []
  // interpretSpec(spec, sectionCtx, store: DataStore) — pass single store, not map
  const store = ctx.stores[ctx.pageStoreKey ?? Object.keys(ctx.stores)[0]]
  return interpretSpec(node.data, ctx.sectionCtx, store)
}
// node.data absent → inherit parent ctx.rows (section data flows to chart/table children)
// node.data present → fresh interpretSpec call (node overrides parent rows)
```

### renderNode.ts

```ts
// engine/react/src/engine/renderNode.ts
export function renderNode(node: NodeBase, ctx: RenderContext): ReactNode {
  const rows  = resolveNodeRows(node, ctx)
  // Phase 1: view = JSON config, no expressions. evalViewParams → Phase 2.
  const ctxR  = { ...ctx, rows, view: node.view ?? ctx.view }

  const shell = nodeRegistry.get(node.type, node.variant ?? 'default')
  if (!shell) return null   // unregistered type → nothing rendered, no crash

  const childDefs = (node as any).children ?? []   // uniform tree — no getChildFields() manifest
  const rendered  = childDefs.map((c: NodeBase) => renderNode(c, ctxR))
  const children: ChildrenArg = {
    defs:        childDefs,
    rendered,
    renderChild: (i: number) => rendered[i],  // lazy — for TabPageShell, virtual scroll
  }

  return shell(node as NodeDef, ctxR, children)
}
// Pure table lookup. Zero if/switch on node.type. Engine is agnostic.
// New type: register 1 slice → renders. No engine change.
// getChildFields() manifest → DELETE after this lands.
```

**Verify:** `tsc → 0`

---

## ②g — DEFAULT shells auto-registration

**Scope:** `engine/react/src/theme/defaults/` + `engine/react/src/index.ts`

> **Zero-brand constraint — NON-NEGOTIABLE:**
> DEFAULT shells = functional pass-throughs. Zero Geostat CSS. Zero brand.
> All visual design lives in plugins/ Geostat shells.
> engine/react/ must stay reusable by any project.

```tsx
// engine/react/src/theme/defaults/DefaultSectionShell.tsx
export const DefaultSectionShell: NodeRenderer<SectionNode> =
  (_def, _ctx, children) => <>{children.rendered}</>

// engine/react/src/theme/defaults/DefaultChartShell.tsx
export const DefaultChartShell: NodeRenderer<ChartNode> =
  (_def, _ctx, _children) => null   // chart needs library — no meaningful default

// engine/react/src/theme/defaults/DefaultTableShell.tsx
export const DefaultTableShell: NodeRenderer<TableNode> =
  (_def, ctx, _children) => (
    <table>
      {ctx.rows.map((r, i) => (
        <tr key={i}>{Object.values(r).map((v, j) => <td key={j}>{String(v)}</td>)}</tr>
      ))}
    </table>
  )

// engine/react/src/theme/defaults/DefaultFilterBarShell.tsx
export const DefaultFilterBarShell: NodeRenderer<FilterBarNode> =
  (_def, _ctx, _children) => null   // filter controls need registry — no meaningful default

// engine/react/src/theme/defaults/DefaultKpiStripShell.tsx
export const DefaultKpiStripShell: NodeRenderer<KpiStripNode> =
  (_def, _ctx, _children) => null

// engine/react/src/theme/defaults/DefaultInnerPageShell.tsx
export const DefaultInnerPageShell: NodeRenderer<InnerPageNode> =
  (_def, _ctx, children) => <main>{children.rendered}</main>

// engine/react/src/theme/defaults/DefaultTabPageShell.tsx
export const DefaultTabPageShell: NodeRenderer<TabPageNode> =
  (_def, _ctx, children) => <>{children.rendered[0]}</>
```

```ts
// engine/react/src/index.ts — auto-registration at package init
// Runs once on import. Geostat setupRegistrations.ts overrides these with branded shells.
nodeRegistry.register('section',    'default', DefaultSectionShell)
nodeRegistry.register('chart',      'default', DefaultChartShell)
nodeRegistry.register('table',      'default', DefaultTableShell)
nodeRegistry.register('filter-bar', 'default', DefaultFilterBarShell)
nodeRegistry.register('kpi-strip',  'default', DefaultKpiStripShell)
nodeRegistry.register('inner-page', 'default', DefaultInnerPageShell)
nodeRegistry.register('tab-page',   'default', DefaultTabPageShell)
// Plugin types (landing-hero, grid, etc.) have no defaults — must be registered by app.
// unregistered → renderNode returns null → nothing renders (no crash).
```

**Gap ②→⑦:** DEFAULT shells render (functional, unstyled). After ⑦ (setupRegistrations.ts):
Geostat shells override → branded render. Zero white-page during migration.

**Test isolation:** `createNodeRegistry()` creates fresh registry per test. Singleton not shared.

**Verify:** `tsc → 0` · landing page renders (DEFAULT shells) · GDP page renders (DEFAULT shells, no style)

---

## ②h — Registries + Hooks (prerequisite for ④ ⑤ ⑥)

**Scope:** `engine/react/src/engine/` — new files. All additive. Zero old code touched.

```ts
// engine/react/src/engine/chromeRegistry.ts
export class ChromeRegistry {
  private map = new Map<string, () => ReactNode>()
  register(slot: string, key: string, shell: () => ReactNode): void {
    this.map.set(`${slot}::${key}`, shell)
  }
  get(slot: string, key: string): (() => ReactNode) | undefined {
    return this.map.get(`${slot}::${key}`)
  }
}
export const chromeRegistry = new ChromeRegistry()
export const NullChromeSlot: () => ReactNode = () => null
```

```ts
// engine/react/src/engine/filterControlRegistry.ts
export interface FilterControlSlice {
  META:         FilterControlMeta
  Shell:        ComponentType<{ filterKey: string; config: unknown }>
  defaultValue: (config: unknown) => unknown
  codec:        FilterCodec<unknown>
  validate?:    (v: unknown, c: unknown) => string | null
  formatValue?: (v: unknown) => string
}
export class FilterControlRegistry {
  private map = new Map<string, FilterControlSlice>()
  register(slice: FilterControlSlice): void {
    this.map.set(slice.META.controlType, slice)
  }
  get(controlType: string): FilterControlSlice | undefined {
    return this.map.get(controlType)
  }
}
export const filterControlRegistry = new FilterControlRegistry()
```

```ts
// engine/react/src/engine/skeletonRegistry.ts
export type SkeletonFn = (def: NodeBase, ctx: RenderContext) => ReactNode
export class SkeletonRegistry {
  private map = new Map<string, SkeletonFn>()
  register(type: string, variant: string, fn: SkeletonFn): void {
    this.map.set(`${type}::${variant}`, fn)
  }
  get(type: string, variant = 'default'): SkeletonFn | undefined {
    return this.map.get(`${type}::${variant}`) ?? this.map.get(`${type}::default`)
  }
}
export const skeletonRegistry = new SkeletonRegistry()
```

```tsx
// engine/react/src/context/FilterContext.tsx  — useFilter + useFilters hooks
// useFilter: reads/writes a single filter param (URL state via FilterContext)
export function useFilter<T>(key: string): { value: T | null; set: (v: T) => void } {
  const ctx = useContext(FilterContext)!
  return {
    value: ctx.filterParams[key] as T | null ?? null,
    set:   (v) => ctx.set(key, v),
  }
}
// useFilters: bridges FilterBarNode config → runtime FilterBarSpec[] (URL state + effects)
// Full implementation: reads bars config + URL state → returns typed { bars, ctx, errors }
export function useFilters(config: FilterBarConfig): FilterBarResult { ... }
```

**Verify:** `tsc → 0` (these are pure additions — no existing code breaks)

---

## 🗂 File Moves (V-2, V-3 + data/ relocation)

> Write in final location. Update all imports. tsc → 0. Visual check.
> Do NOT create new intermediate files — move and add META.

### src/data/ → root data/

```
src/data/gdp/      → data/gdp/
src/data/accounts/ → data/accounts/
src/data/regional/ → data/regional/
```

```json
// tsconfig.json — update alias target only, import paths unchanged
{
  "paths": {
    "@data/*": ["data/*"]    // was: ["src/data/*"]
  }
}
```

All existing `import { X } from '@data/gdp/store'` imports — **unchanged**.
Only tsconfig.json paths target changes. Search-and-replace: zero.

**Why root:** data/ = first-class shared layer (Track A + Track B both import).
Signal: not app bootstrap, not feature-specific — shared infrastructure.

**Verify:** `tsc → 0`

### Landing code (V-2)

```
engine/react/src/.../LandingHero*.tsx   → plugins/landing/nodes/hero/HeroShell.tsx
engine/react/src/.../LandingStats*.tsx  → plugins/landing/nodes/stats/StatsShell.tsx
LandingHeroNode / LandingStatsNode types  → plugins/landing/types.ts
```

```ts
// plugins/landing/types.ts  — module augmentation, NOT in engine/react/
import type { NodeBase, LayoutHints, ViewParams } from '@geostat/react'

declare module '@geostat/react' {
  interface NodeTypeMap {
    'landing-hero':  LandingHeroNode
    'landing-stats': LandingStatsNode
  }
}

// Replicate CURRENT shape from engine/react/types.ts — do NOT invent new minimal interface
export interface LandingHeroNode extends NodeBase {
  type:     'landing-hero'
  title:    string
  subtitle: string
  cards:    LandingCardDef[]   // LandingCardDef also moves here from engine/react/types.ts
}
export interface LandingStatsNode extends NodeBase {
  type:        'landing-stats'
  slides:      LandingSlideItem[]
  autoplayMs?: number
}
// LandingCardDef, LandingStatItem, LandingSlideItem — also move here (they're landing-specific)
// LandingHeroNode ∈ NodeDef ✅ via NodeTypeMap augmentation — no cast, no packages/ change
```

```ts
// plugins/landing/nodes/hero/index.ts
import { HeroShell } from './HeroShell'
export { HeroShell as Shell }
export const META: NodeSliceMeta = {
  sliceType: 'node',
  type: 'landing-hero', variant: 'default',
  label: 'ჰირო სექცია', icon: 'home', category: 'landing',
  schema: { type: 'object', properties: { view: {} } },
  preview: '/previews/hero.png',
}
```

```ts
// plugins/landing/nodes/index.ts
export * as hero  from './hero'
export * as stats from './stats'
```

### Chrome code (V-3)

```
engine/react/src/components/layout/AppChrome.tsx  → plugins/chrome/AppChrome.tsx
engine/react/src/components/layout/Header.tsx     → plugins/chrome/AppHeader/default/FullHeader.tsx
engine/react/src/components/layout/Sidebar.tsx    → plugins/chrome/AppSidebar/default/ExpandedSidebar.tsx
engine/react/src/components/layout/Footer.tsx     → plugins/chrome/AppFooter/default/FullFooter.tsx
```

Add `index.ts` + `META` during move (these files become ChromeSlices):

```ts
// plugins/chrome/AppHeader/default/index.ts
import { FullHeader } from './FullHeader'
export { FullHeader as Shell }
export const META: ChromeSliceMeta = {
  slot: 'AppHeader', key: 'default',
  label: 'სრული სათაური', preview: '/previews/header-full.png',
}
```

```tsx
// plugins/chrome/AppChrome.tsx — knows specific Geostat slot names
// NOT a registrable slice — assembles slots via generic ChromeLayout
import { ChromeLayout } from '@geostat/react'

export function AppChrome({ children }: { children: ReactNode }) {
  return (
    <ChromeLayout slots={['AppHeader', 'AppBanner', 'AppSidebar', 'AppFooter']}>
      {children}
    </ChromeLayout>
  )
}
// manifest.chrome.AppHeader = 'minimal' → ChromeLayout dispatches MinimalHeader → zero code change ✅
```

**Verify:** `tsc → 0` · visual check: app still renders, nav works.

---

## ③ NodeDef Cleanup (V-6)

**Depends on:** 🗂 (landing types moved to plugins/landing/types.ts)

```ts
// engine/react/src/engine/types.ts
// ONLY change: remove LandingHeroNode | LandingStatsNode from CoreNodeDef.
// ALL other existing types stay. New page-level types added (defined in ②d).
type CoreNodeDef =
  | PageHeaderNode
  | FilterBarNode | BarNode | ParamNode   // filter bar hierarchy
  | KpiStripNode
  | RowNode
  | SectionNode
  | GeorgraphNode
  | TabsNode | TabNode                    // param-driven inner tabs
  | ChartNode | TableNode
  | LinksNode
  | InnerPageNode | TabPageNode | ContainerPageNode   // new Track A page types (②d)
  // LandingHeroNode | LandingStatsNode — REMOVED from core
  // Restored via NodeTypeMap in plugins/landing/types.ts module augmentation ✅

type NodeDef = CoreNodeDef | NodeTypeMap[keyof NodeTypeMap]
// NodeTypeMap empty → NodeDef = CoreNodeDef. Plugin augments → auto-extends. ✅
```

**Verify:** `tsc → 0` · visual check: landing page still renders.

---

## ④ Node Shells — plugins/nodes/

### Full Structure

```
plugins/nodes/
  // ── Existing NodeDef types (currently in engine/react/types.ts) ─────
  page-header/
    PageHeaderShell.tsx                                           index.ts
  filter-bar/
    FilterBarShell.tsx   FilterBarSkeleton.tsx                    index.ts
  kpi-strip/
    KpiStripShell.tsx    KpiStripSkeleton.tsx                     index.ts
  row/
    RowShell.tsx                                                  index.ts
  section/
    SectionShell.tsx     SectionSkeleton.tsx   SectionShell.css   index.ts
  tabs/
    TabsShell.tsx        TabsSkeleton.tsx                         index.ts  ← param-driven inner tabs
  tab/
    TabShell.tsx                                                  index.ts
  chart/
    ChartShell.tsx       ChartSkeleton.tsx                        index.ts
  table/
    TableShell.tsx       TableSkeleton.tsx                        index.ts
  links/
    LinksShell.tsx                                                index.ts
  georgraph/
    GeorgraphShell.tsx   GeorgraphSkeleton.tsx                    index.ts  ← Leaflet map, last in ④

  // ── New page-level types (Track A) ────────────────────────────────────
  inner-page/
    InnerPageShell.tsx                                            index.ts
  tab-page/
    TabPageShell.tsx     TabPageSkeleton.tsx                      index.ts  ← page-level tabs (≠ tabs/)
  container-page/
    default/   ContainerLayout.tsx                                index.ts
    landing/   LandingShell.tsx                                   index.ts

  // ── Future layout types (module augmentation) ─────────────────────────
  layout/
    grid/      GridShell.tsx                                      index.ts
    columns/   ColumnsShell.tsx                                   index.ts
    stack/     StackShell.tsx                                     index.ts
    card/      CardShell.tsx                                      index.ts
    types.ts   (GridNode · ColumnsNode · StackNode · CardNode — module augmentation)
    index.ts   (barrel: grid · columns · stack · card)

  index.ts   ← BARREL — add new type here in 1 line
```

> **GeorgraphNode** — ④-ის ბოლო. Leaflet + geoCodeMap + paramKey + multiSelect. სხვა Shell-ები უკვე მუშაობს. Skeleton = grey rectangle.

```ts
// plugins/nodes/index.ts — BARREL (exact content)
export * as pageHeader           from './page-header'
export * as filterBar            from './filter-bar'
export * as kpiStrip             from './kpi-strip'
export * as row                  from './row'
export * as section              from './section'
export * as tabs                 from './tabs'
export * as tab                  from './tab'
export * as chart                from './chart'
export * as table                from './table'
export * as links                from './links'
export * as georgraph            from './georgraph'
export * as innerPage            from './inner-page'
export * as tabPage              from './tab-page'
export * as containerPageDefault from './container-page/default'
export * as containerPageLanding from './container-page/landing'
export * as layout               from './layout'   // grid · columns · stack · card
// ← add new node type here (1 line)   ← DISCOVERABILITY
// Landing nodes registered separately via plugins/landing/ in setupRegistrations.ts
```

---

### SectionShell — role toggle

```tsx
// plugins/nodes/section/SectionShell.tsx
import type { SectionNode, NodeRenderer, ChildrenArg, RenderContext } from '@geostat/react'

// NodeRenderer = plain function, NOT a React component.
// All state lives in the inner component (engine calls this as a plain function).
export const SectionShell: NodeRenderer<SectionNode> =
  (def, ctx, children) => <SectionControl def={def} ctx={ctx} children={children} />

function SectionControl({ def, ctx, children }: {
  def: SectionNode; ctx: RenderContext; children: ChildrenArg
}) {
  const roles = [...new Set(
    children.defs.map(d => d.layout?.role).filter((r): r is string => !!r)
  )]
  const [activeRole, setActiveRole] = useState<string | undefined>(roles[0])
  const view = ctx.view   // engine resolved ExprVal → ResolvedViewParams before calling Shell

  return (
    <section className="section" id={def.id} data-section-id={def.id}>
      <div className="section-header">
        {view.subtitle && <p className="section-subtitle">{view.subtitle}</p>}
        {roles.length > 1 && (
          <div className="section-toggle" role="tablist">
            {roles.map(role => {
              const label = children.defs.find(d => d.layout?.role === role)?.layout?.label ?? role
              return (
                <button key={role} role="tab"
                  aria-selected={role === activeRole}
                  className={`toggle-btn${role === activeRole ? ' toggle-btn--active' : ''}`}
                  onClick={() => setActiveRole(role)}>
                  {label}
                </button>
              )
            })}
          </div>
        )}
        {view.exportable && (
          <button className="section-export" aria-label="ექსპორტი" onClick={() => alert('ექსპორტი')}>
            ↓
          </button>
        )}
      </div>
      {children.defs.map((d, i) => {
        const role    = d.layout?.role
        const visible = !role || role === activeRole
        return (
          // ALL children rendered — CSS controls visibility — no remount on toggle
          <div key={i} role="tabpanel"
            className={`section-view${visible ? ' section-view--visible' : ' section-view--hidden'}`}>
            {children.rendered[i]}
          </div>
        )
      })}
    </section>
  )
}
// role toggle rule:
//   no role → always visible
//   has role → visible only if role === activeRole
//   role = ANY open string ('chart'/'table'/'map'/'pivot') — shell never hardcodes
```

---

### ChartShell

```tsx
// plugins/nodes/chart/ChartShell.tsx
import { interpretChart } from '@geostat/engine'
import { toApexOptions }  from '@geostat/react/charts/apexAdapter'  // NOT from @geostat/engine
import type { ChartNode, NodeRenderer, ViewParams } from '@geostat/react'
import ReactApexChart from 'react-apexcharts'

export const ChartShell: NodeRenderer<ChartNode> =
  (def, ctx, _children) => {
    // ChartNode = { type:'chart', chartType } & Omit<ChartDef,'type'>
    // interpretChart expects ChartDef — restore 'type' field from chartType
    const chartDef = { ...def, type: def.chartType }
    const output   = interpretChart(chartDef, ctx.rows, ctx.sectionCtx)
    const options  = toApexOptions(output)
    // height from parent section view (ctx.view) or own def.view, fallback 320
    const view     = (ctx.view ?? def.view) as ViewParams | undefined
    const h        = typeof view?.height === 'number' ? view.height : 320
    return (
      <div className="chart-shell">
        <ReactApexChart
          type={options.chart?.type ?? 'line'}
          series={options.series as ApexAxisChartSeries}
          options={options}
          height={h}
        />
      </div>
    )
  }
// ctx.rows: DataRow[] — pre-computed by renderNode() via resolveNodeRows()
// Library swap: change toApexOptions → toEChartsOption, swap ReactApexChart — zero config change
```

---

### TableShell

```tsx
// plugins/nodes/table/TableShell.tsx
import { DataTable } from '../../_shared/DataTable'   // shared UI component (not a Shell)
import type { TableNode, NodeRenderer } from '@geostat/react'

export const TableShell: NodeRenderer<TableNode> =
  (def, ctx, _children) => (
    <DataTable
      rows={ctx.rows}
      columns={def.columns}
      colLabel={def.colLabel}
    />
  )
```

---

### KpiStripShell

```tsx
// plugins/nodes/kpi-strip/KpiStripShell.tsx
import type { KpiStripNode, NodeRenderer } from '@geostat/react'

export const KpiStripShell: NodeRenderer<KpiStripNode> =
  (def, ctx, _children) => <KpiStripControl def={def} ctx={ctx} />

function KpiStripControl({ def, ctx }) {
  // ctx.rows: DataRow[] — interpretKpis resolves each KpiSpec → value + trend
  const store = ctx.stores[ctx.pageStoreKey ?? Object.keys(ctx.stores)[0]]
  return (
    <div className="kpi-strip" role="list">
      {def.items.map(spec => (
        <KpiCard key={spec.id} spec={spec} ctx={ctx} store={store} />
      ))}
    </div>
  )
}
// Shell owns layout (grid/columns/spacing). Engine does NOT dictate KPI card count or arrangement.
```

---

### FilterBarShell — component wrapper (hooks required)

```tsx
// plugins/nodes/filter-bar/FilterBarShell.tsx
// FilterBarNode.bars: Record<string, BarDef>  ← JSON config, Constructor writes this
// FilterBarSpec[]:                             ← runtime (config + URL state via useFilters)
// Bridge: useFilters() hook — must be in a React component, not a plain NodeRenderer function.
import { useFilters, filterControlRegistry } from '@geostat/react'
import type { FilterBarNode, NodeRenderer } from '@geostat/react'

export const FilterBarShell: NodeRenderer<FilterBarNode> =
  (def, ctx, _children) => <FilterBarControl def={def} ctx={ctx} />

function FilterBarControl({ def, ctx }) {
  const { bars } = useFilters({
    bars:          def.bars,
    effects:       def.effects,
    crossValidate: def.crossValidate,
  })
  return (
    <div className="filter-bar-host">
      {bars.map(bar => (
        <div key={bar.barId} className={`filter-bar filter-bar--${bar.position}`}>
          {bar.filters.map(filter => {
            const slice = filterControlRegistry.get(filter.paramDef.type)
            if (!slice) return null
            return (
              <slice.Shell
                key={filter.key}
                filterKey={filter.key}
                config={filter.paramDef}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}
// filterControlRegistry.get() → full FilterControlSlice (Shell + codec + validate + formatValue)
// No switch/if on filter type. Pure registry dispatch.
// FilterBarShell does NOT import YearSelectShell, SelectControl, etc. — zero coupling.
```

---

### InnerPageShell

```tsx
// plugins/nodes/inner-page/InnerPageShell.tsx
import type { InnerPageNode, NodeRenderer } from '@geostat/react'

export const InnerPageShell: NodeRenderer<InnerPageNode> =
  (_def, _ctx, children) => (
    <main className="page-content">
      {children.rendered}
    </main>
  )
// ZERO chrome import. Chrome = route-level concern (Grafana/Builder.io standard).
// PageLoader (src/routes.tsx) wraps with <AppChrome> — ABOVE the content tree.
// InnerPageShell = pure content: reusable in modal/embedded/iframe contexts too.
// Phase 2: manifest.pages[id].chrome = 'compact' → PageLoader reads → zero code change.
```

---

### TabPageShell — lazy child rendering

```tsx
// plugins/nodes/tab-page/TabPageShell.tsx
import type { TabPageNode, NodeRenderer } from '@geostat/react'

export const TabPageShell: NodeRenderer<TabPageNode> =
  (def, _ctx, children) => <TabControl def={def} children={children} />

function TabControl({ def, children }) {
  const [activeTab, setActiveTab] = useState(def.defaultTab ?? 0)
  return (
    <div className="tab-page">
      <div className="tab-bar" role="tablist">
        {children.defs.map((d, i) => (
          <button key={i} role="tab"
            aria-selected={i === activeTab}
            className={`tab-btn${i === activeTab ? ' tab-btn--active' : ''}`}
            onClick={() => setActiveTab(i)}>
            {d.layout?.label ?? String(i + 1)}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {children.renderChild(activeTab)}
      </div>
    </div>
  )
}
// ZERO chrome import. Chrome = route-level (PageLoader wraps all pages uniformly).
// children.renderChild(i) — lazy: only active tab renders (no hidden DOM, no wasted fetch)
// Tab switching happens INSIDE chrome — chrome does not remount between tabs.
```

---

## ⑤ Chrome Shells — plugins/chrome/

### Full Structure

```
plugins/chrome/
  AppHeader/
    default/   FullHeader.tsx   index.ts   ← useSiteNav() · NavLink
    minimal/   MinimalHeader.tsx index.ts
    compact/   CompactHeader.tsx index.ts
  AppSidebar/
    default/   ExpandedSidebar.tsx index.ts
    collapsed/ CollapsedSidebar.tsx index.ts
    hidden/    index.ts             ← NullChromeSlot only (no .tsx file needed)
  AppFooter/
    default/   FullFooter.tsx    index.ts
    minimal/   MinimalFooter.tsx index.ts
  AppBanner/
    hidden/    index.ts             ← NullChromeSlot — banner off by default
  AppChrome.tsx                     ← NOT a registrable slice
  index.ts                          ← BARREL

  index.ts   ← BARREL (exact content):
    export * as appHeaderDefault    from './AppHeader/default'
    export * as appHeaderMinimal    from './AppHeader/minimal'
    export * as appHeaderCompact    from './AppHeader/compact'
    export * as appSidebarDefault   from './AppSidebar/default'
    export * as appSidebarCollapsed from './AppSidebar/collapsed'
    export * as appSidebarHidden    from './AppSidebar/hidden'
    export * as appFooterDefault    from './AppFooter/default'
    export * as appFooterMinimal    from './AppFooter/minimal'
    export * as appBannerHidden     from './AppBanner/hidden'
    // ← add new chrome variant here (1 line)   ← DISCOVERABILITY
```

### FullHeader.tsx — () => ReactNode, ZERO PROPS

```tsx
// plugins/chrome/AppHeader/default/FullHeader.tsx
import { useSiteNav } from '@geostat/react'
import { NavLink } from 'react-router-dom'

export function FullHeader(): ReactNode {
  const nav = useSiteNav()
  return (
    <header className="app-header" role="banner">
      <div className="header-brand">
        <img src="/logo.svg" alt="Geostat" height={36} />
      </div>
      <nav className="header-nav" aria-label="მთავარი ნავიგაცია">
        {nav.filter(n => !n.hidden).map(item => (
          <NavLink key={item.path} to={item.path}
            className={({ isActive }) =>
              `nav-link${isActive ? ' nav-link--active' : ''}`}>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
// () => ReactNode — ZERO PROPS. chromeRegistry.get(slot, key)() has no args.
// Passing props → crash. Data via hooks INSIDE the component only.
```

### Hidden variant — NullChromeSlot

```ts
// plugins/chrome/AppSidebar/hidden/index.ts
import { NullChromeSlot } from '@geostat/react'
export { NullChromeSlot as Shell }
export const META: ChromeSliceMeta = {
  slot: 'AppSidebar', key: 'hidden', label: 'გამოთიშული',
}
// manifest.chrome.AppSidebar = 'hidden'
// → chromeRegistry.get('AppSidebar','hidden') → NullChromeSlot → () => null
// No sidebar rendered. Zero code change. Pure data decision. ✅
```

---

## ⑥ Controls — plugins/controls/

### Full Structure

```
plugins/controls/
  year-select/   YearSelectShell.tsx   index.ts
  cascade/       CascadeControl.tsx    index.ts
  select/        SelectControl.tsx     index.ts
  range/         RangeControl.tsx      index.ts
  multi-select/  MultiSelectControl.tsx index.ts

  index.ts   ← BARREL (exact content):
    export * as yearSelect  from './year-select'
    export * as cascade     from './cascade'
    export * as select      from './select'
    export * as range       from './range'
    export * as multiSelect from './multi-select'
    // ← add new control type here (1 line)
```

Each control Shell resolves its own options internally via hooks.
Engine (RenderEngine.renderNode) does NOT pre-resolve paramOptions — Shell is self-contained.
Platform standard: Grafana QueryEditor / Builder.io input components fetch their own options.
Engine pre-resolution = ISP violation (engine must know `year-select` semantics → new type = engine change).

```tsx
// plugins/controls/year-select/YearSelectShell.tsx
import { useFilter } from '@geostat/react'

export function YearSelectShell({ filterKey, config }: {
  filterKey: string; config: YearSelectDef
}) {
  const { value, set } = useFilter<number>(filterKey)
  // Shell resolves year options from config — RenderEngine never touches this.
  const years = config.range
    ? Array.from({ length: config.range[1] - config.range[0] + 1 },
        (_, i) => config.range![0] + i)
    : []
  return (
    <select
      className="year-select"
      value={value ?? ''}
      onChange={e => set(parseInt(e.target.value, 10))}
      aria-label="წელი">
      {years.map(y => <option key={y} value={y}>{y}</option>)}
    </select>
  )
}
// useFilter(filterKey) reads/writes FilterContext — no onChange prop drilling.
// filterControlRegistry dispatches to this component. FilterBarShell has zero import of it.
// New control type: write Shell + codec → register. RenderEngine: zero changes. ✅
```

---

## ⑦ setupRegistrations.ts + App Restructure (V-7, V-12, V-13)

### setupRegistrations.ts

```ts
// src/setupRegistrations.ts  — the single registration hub
import * as Nodes    from '../plugins/nodes'
import * as Chrome   from '../plugins/chrome'
import * as Controls from '../plugins/controls'
import * as Landing  from '../plugins/landing/nodes'
import { registerSlice } from '@geostat/react'
import { engine } from '@geostat/engine'
import { fromSDMX } from '../data/adapters/fromSDMX'
import { HttpDataStore } from '../data/stores/HttpDataStore'

export function setupRegistrations(): void {
  // 1. Register all slices: nodes + chrome + controls + landing extensions
  ;[
    ...Object.values(Nodes),
    ...Object.values(Chrome),
    ...Object.values(Controls),
    ...Object.values(Landing),
  ].forEach(registerSlice)

  // 2. Register datasource plugins (factory, not instance — no HTTP call here)
  engine.registerDatasource({ id: 'sdmx-api', create: cfg => new HttpDataStore(cfg) })
  engine.registerDatasource({ id: 'static',   create: cfg => new StaticDataStore(cfg) })

  // 3. Register custom transform adapters
  engine.registerTransform('fromSDMX', fromSDMX)
}
```

### main.tsx — bootstrap order

```tsx
// src/main.tsx
import { setupRegistrations } from './setupRegistrations'
import { fetchSiteManifest }  from './manifest'
import { applyTokens }        from '@geostat/react'
import { engine }             from '@geostat/engine'

async function boot() {
  setupRegistrations()                                     // 1. register all plugins
  const manifest = await fetchSiteManifest()               // 2. GET /api/site (or static Phase 1)
  const stores   = engine.buildStoreManifest(              // 3. factory.create() per config — no HTTP
                     manifest.datasources)
  applyTokens(manifest.tokens ?? {})                       // 4. CSS vars before render — no FOUC
  createRoot(document.getElementById('root')!).render(
    <App manifest={{ ...manifest, stores }} />             // 5. React mounts
  )
}
boot()
// Data fetch: LAZY — Suspense throws Promise on first store.query() → shows Skeleton
```

### App.tsx restructure (V-13)

```tsx
// src/App.tsx
import { SiteProvider } from '@geostat/react'

export function App({ manifest }: { manifest: SiteManifest & { stores: Record<string, DataStore> } }) {
  return (
    <SiteProvider
      stores={manifest.stores}
      pages={manifest.pages}
      nav={manifest.nav}
      chrome={manifest.chrome ?? {}}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </SiteProvider>
  )
}
// No ThemeProvider wrapper — ThemeConfig = skeletons only; shells in registries.
// No Layout wrapper — AppChrome applied by PageLoader in routes.tsx (route-level concern).
```

### routes.tsx — dynamic routes (V-12 fix)

Chrome applied HERE — above the content tree (Grafana/Builder.io standard).
InnerPageShell/TabPageShell = zero chrome knowledge. Reusable in any context.
Phase 2: `manifest.pages[id].chrome = 'compact'` → PageLoader reads → zero code change.

```tsx
// src/routes.tsx
import { AppChrome } from '../plugins/chrome/AppChrome'   // src/ → plugins/ is allowed

export function AppRoutes() {
  const pages = useSitePages()
  return (
    <Routes>
      {/* Track A — auto-generated from manifest.pages */}
      {Object.entries(pages).map(([id, page]) => (
        <Route key={id}
          path={(page as any).path ?? `/${id}`}
          element={<PageLoader pageId={id} />} />
      ))}
      {/* Track B — developer-owned, no JSON constraint */}
      {/* <Route path="/custom-report" element={<CustomReportPage />} /> */}
    </Routes>
  )
}

function PageLoader({ pageId }: { pageId: string }) {
  const page   = usePageById(pageId)  // from SiteProvider
  const stores = useStores()          // from SiteProvider
  if (!page) return null

  const ctx: RenderContext = {
    stores,
    pageStoreKey: (page as any).defaultStore ?? Object.keys(stores)[0],
    rows:  [],   // root node: no inherited rows — resolveNodeRows starts fresh per node.data
    scope: {},
  }

  return (
    <AppChrome>
      {renderNode(page.root, ctx)}
    </AppChrome>
  )
}
// import { renderNode } from '@geostat/react'     — free function, NOT class method
// import { AppChrome  } from '../plugins/chrome/AppChrome'
// AppChrome (plugins/chrome/) = Geostat slot assembler. NOT a RegistrableSlice.
// Constructor adds page → manifest.pages → Route appears → chrome applied automatically.
// routes.tsx: zero changes between pages. ✅
```

### Nav — out of PageConfig (V-12)

```ts
// src/data/nav.config.ts  — NavItem[] independent of PageConfig
export const NAV: NavItem[] = [
  { label: 'მშპ',               icon: 'bar-chart', path: '/gdp',      pageId: 'gdp'      },
  { label: 'ეროვნული ანგარიში', icon: 'table',     path: '/accounts', pageId: 'accounts' },
  { label: 'რეგიონული',         icon: 'pin',       path: '/regional', pageId: 'regional' },
]
// Used in: src/manifest.ts → Phase 1 manifest → SiteProvider → useSiteNav()
// Phase 2: nav comes from DB via fetchSiteManifest() — this file is deleted.
```

### engine.extend() fix (V-7)

```ts
// src/setupEngine.ts (or wherever engine.extend is called)
// Before: engine.extend(nodeRegistry, slotRegistry)
engine.extend(nodeRegistry)   // single arg — SlotRegistry removed (Agreement #18)
```

**Verify:** `tsc → 0` · all pages render · nav links correct · URL state preserved.

---

## ⑧ Renderers → DELETE (V-4, V-5)

Logic has moved: data resolution → `renderNode()`, presentation → Shells in `plugins/`.
Old `engine/react/src/engine/renderers/` files become dead code after ⑦.

```
DELETE: engine/react/src/engine/renderers/SectionRenderer.tsx
DELETE: engine/react/src/engine/renderers/ChartRenderer.tsx
DELETE: engine/react/src/engine/renderers/TableRenderer.tsx
DELETE: engine/react/src/engine/renderers/KpiStripRenderer.tsx
DELETE: engine/react/src/engine/renderers/FilterBarRenderer.tsx
DELETE: engine/react/src/components/SectionBlock.tsx    (logic → SectionShell)
DELETE: engine/react/src/components/KpiStrip.tsx        (logic → KpiStripShell)

// RenderEngine paramOptions block — DELETE these lines from RenderEngine.renderNode():
//   if (nodeType === 'year-select') { paramOptions = resolveYears(...) }
//   if (nodeType === 'select')      { paramOptions = resolveOptions(...) }
//   if (nodeType === 'chip-select') { paramOptions = resolveOptions(...) }
// After: YearSelectShell / SelectControl resolve their own options internally.
// Engine: zero knowledge of filter control semantics. ✅
```

**After each delete:** `tsc → 0`. If error — update the one call site that referenced it.

---

## 🗑 Full Cleanup (V-8, V-9, V-10)

```
DELETE: engine/react/src/engine/slotRegistry.ts
DELETE: engine/react/src/engine/wrappers/FilterBarWrapper.tsx
DELETE: engine/react/src/engine/wrappers/SectionsWrapper.tsx
DELETE: renderSlots() function — every call site replaced with free renderNode() from '@geostat/react'
DELETE: src/app/setupEngine.ts (if empty after V-7 fix — engine.extend → single location)
```

Final: `tsc → 0` · `npm run build → 0 errors` · full regression check.

---

## Verification Checklist (per step)

```
□ npx tsc --noEmit → 0 errors
□ Landing page renders
□ GDP: filter bar sticky · chart/table toggle · KPI strip
□ Accounts: tab navigation · section content · filter cascade
□ Regional: map/chart · filter bar
□ Chrome: header · sidebar · footer visible · nav links correct
□ URL state: filter change → URL updates → reload → same state
□ Constructor test: JSON.parse(JSON.stringify(pageConfig)) === pageConfig ✅
□ New chrome variant: manifest.chrome.AppHeader = 'minimal' → MinimalHeader renders
□ New node type: register 1 slice → appears in palette → Constructor adds to page ✅
```