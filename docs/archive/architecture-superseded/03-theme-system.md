# Theme System

> Grafana ThemeContext pattern. ThemeConfig = skeletons only. Shells/Chrome → registries.

---

## ThemeConfig — სრული სტრუქტურა

> **⚠️ DEPRECATED — `AppHeader/AppSidebar/AppFooter/shells` fields in ThemeConfig**
> ახალი canonical: examples/theme-config.md:4-6, :11, :415-423.
> `ThemeConfig no longer contains shells or chrome (moved to registries).`
> shells → `nodeRegistry.register(type, variant, Shell)` (setupRegistrations.ts)
> chrome → `chromeRegistry.register(slot, key, Shell)` (setupRegistrations.ts)
> ThemeConfig = **skeletons only**.

```ts
// ❌ DEPRECATED — AppHeader/AppSidebar/AppFooter + shells in ThemeConfig
// interface ThemeConfig {
//   AppHeader:  () => ReactNode   // → chromeRegistry.register('AppHeader', 'default', X)
//   AppSidebar: () => ReactNode   // → chromeRegistry.register('AppSidebar', 'default', X)
//   AppFooter:  () => ReactNode   // → chromeRegistry.register('AppFooter', 'default', X)
//   shells: ShellMap              // → nodeRegistry.register(type, variant, X)
//   skeletons?: SkeletonMap       // ✅ STAYS
// }

// ✅ CANONICAL — ThemeConfig = skeletons only
interface ThemeConfig {
  skeletons?: SkeletonMap
}

// ❌ DEPRECATED — ShellMap type (shells not in ThemeConfig anymore)
// type ShellMap = { 'section'?: ..., 'chart'?: ..., ... } & Record<string, ...>

```

```ts
// ✅ CANONICAL — skeletons only
```

type ShellMap = {
  'section'?:         (props: SectionShellProps)              => ReactNode
  'chart'?:           (props: ChartShellProps)                => ReactNode
  'table'?:           (props: TableShellProps)                => ReactNode
  'filter-bar'?:      (props: FilterBarShellProps)            => ReactNode
  'kpi-strip'?:       (props: KpiStripShellProps)             => ReactNode
  'inner-page'?:      (props: PageShellProps<InnerPageNode>)  => ReactNode
  'tab-page'?:        (props: PageShellProps<TabPageNode>)    => ReactNode
  'container-page'?:  (props: PageShellProps<ContainerPageNode>) => ReactNode
  // app-specific: 'landing-page', 'custom-widget', etc. — open
} & Record<string, (props: any) => ReactNode>

// SkeletonContext — passed to every SkeletonFn by engine (Grafana: panel receives dimensions)
interface SkeletonContext {
  type:    string        // node.type
  layout?: LayoutHints   // layout.span / layout.position — skeleton adapts to node size
}

type SkeletonFn = (ctx: SkeletonContext) => ReactNode

// ThemeConfig.skeletons = brand override layer only.
// Per-type defaults live in NodeRegistryMeta.skeleton (registered alongside the renderer).
// New node type added via Constructor → skeleton registered once with nodeRegistry.register().
// GEOSTAT_THEME.skeletons overrides only when brand treatment differs from the default.
type SkeletonMap = {
  'section'?:    SkeletonFn   // e.g. (ctx) => <GeostatSectionSkeleton span={ctx.layout?.span} />
  'chart'?:      SkeletonFn   // branded chart shimmer
  'table'?:      SkeletonFn   // branded table shimmer
  'filter-bar'?: SkeletonFn   // branded pill placeholders
  'kpi-strip'?:  SkeletonFn   // branded KPI card placeholders
} & Record<string, SkeletonFn>   // open: app-specific types ('landing-page', etc.)
```

---

## Shell Props

```ts
// Component shells
interface SectionShellProps {
  def:      SectionNode
  children: ChildrenArg        // role-based: defs[i].layout.role = 'chart' | 'table'
  view:     ResolvedViewParams // resolved by engine (step 4) — never read def.view directly
}

// J-2: ChartShellProps — ISP: shell receives computed output, not raw context
// Grafana PanelPlugin: shell gets PanelData (resolved IR), never queries the datasource.
// Shell MUST NOT call interpretSpec. ctx is not passed — hooks provide what's needed.
interface ChartShellProps {
  def:    ChartNode
  output: ChartOutput    // interpretChart() result — library-agnostic IR
  // need theme? → useTheme() hook inside shell
  // need dims?  → useFilter().state inside shell (read-only)
}

interface TableShellProps {
  def:  TableNode
  rows: DataRow[]              // ISP: shell gets data, not full context
  view: ResolvedViewParams     // same pattern as SectionShellProps — exportable, subtitle etc.
}

// J-3: FilterBarShellProps — WHY bars: FilterBarSpec[], not ChildrenArg
//
// FilterBar is the ONE exception to ChildrenArg — here is why:
//   ChildrenArg = { defs: NodeDef[], rendered: ReactNode[] }
//               — for children that go through engine.renderNode()
//
//   ParamDef items are NOT NodeDef. They are not rendered by engine dispatch.
//   Filter controls are rendered by filterControlRegistry (separate registry).
//   Shell calls FilterControl component, not engine.renderNode().
//
//   bars: FilterBarSpec[] = pre-resolved runtime shape (values + options + errors)
//   Shell maps bars → filter controls via registerFilterControl() registry.
//   No engine dispatch. No ChildrenArg.
interface FilterBarShellProps {
  def:  FilterBarNode
  bars: FilterBarSpec[]   // resolved: values + control definitions + validation errors
}

// KpiStripShell — shell receives ALL rows, iterates internally (ONS: strip = visual group)
// Shell has full layout control. Renderer passes ctx.rows once — not per-card dispatch.
interface KpiStripShellProps {
  def:  KpiStripNode
  rows: DataRow[]              // one DataRow per indicator — shell maps over them
  view: ResolvedViewParams
}
// KpiCardProps — internal helper, used INSIDE the shell when iterating rows.
// Not in ShellMap. Shell: rows.map(row => <KpiCard row={row} />)
interface KpiCardProps {
  row: DataRow   // row['indicator'], row['value'], row['label'], row['pct'], etc.
}

// Page shells — all receive ChildrenArg
interface PageShellProps<T extends PageConfigBase = PageConfigBase> {
  def:      T
  children: ChildrenArg  // { defs: NodeDef[], rendered: ReactNode[] }
  // tab-page:       children.defs[i].layout.label = tab header
  // container-page: children.defs[i].layout.span  = column span
  // inner-page:     children.rendered = page content sections
}
```

---

## Shell Access Pattern

> **⚠️ DEPRECATED — `ctx.theme.shells[type]` dispatch**
> ახალი canonical: `nodeRegistry.get(type, variant)` in `renderNode()`.
> examples/theme-config.md:415 — ❌ `ThemeConfig.shells` (old pattern — pre-registry migration).
> examples/theme-config.md:418 — ✅ `nodeRegistry.register(type, variant, X)`.

```ts
// ❌ DEPRECATED — ctx.theme.shells dispatch
// function SectionRenderer(def, ctx, children): ReactNode {
//   const Shell = ctx.theme.shells['section'] ?? DEFAULT_THEME.shells['section']!
//   return <Shell def={def} children={children} view={ctx.view} />
// }

// ✅ CANONICAL — renderNode() via nodeRegistry (migrate.md → ②f)
export function renderNode(node: NodeBase, ctx: RenderContext): ReactNode {
  const shell = nodeRegistry.get(node.type, node.variant ?? 'default')
  if (!shell) return null
  const childDefs = (node as any).children ?? []
  const rendered  = childDefs.map((c: NodeBase) => renderNode(c, ctx))
  const children: ChildrenArg = { defs: childDefs, rendered, renderChild: (i) => rendered[i] }
  return shell(node as NodeDef, ctx, children)
  // Zero if/switch. New type = register 1 slice. ✅
}
```

---

## ThemeProvider + useTheme — bridge pattern

> **⚠️ DEPRECATED — useTheme() bridging shells into ctx.theme**
> ThemeConfig-ს shells აღარ აქვს. ctx.theme = skeletons only.
> Shell dispatch = nodeRegistry (not ctx.theme). Bridge for shells = no longer needed.

```ts
// ❌ DEPRECATED — useTheme() for shell dispatch
// function SiteRenderer({ def }) {
//   const theme = useTheme()   // ← shells in theme (old)
//   const baseCtx = { theme, ... }
//   return engine.renderNode(def, baseCtx)
//   // ctx.theme.shells['section'](...) — DEPRECATED
// }

// ✅ CANONICAL — ThemeProvider still needed for skeletons only
// <ThemeProvider theme={GEOSTAT_THEME}> → ctx.theme.skeletons?.[type] — skeleton brand override
// Shell dispatch: nodeRegistry.get(type, variant) — no theme needed
```

---

## DEFAULT_THEME — new project works immediately

> **⚠️ DEPRECATED — DEFAULT_THEME with AppHeader/AppSidebar/AppFooter/shells**
> ახალი canonical: DEFAULT_THEME = skeletons only (empty object).
> Shells registered via `nodeRegistry.register(type, 'default', DefaultShell)` in engine/react init.
> Chrome registered via `chromeRegistry.register(slot, 'default', DefaultShell)` in engine/react init.

```ts
// ❌ DEPRECATED — shells + chrome in DEFAULT_THEME
// export const DEFAULT_THEME: ThemeConfig = {
//   AppHeader:  DefaultAppHeader,
//   AppSidebar: DefaultAppSidebar,
//   AppFooter:  DefaultAppFooter,
//   shells: { 'section': DefaultSectionShell, 'chart': DefaultChartShell, ... },
// }

// ✅ CANONICAL — DEFAULT_THEME = skeletons only
export const DEFAULT_THEME: ThemeConfig = {
  // skeletons omitted → falls through to nodeRegistry.getMeta(type)?.skeleton, then generic div
  // DEFAULT_THEME intentionally has no skeletons: type defaults registered with each node renderer
}

// Default shells auto-registered at engine/react init (migrate.md → ②g):
// nodeRegistry.register('section',        'default', DefaultSectionShell)
// nodeRegistry.register('chart',          'default', DefaultChartShell)
// nodeRegistry.register('table',          'default', DefaultTableShell)
// nodeRegistry.register('filter-bar',     'default', DefaultFilterBarShell)
// nodeRegistry.register('kpi-strip',      'default', DefaultKpiCard)
// nodeRegistry.register('inner-page',     'default', DefaultInnerPageShell)
// nodeRegistry.register('tab-page',       'default', DefaultTabPageShell)
// nodeRegistry.register('container-page', 'default', DefaultContainerPageShell)
// App overrides: setupRegistrations.ts re-registers with Geostat shells → replaces defaults ✅
```

---

## GEOSTAT_THEME — app override

> **⚠️ DEPRECATED — GEOSTAT_THEME with shells + chrome**
> ახალი canonical: GEOSTAT_THEME = skeletons only. Shells/chrome → setupRegistrations.ts.
> examples/theme-config.md:270 — `GEOSTAT_THEME = mergeTheme(DEFAULT_THEME, { skeletons: { ... } })`.

```ts
// ❌ DEPRECATED — shells + chrome in GEOSTAT_THEME
// export const GEOSTAT_THEME: ThemeConfig = {
//   AppHeader:  GeostatAppHeader,   // → chromeRegistry.register('AppHeader', 'default', GeostatAppHeader)
//   AppSidebar: GeostatAppSidebar,  // → chromeRegistry.register('AppSidebar', 'default', GeostatAppSidebar)
//   AppFooter:  GeostatAppFooter,   // → chromeRegistry.register('AppFooter', 'default', GeostatAppFooter)
//   shells: { 'section': GeostatSectionShell, ... }  // → nodeRegistry.register(type, 'default', Shell)
// }

// ✅ CANONICAL — GEOSTAT_THEME = skeletons only (examples/theme-config.md:270)
export const GEOSTAT_THEME: ThemeConfig = mergeTheme(DEFAULT_THEME, {
  skeletons: {
    'kpi-strip': (_ctx) => KpiStripSkeleton(),
    // brand-specific skeleton overrides only — other types use nodeRegistry defaults
  },
})
// Shells + chrome: registered in src/setupRegistrations.ts via registerSlice()
```

---

## Per-Page Override — scoped shell override

> **⚠️ DEPRECATED — nested ThemeProvider for shell override**
> ThemeConfig-ს shells აღარ აქვს. Nested ThemeProvider for shells = TypeScript error.
> examples/theme-config.md:434 — ❌ Nested ThemeProvider for scoped shell override.
> examples/theme-config.md:439 — ✅ `<ShellOverrideProvider shells={{ 'section/default': PrintShell }}>`.

```tsx
// ❌ DEPRECATED — nested ThemeProvider with shells
// <ThemeProvider theme={{ ...GEOSTAT_THEME, shells: { 'section': LandingAlternateShell } }}>
//   <LandingPageRenderer ... />
// </ThemeProvider>
// → shells not in ThemeConfig anymore — TypeScript error

// ✅ CANONICAL — ShellOverrideProvider (examples/theme-config.md:379)
<ShellOverrideProvider shells={{ 'section/default': PrintSectionShell }}>
  <PageLoader pageId={pageId} />
</ShellOverrideProvider>
// No global nodeRegistry mutation. No ThemeProvider nesting. Scoped to subtree. ✅
```

---

## Chrome Components — zero props, reads context

```tsx
// GeostatAppHeader — () => ReactNode, no props
function GeostatAppHeader() {
  const nav        = useSiteNav()              // NavItem[] from SiteProvider
  const { pathname } = useLocation()           // React Router
  const activeItem = nav.find(n => pathname.startsWith(n.path))
  return (
    <header className="app-header">
      <nav>
        {nav.filter(n => !n.hidden).map(item => (
          <a key={item.path} href={item.path}
             className={item === activeItem ? 'active' : ''}>
            {item.label}
          </a>
        ))}
      </nav>
    </header>
  )
}

// GeostatAppSidebar — same pattern
function GeostatAppSidebar() {
  const nav = useSiteNav()
  return <Sidebar nav={nav} />
}
```

**Why no props?** Header needs: nav items, active route, user info.
These live in hooks: `useSiteNav()`, `useLocation()`. Props would just thread context through.

---

## AppChrome — composable chrome structure

> **⚠️ DEPRECATED — `useTheme()` for chrome dispatch + AppChrome in InnerPageShell**
> ახალი canonical: AppChrome reads chromeRegistry (examples/theme-config.md:138-175).
> Chrome components: () => ReactNode. AppChrome dispatches via chromeRegistry.get(slot, key).
> Chrome location: conflict 5 — pending resolution. See migrate.md.

```tsx
// ❌ DEPRECATED — useTheme() for chrome + AppChrome inside InnerPageShell
// function AppChrome({ children }) {
//   const { AppHeader, AppSidebar, AppFooter } = useTheme()  // ← ThemeConfig.chrome (old)
//   return (...)
// }
// function GeostatInnerPageShell({ def, children }) {
//   return <AppChrome><h1>{def.title}</h1>{children.rendered}</AppChrome>
//   // Chrome inside shell = only inner-page gets chrome. ContainerPageNode = no chrome. ❌
// }

// ✅ CANONICAL — AppChrome reads chromeRegistry (examples/theme-config.md:146)
export function AppChrome({ children }: { children: ReactNode }) {
  const chromeConfig = useSiteChrome()   // SiteManifest.chrome from SiteContext
  const Header  = chromeRegistry.get('AppHeader',  chromeConfig?.['AppHeader']  ?? 'default')
  const Sidebar = chromeRegistry.get('AppSidebar', chromeConfig?.['AppSidebar'] ?? 'default')
  const Footer  = chromeRegistry.get('AppFooter',  chromeConfig?.['AppFooter']  ?? 'default')
  return (
    <div className="app-shell">
      {Sidebar && <Sidebar />}
      <div className="app-body">
        {Header && <Header />}
        <main className="app-main">{children}</main>
        {Footer && <Footer />}
      </div>
    </div>
  )
  // No if/switch. No static map. Constructor changes manifest.chrome → different variant. ✅
}
// Chrome components: () => ReactNode — ZERO PROPS. Data via useSiteNav() / useLocation().
```
