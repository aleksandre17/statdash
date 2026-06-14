# @geostat/react — React Adapter

> Zero app content. Zero Geostat identity. Reusable on any project.
> Public API defined in Agreement #19.

---

## Package Location

```
engine/react/
  src/
    engine/
      types.ts                    — NodeBase · LayoutHints · ChildrenArg · NodeRenderer
                                    RenderContext · NodeDef union (built-ins only)
                                    PageConfigBase · InnerPageNode · TabPageNode · ContainerPageNode
                                    ThemeConfig · ShellMap · all shell prop interfaces
                                    NodeRegistryMeta (Constructor metadata interface)
      nodeRegistry.ts             — NodeRegistry {
                                      register<T>(type, renderer, meta?: NodeRegistryMeta)
                                      list(): Array<{ type: string } & Partial<NodeRegistryMeta>>
                                      getSchema(type: string): object | null
                                    }
      evalViewParams.ts           — evalViewParams(view, scope): ResolvedViewParams
      renderNode.ts               — renderNode(node, ctx): ReactNode  ← engine entry point
      renderers/
        SectionRenderer.tsx       → ctx.theme.shells['section']
        ChartRenderer.tsx         → ctx.theme.shells['chart']
        TableRenderer.tsx         → ctx.theme.shells['table']
        FilterBarRenderer.tsx     → ctx.theme.shells['filter-bar']
        KpiStripRenderer.tsx      → ctx.theme.shells['kpi-strip']
        InnerPageRenderer.tsx     → ctx.theme.shells['inner-page']
        TabPageRenderer.tsx       → ctx.theme.shells['tab-page']
        ContainerPageRenderer.tsx → ctx.theme.shells['container-page']

    theme/
      ThemeContext.tsx             — ThemeProvider · useTheme()
      DEFAULT_THEME.ts             — default shells + chrome (new project works immediately)
      defaults/
        Default*Shell.tsx          — minimal, brand-free, functional

    filters/
      defineFilters.ts             — pure schema builder (no hooks, JSON-in)
      useFilters.ts                — hook → FiltersResult (URL state)
      FilterProvider.tsx
      useFilter.ts
      useStoreQuery.ts             — useStoreQuery(stores, storeId, spec): { data, isLoading }
      types.ts                     — FilterBarSpec · ParamDef · FiltersResult · FilterSchema

    page/
      SiteRenderer.tsx             — useTheme() + useStores() + useFilters() → baseCtx
      PageLoader.tsx               — usePageById(pageId) → SiteRenderer

    context/
      SiteContext.tsx              — SiteProvider · useStores() · useSiteNav() · usePageById()

  index.ts   ← Agreement #19 Public API
```

---

## Public API (Agreement #19)

```ts
// Tier 1: Type contracts
export type { ThemeConfig, ShellMap }
export type { SectionShellProps, FilterBarShellProps, ChartShellProps,
              TableShellProps, KpiCardProps, PageShellProps }
export type { NodeRenderer, ChildrenArg }
export type { NodeBase, NodeDef, SectionNode, ChartNode, FilterBarNode,
              InnerPageNode, TabPageNode, ContainerPageNode, PageConfigBase }
export type { RenderContext }
export type { NavItem, NavSubItem, NavIconKey }
export type { DimensionMeta, IndicatorMeta, DatasetEntry }   // Constructor catalog API

// Tier 2: Values
export { DEFAULT_THEME }
export { engine, nodeRegistry }
//
//   nodeRegistry: NodeRegistry — open registry (Grafana plugin pattern)
//     .register(type, renderer, meta?)  — one call = rendering + Constructor sees it
//     .get(type)                        — engine dispatch: renderNode() calls this
//     .getMeta(type)                    — Constructor introspection
//     .getSchema(type)                  — Constructor form UI (undefined → JSON editor)
//     .list()                           — Constructor palette: all types + meta
//
//   engine: EngineInstance — singleton
//     .extend(registry)                 — wire engine to NodeRegistry (setupEngine once)
//     .extendSpec(type, resolver)       — register custom DataSpec type (open extension)
//     .registerTransform(key, fn)       — register named parse fn (DataSpec.transform)
//     .listTransforms()                 — Constructor transform dropdown
//     .renderNode(root, ctx)            — main entry: sync, full tree render
//
//   SpecResolver  = (spec: Record<string,unknown>, ctx: RenderContext) => DataRow[]
//   TransformFn   = (raw: unknown) => DataRow[]
//   Both open-input — extension points, not closed to built-in shapes.
export type { NodeRegistryMeta }
//   Full interface (H-4):
//   interface NodeRegistryMeta {
//     label?:    string           — human name in Constructor palette
//     icon?:     string           — icon key in Constructor palette
//     category?: string           — grouping ('layout' | 'data' | 'display' | ...)
//     variants?: string[]         — derived from component constant (e.g. SECTION_VARIANTS)
//     schema?:   Record<string, unknown>  — JSON Schema for Constructor form rendering
//     preview?:  string           — palette tile image URL (Constructor only)
//   }
//   Variants rule: component exports SECTION_VARIANTS = ['card','panel'] as const
//                  registry imports it → no drift between CSS and Constructor picker

// Tier 3: Components + Hooks
export { ThemeProvider, useTheme }
export { SiteRenderer, PageLoader }
export { SiteProvider, useStores, useSiteNav, usePageById }
export { useStoreQuery }
//   Imperative data path — third path (for components that need reactive loading state).
//   Interface contract (I-7):
//
//   function useStoreQuery(
//     stores:  Record<string, DataStore>,
//     storeId: string,
//     spec:    DataSpec,
//   ): { data: DataRow[]; isLoading: boolean; error?: Error }
//
//   Implementation strategy — store decides sync vs async:
//     StaticDataStore.query() → sync → data immediately, isLoading: false
//     HttpDataStore.query()  → cache hit: sync. Cache miss: suspends internally,
//                              hook catches the thrown Promise → isLoading: true
//                              → refetches → resolves → isLoading: false, data ready
//
//   engine/react/ does NOT mandate a specific caching library (no TanStack Query,
//   no SWR import). The hook wraps store.query() with React state.
//   App can swap the internal implementation — call site never changes.

// Tier 4: Filter API
export { defineFilters }           // pure schema builder
export { useFilters }              // hook — reads URL state
export { FilterProvider, useFilter }
export type { FilterBarSpec, ParamDef, FiltersResult, FilterSchema }
export type { FlatFilters }        // FlatFilters<B> = UnionToIntersection<B[keyof B]['filters']>
```

---

## Key Rules

```
✅ Zero app content — no Geostat brand, no src/ imports
✅ All renderers use ctx.theme.shells['type'] — never direct import
✅ NodeDef union = built-ins only (LandingHeroNode etc → src/)
✅ NodeRegistry T extends { type: string } — open for app types
✅ DEFAULT_THEME shipped — new project works with zero config
✅ defineFilters pure, useFilters hook — separate concerns
✅ SiteProvider: { stores, pages, nav } — three independent concerns
✅ NodeRegistryMeta optional — schema-less: JSON editor; schema: form UI (Constructor)
✅ nodeRegistry.list() — Constructor type picker; getSchema() — Constructor form render
```

---

## What Is NOT in engine/react/

```
❌ GEOSTAT_THEME             → src/app/theme.ts
❌ GeostatSectionShell       → src/components/theme/
❌ AppChrome (Geostat-specific) → src/components/layout/
❌ LandingHeroNode           → src/features/landing/types.ts
❌ GDP / Accounts page config → src/features/
❌ DataStore instances        → src/data/
❌ nav.config.ts             → src/data/
```
