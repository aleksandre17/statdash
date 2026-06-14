# Migration — Key Types & NodeRegistry

> Canonical type definitions for the new architecture.
> Source: `engine/react/src/engine/types.ts` (target state)

---

## NodeBase

```ts
export interface NodeBase {
  type:         string
  id?:          string
  variant?:     string
  visibleWhen?: Expr
  enabledWhen?: Expr
  layout?:      LayoutHints    // { role?, label?, span?, position?, order? }
  derive?:      NodeDeriveMap
  data?:        DataSpec
  view?:        ViewParams
  storeKey?:    string         // CSS cascade: nearest ancestor → ctx.pageStoreKey
  navLabel?:    LocaleString   // opt-in TOC registration
}
```

## NodeTypeMap + NodeDef

```ts
// Plugin extensibility (Builder.io module augmentation pattern)
export interface NodeTypeMap {}
// plugins augment:
//   declare module '@geostat/react' { interface NodeTypeMap { 'hero': HeroNode } }

type CoreNodeDef =
  | PageHeaderNode | FilterBarNode | BarNode | ParamNode | KpiStripNode | RowNode
  | SectionNode | GeorgraphNode | TabsNode | TabNode | ChartNode | TableNode | LinksNode
  | InnerPageNode | TabPageNode | ContainerPageNode

type NodeDef = CoreNodeDef | NodeTypeMap[keyof NodeTypeMap]
```

## ChildrenArg + NodeRenderer

```ts
type ChildrenArg = {
  defs:        NodeDef[]
  rendered:    ReactNode[]
  renderChild: (i: number) => ReactNode   // lazy — TabPageShell renders only active tab
  // visibleWhen=false children EXCLUDED — shell never sees null
}

// NodeRenderer — plain function, NOT a React component
type NodeRenderer<T extends { type: string } = { type: string }> =
  (def: T, ctx: RenderContext, children: ChildrenArg) => ReactNode
```

## RenderContext — canonical

```ts
// ❌ DEPRECATED: sectionCtx · filterParams · set · timeModeKey · effects · color · store(singular)
// ❌ DEPRECATED: fmt (function in data ctx = SRP violation — use useFmt() hook)

interface RenderContext {
  theme:          ThemeConfig
  stores:         Record<string, DataStore>
  dims:           Record<string, DimVal>
  derived:        Record<string, DimVal>
  rows:           DataRow[]
  view:           ResolvedViewParams        // NEVER raw ViewParams
  scope:          ExprScope                 // { dims, derived, rows } — evalExpr shortcut
  pageStoreKey?:  string
  dimContracts:   Record<string, DimContract>
  locale:         string                    // 'ka' | 'en' — cascades entire tree
  fallbackLocale: string                    // from manifest.i18n.fallbackLocale
  classifiers:    Record<string, Classifier>  // pre-extracted by renderNode step 3
  display:        Record<string, DisplayMap>  // pre-extracted by renderNode step 3
}
// classifiers + display: CSS cascade — nearest ancestor store wins (storeKey cascade)
// renderNode step 3 extracts from resolved store → injects into ctx for all descendants
```

## PageConfigBase

```ts
// ❌ DEPRECATED: PageConfigBase.root: NodeDef — page IS the root (extends NodeBase)
// ❌ DEPRECATED: PageConfigBase.defaultStore — use storeKey (from NodeBase)

export interface PageConfigBase extends NodeBase {
  id:             string
  type:           string           // 'inner-page' | 'tab-page' | 'container-page'
  title:          LocaleString
  path?:          string
  color?:         string
  filterSchema?:  FilterSchemaInput
}
```

## Page-level nodes

```ts
export interface InnerPageNode     extends NodeBase { type: 'inner-page';     children: NodeDef[] }
export interface TabPageNode       extends NodeBase { type: 'tab-page';       defaultTab?: number; children: NodeDef[] }
export interface ContainerPageNode extends NodeBase { type: 'container-page'; children: NodeDef[] }
```

## FilterBarNode — display-only

```ts
// ❌ DEPRECATED: FilterBarNode { bars: Record<string, BarDef> } — schema inside node
// ✅ CANONICAL: display placeholder only. Schema → PageConfigBase.filterSchema.

export interface FilterBarNode extends NodeBase {
  type:    'filter-bar'
  barIds?: string[]   // absent → all bars from filterSchema. present → named subset only.
}
```

## SectionNode (BLOCKER 4 fix)

```ts
export interface SectionNode extends NodeBase {
  type:          'section'
  id:            string
  title:         LocaleString
  label?:        LocaleString
  anchor?:       string
  color?:        string
  data?:         DataSpec
  children:      NodeDef[]    // chart/table/tabs as children with layout.role
  view?:         ViewParams
  prependLabel?: LocaleString
}
```

## Slice META types

```ts
interface NodeSliceMeta {
  sliceType: 'node'
  type:      string
  variant?:  string
  label:     string
  icon?:     string
  category?: string
  schema?:   object
  preview?:  string
  i18n?: {
    [locale: string]: Record<string, string>
    // { ka: { export: 'ექსპორტი' }, en: { export: 'Export' } }
  }
}
interface ChromeSliceMeta {
  sliceType: 'chrome'
  slot:      string
  key:       string
  label:     string
  preview?:  string
}
interface FilterControlMeta {
  sliceType:   'control'
  controlType: string
  label:       string
  category?:   string
}
// New slice type → add sliceType discriminant → add case in registerSlice → zero breakage
```

## NodeRegistry Update — ① (V-1 fix)

```ts
class NodeRegistry {
  register<T extends { type: string }>(   // V-1: was T extends NodeDef (too narrow)
    type:     string,
    variant:  string,
    renderer: NodeRenderer<T>,
    opts?:    {
      children?: readonly string[]  // transition — deleted in ⑧
      label?: string; icon?: string; category?: string; schema?: object; preview?: string
    },
  ): this {
    this.map.set(`${type}::${variant}`, renderer as NodeRenderer)
    if (opts?.children?.length) this.childMap.set(type, opts.children)
    if (opts) this.metaMap.set(`${type}::${variant}`, opts)
    return this
  }

  get(type: string, variant = 'default'): NodeRenderer | undefined {
    return this.map.get(`${type}::${variant}`) ?? this.map.get(`${type}::default`)
  }
  // Old render(node, ctx, children: ReactNode) stays — deleted in ⑧
  // getChildFields() stays — deleted in ⑧ after renderNode() takes over
}
```

## Plugin Anatomy — RegistrableSlice Standard

### NodeSlice
```
plugins/nodes/{type}/
  {Type}Shell.tsx    — NodeRenderer<T>
  {Type}Skeleton.tsx — SkeletonFn
  {Type}Shell.css    — token-driven CSS
  index.ts           — exports Shell · Skeleton · META
```

### ChromeSlice
```
plugins/chrome/{Slot}/{variant}/
  {Name}.tsx  — () => ReactNode — ZERO PROPS
  index.ts    — exports Shell · META
```

### ControlSlice
```
plugins/controls/{type}/
  {Name}Shell.tsx — ComponentType<{ filterKey: string; config: C }>
  index.ts        — exports Shell · META · defaultValue · codec · validate? · formatValue?
```

## What "Implemented" Means

```
node type ✅:
  □ Interface in types.ts or module augmentation
  □ Shell.tsx + Skeleton.tsx + META + index.ts in plugins/nodes/{type}/
  □ Registered in plugins/nodes/index.ts barrel
  □ setupRegistrations dispatches via registerSlice

filter control ✅:
  □ Shell.tsx + META + codec + defaultValue + validate? in plugins/controls/{type}/
  □ Registered in plugins/controls/index.ts barrel

DataSpec type ✅:
  □ Type in all-types.ts
  □ SpecResolver in engine/core/src/data/spec.ts
  □ Registered in defaultRegistry
  □ Unit test: interpretSpec({ type: '...' }, ctx) → InterpretResult
```