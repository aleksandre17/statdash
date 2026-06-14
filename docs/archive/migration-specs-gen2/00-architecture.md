# Target Architecture — As-Built Subsystem Reference

> **Authority:** the canonical *current-state* map is `docs/plan/SYSTEM-PIPELINE-TREE.md`; the *target* is `docs/plan/ARCHITECTURE-TARGET.md`. **This file is the .claude detail layer** — the as-built subsystem reference that `rules/` and `patterns/` navigate by (migration tiers ①–⑦ are DONE — see `context/phase-status.md`). On any conflict, `docs/plan/` wins.
> Status markers: ✅ implemented · ⏳ planned · ⚠️ current differs (see note)
>
> Full code examples → `docs/architecture/examples/`
> Detailed implementation specs → `.claude/individual/migration/01–08.md`
> Type reference → `docs/architecture/types/all-types.md`

---

## 4-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  packages/          PLATFORM FOUNDATION                   ✅     │
│  @geostat/expr · @geostat/engine · @geostat/react               │
│  DEFAULTS ONLY — zero Geostat identity                          │
└──────────────────────────────┬──────────────────────────────────┘
                               │ imports
┌──────────────────────────────▼──────────────────────────────────┐
│  plugins/           PLUGIN LIBRARY                        ⏳     │
│  nodes/ · chrome/ · controls/ · landing/                        │
│  Generic, token-driven shells. All registrable slices.          │
│  ZERO brand in code — brand = manifest.tokens (CSS vars).       │
│  Constructor reads via nodeRegistry.list()                      │
│  META.schema + META.preview → Constructor palette               │
└──────────────────────────────┬──────────────────────────────────┘
                               │ capabilities available to
┌──────────────────────────────▼──────────────────────────────────┐
│  src/data/          SHARED DATA LAYER                     ✅     │
│  DataStore instances + adapters. Used by BOTH tracks.           │
│  STORE_MANIFEST exported → site-manifest.ts → SiteProvider     │
├─────────────────────────────────────────────────────────────────┤
│  src/data/pages/    TRACK A — JSON World                  ✅     │
│  PageConfig registry. Constructor-compatible.                   │
│  Phase 2: replaced by fetch('/api/pages/:id') in registry.ts.  │
├─────────────────────────────────────────────────────────────────┤
│  src/features/      TRACK B — React Application           ✅     │
│  Feature-based React app. Full framework power.                 │
│  Constructor NEVER touches this layer.                          │
└──────────────────────────────┬──────────────────────────────────┘
                               │ imports from all layers
┌──────────────────────────────▼──────────────────────────────────┐
│  src/app/           BOOTSTRAP (3–4 files, never grows)    ✅     │
│  App.tsx · routes.tsx · PageLoader.tsx                          │
│  src/main.tsx · src/data/site-manifest.ts (seam)               │
└─────────────────────────────────────────────────────────────────┘
```

**Dependency rule — one direction only:**
```
src/ → src/data/pages/ → plugins/ → packages/
src/ → src/features/   → plugins/ → packages/
       both ↑ also import from src/data/ (shared DataStores)
       no upward imports (packages/ knows nothing above it)
```

**Constructor (Phase 2) relationship:**
```
Constructor reads  ← plugins/ (via nodeRegistry.list() → palette)
Constructor reads  ← META.schema → form editor · META.preview → thumbnails
Constructor writes → DB / API (page configs → replaces src/data/pages/ entirely)
App reads          ← site-manifest.ts → fetch('/api/site') in Phase 2
```

---

## Layer 1 — `engine/expr/`  (`@geostat/expr`)  ⏳ PLANNED

> Pure TypeScript. Zero deps. Isolated expression evaluator.
> Current: expr evaluation embedded in `engine/core/src/`.
> Phase 2: extract to separate package for sharing across projects.

```
engine/expr/
  src/
    types.ts    — Expr · ExprRef · ExprVal · DimVal · DeriveMap · ExprScope
    eval.ts     — evalExpr<T>(expr: ExprVal, scope: ExprScope): T
    derive.ts   — evalDerived(map: DeriveMap, scope): Record<string, DimVal>
    template.ts — evalTemplate(tmpl: string, scope): string  e.g. '{time} · მლნ ₾'
    guards.ts   — isExpr() · isExprRef() · isDimVal()
    errors.ts   — ExprEvalError
    ops/
      comparison.ts — eq · ne · gt · lt · gte · lte · in · nin · null · exists
      logic.ts      — and · or · not · if (ternary)
      string.ts     — template · concat · startsWith · includes
      math.ts       — add · sub · mul · div · mod
      lookup.ts     — coalesce · get
      collection.ts — some · every · filter · count · map
  index.ts
```

---

## Layer 1 — `engine/core/`  (`@geostat/engine`)  ✅ implemented

> Pure TypeScript. Zero React. Zero app content.
> Current structure partially differs from target — see comments.

```
engine/core/src/
  sdmx/
    types.ts              — DimVal · Observation · ObsQuery · Classifier · DisplayMap
                            DataBundle · ClassifierRef ($cl) · DisplayRef ($d)
    fromSDMX.ts           — fromSDMX(raw): Observation[]   ← ONLY format boundary

  core/
    types.ts              — EngineRow · DataRow · ObsQuery · DeriveEntry · DataLookupOp
                            NodeDeriveMap = Array<{ key: string; expr: DeriveEntry }>
    interpretSpec.ts      — interpretSpec(spec, ctx, stores): DataRow[]
    evalNodeDerive.ts     — evalNodeDerive(map, ctx): Record<string, DimVal>

  data/
    store.ts              — interface DataStore {
                              query(q: ObsQuery): EngineRow[]
                              batchQuery?(queries, ctx): EngineRow[][]    ← BLOCKER 1
                              readonly caps?:        StoreCaps
                              readonly classifiers?: Record<string, Classifier>
                              readonly display?:     Record<string, DisplayMap>
                            }
                            ExternalStore · StaticDataStore · ApiStore · CachedStore
    specs.ts              — DataSpec union: query · row-list · timeseries · growth ·
                              ratio-list · pivot · by-mode · url · account-sequence
    transform.ts          — TransformStep (15 ops): melt · rename · cast · filter ·
                              sort · derive · aggregate · rollup · lookup · join ·
                              group · concat · template · addField · select
                            applyStep() · applyPipeline()
    encoding.ts           — EncodingSpec { label, value?, series?, color?, pct?,
                              negate?, seriesFormat?, seriesOrder?, tooltip?,
                              id?, isSeparator?, isTotal?, level?, parentId? }
                            applyEncoding(rows, enc, lookup?): DataRow[]
    codelist.ts           — resolveDimRef() · codelistOf()
    resolve.ts            — resolveOptions() · resolveChips() · resolveYears()
                            OptionsSource · ChipSource · YearsSource

  field/
    groupBySpan.ts        — groupBySpan<T>(items, getSpan): T[][]
    formatValue.ts        — formatValue(v, fmt): string

  chart/
    interpretChart.ts     — interpretChart(def, rows, ctx): ChartOutput
    toApexOptions.ts      — toApexOptions(output): ApexOptions

  config/
    section.ts            — VisibilityExpr (boolean algebra expression tree)
                            evalVisibility() · SectionDef types (pre-migration)
    filter.ts             — FilterBarNode · BarNode · ParamNode types ✅ (BLOCKER 3)
    kpi.ts                — KpiSpec · KpiDef
```

**Pipeline flow (interpretSpec):**
```
store.query(q)                    → EngineRow[]
  └── applyPipeline(rows, pipe)   → EngineRow[]   (optional transform steps)
  └── applyEncoding(rows, enc)    → DataRow[]      (Grammar of Graphics mapping)
renderNode step 3                 → ctx.rows = DataRow[]
                                    (Chart + Table receive same typed rows)
```

---

## Layer 1 — `engine/react/`  (`@geostat/react`)  ✅ implemented

> React adapter. DEFAULTS ONLY — zero Geostat identity.
> ⚠️ Current has Geostat components mixed in (Header, Sidebar, etc.) — migration target: extract to plugins/.

```
engine/react/src/
  engine/
    types.ts          — NodeDef union · SectionNode · ChartNode · TableNode ·
                        RowNode · GeorgraphNode · TabsNode · FilterBarNode ·
                        KpiStripNode · LinksNode · PageHeaderNode ·
                        LandingHeroNode · LandingStatsNode
                        ViewParams · RenderContext · Renderer<T>
                        PageConfig · SiteConfig

    NodeRegistry.ts   — NodeRegistry: register() · get() · list() · dump()
    SlotRegistry.ts   — slot-based dispatch (pre-migration helper)
    register-all.ts   — ⚠️ ALL registrations here currently (target: src/setupRegistrations.ts)

    renderers/        — one file per node type
      SectionRenderer.tsx
      ChartRenderer.tsx
      TableRenderer.tsx
      FilterBarRenderer.tsx
      RowRenderer.tsx
      TabsRenderer.tsx · TabRenderer.tsx · BarRenderer.tsx
      GeorgraphRenderer.tsx
      LandingHeroRenderer.tsx · LandingStatsRenderer.tsx
      PageHeaderRenderer.tsx · LinksRenderer.tsx
      param/            — ParamYearSelectRenderer · ParamSelectRenderer ·
                          ParamCascadeRenderer · ParamRangeRenderer ·
                          ParamMultiSelectRenderer · ParamChipSelectRenderer

  filters/
    useFilterState.ts — useFilterState(node: FilterBarNode): FiltersResult
                        reads/writes URL params + derives SectionContext
    FilterContext.tsx — FilterContext + FilterProvider + useFilter(key)

  individual/context/
    SectionNavContext.tsx  — section scroll-spy for sidebar nav

  components/           — ⚠️ Geostat-specific components (target: plugins/)
    layout/             — Layout · Header · Sidebar · Footer · InnerLayout
    sections/           — SectionBlock · DataTable · KpiCard · PageHeader
    charts/             — Chart · BarChart · LineChart · apexAdapter
    filters/            — FilterField · CascadeSelect
```

**⚠️ RenderContext (current — more complete than planned):**
```ts
interface RenderContext {
  sectionCtx:    SectionContext           // timeMode + dims
  stores:        Record<string, DataStore>
  pageStoreKey?: string
  filterParams:  Record<string, unknown>  // all parsed filter values
  set:           (key: string, val: unknown) => void
  vars:          Record<string, unknown>  // page-level derived variables
  color:         string
  crumbs?:       { label: string; href?: string }[]
  timeModeKey:   string
  paramOptions?: number[] | SelectOption[] | ChipOption[]
  effects:       Effect[]
  rows?:         DataRow[]
  view?:         ViewParams
  renderNode:    (node, ctxOverride?) => ReactNode
}
```

**⚠️ NodeDef named slots (current) vs children[] (SKELETON target):**
```
Current:  SectionNode { chart?: ChartNode; table?: TableNode; tabs?: TabsNode }
Target:   SectionNode { children: NodeDef[] } + layout.role for toggle
```
Named slots: simpler, type-safe, explicit.
children[]: more generic, Constructor can add any child type.
Current choice is deliberate — reassess when Constructor Phase 2 is implemented.

---

## Layer 2 — `plugins/`  ⏳ PLANNED

> Generic, token-driven shells. All registrable slices.
> Constructor reads this layer. Developer adds to this layer.
> Currently: shells live in `engine/react/src/components/` — will migrate here.

**Membership test — "does it register into a registry?"**
```
nodeRegistry.register()          → plugins/nodes/
chromeRegistry.register()        → plugins/chrome/
filterControlRegistry.register() → plugins/controls/
engine.extendSpec()              → plugins/ (custom DataSpec types)
DataStore instance               → src/data/           ← NOT a registry registrant
page config (PageConfig)         → src/data/pages/     ← NOT a registry registrant
```

### `plugins/nodes/`
```
plugins/nodes/
  section/
    SectionShell.tsx    — NodeRenderer<SectionNode>: role toggle · collapse · export
    SectionSkeleton.tsx — (ctx) => ReactNode
    index.ts            ← Shell + Skeleton + META
  chart/
    ChartShell.tsx      — useMemo(interpretChart) + ReactApexChart
    index.ts
  table/
    TableShell.tsx
    index.ts
  kpi-strip/
    KpiStripShell.tsx   — iterates ctx.rows → KpiCards
    KpiStripSkeleton.tsx
    index.ts
  filter-bar/
    FilterBarShell.tsx  — hooks in inner FilterBarControl component
    index.ts
  inner-page/
    InnerPageShell.tsx  — AppChrome wrapper + page header
    index.ts

  layout/               — Constructor palette: category: 'layout'
    grid/               — CSS grid container (colSpan/rowSpan from layout.*)
    columns/            — responsive columns
    stack/              — flex column/row
    card/               — card surface (leaf or container)
    types.ts            — module augmentation: GridNode · ColumnsNode · StackNode · CardNode
    index.ts

  index.ts              ← BARREL (discoverability — 1 line per new type)
```

**NodeSlice anatomy — every node in plugins/nodes/ exports this shape:**
```ts
import { SectionShell    } from './SectionShell'
import { SectionSkeleton } from './SectionSkeleton'

export { SectionShell    as Shell    }
export { SectionSkeleton as Skeleton }  // separate export — Skeleton is a fn, not JSON
export const META: NodeSliceMeta = {
  type:     'section',
  variant:  'default',
  label:    'სექცია',
  icon:     'layout-section',
  category: 'layout',
  schema:   { type: 'object', properties: { view: { ... } } },  // → Constructor form
  preview:  '/previews/section.png',   // → Constructor palette thumbnail
}
// META is JSON-serializable: JSON.parse(JSON.stringify(META)) === META ✅
// Skeleton is a separate named export — registerSlice() adds it to registry fn-side
```

**Component wrapper pattern (hooks rule):**
```tsx
// NodeRenderer = plain function. Engine calls it as a plain function.
// Hooks must be in an inner component — NOT in the renderer body.
export const SectionShell: NodeRenderer<SectionNode> =
  (def, ctx, children) => <SectionControl def={def} ctx={ctx} children={children} />

function SectionControl({ def, ctx, children }) {
  const view = ctx.view   // engine resolved ExprVal → ResolvedViewParams
  const [collapsed, setCollapsed] = useState(!view.defaultOpen)
  // ... hooks OK here
  return <section>...</section>
}
```

### `plugins/chrome/`  ⏳ PLANNED
```
plugins/chrome/
  AppHeader/
    default/  ← FullHeader.tsx + index.ts (Shell + META)
    minimal/  ← MinimalHeader.tsx + index.ts
    compact/  ← CompactHeader.tsx + index.ts
  AppSidebar/
    default/ · collapsed/ · hidden/
  AppFooter/
    default/ · minimal/

  AppChrome.tsx   ← NOT a registrable slice; knows specific slot names
                    uses ChromeLayout from @geostat/react

  index.ts        ← BARREL (1 line per new chrome variant)
```

**Chrome components — zero props rule:**
```tsx
// () => ReactNode — ZERO PROPS (chromeRegistry calls with no args)
function FullHeader() {
  const nav      = useSiteNav()   // data from SiteContext
  const location = useLocation()  // from react-router
  return <header>...</header>
}
// ❌ Wrong: function FullHeader({ nav }) — chromeRegistry.get(slot, key)() passes no args
```

**ChromeLayout (in engine/react) — generic dispatcher:**
```tsx
// engine/react knows NOTHING about slot names (AppHeader/Sidebar/Footer)
// plugins/chrome/AppChrome knows specific slots and passes them to ChromeLayout
export function AppChrome({ children }) {
  return (
    <ChromeLayout slots={['AppHeader', 'AppBanner', 'AppSidebar', 'AppFooter']}>
      {children}
    </ChromeLayout>
  )
}
```

### `plugins/controls/`  ⏳ PLANNED
```
plugins/controls/
  year-select/  ← YearSelectShell + index.ts (Shell+META+defaultValue+codec+validate+formatValue)
  cascade/
  select/
  range/
  multi-select/
  index.ts      ← BARREL
```

**FilterControlSlice anatomy:**
```ts
export { YearSelectShell as Shell }
export const META: FilterControlMeta = { controlType: 'year-select', label: 'Year Selector', category: 'time' }
export const defaultValue = (config: YearSelectDef) => config.range?.[1] ?? new Date().getFullYear()
export const codec: FilterCodec<number> = {
  toUrl:     v  => String(v),
  fromUrl:   s  => s ? parseInt(s, 10) : null,
  isEmpty:   v  => v == null || !Number.isFinite(v),
  normalize: raw => parseInt(String(raw), 10),
}
export const validate    = (v, c: YearSelectDef) =>
  c.range && (v < c.range[0] || v > c.range[1]) ? `${c.range[0]}–${c.range[1]}` : null
export const formatValue = (v: number) => String(v)
```

### RegistrableSlice Pattern  ⏳ PLANNED
```ts
// Three discriminated shapes — META discriminant tells registerSlice() which registry to use:
interface NodeSliceMeta    { type: string; variant?: string; label?, icon?, category?, schema?, preview? }
interface ChromeSliceMeta  { slot: string; key: string; label?, preview? }
interface FilterControlMeta{ controlType: string; label: string; description?, icon?, category?, schema? }

interface NodeSlice    { Shell: NodeRenderer;       Skeleton?: SkeletonFn; META: NodeSliceMeta }
interface ChromeSlice  { Shell: () => ReactNode;    META: ChromeSliceMeta }
interface ControlSlice { Shell: ComponentType<any>; META: FilterControlMeta
                         defaultValue: fn; codec: FilterCodec; validate?: fn; formatValue?: fn }
type RegistrableSlice = NodeSlice | ChromeSlice | ControlSlice

// Type guards:
const isNodeSlice    = (s): s is NodeSlice    => 'type'        in s.META
const isChromeSlice  = (s): s is ChromeSlice  => 'slot'        in s.META
const isControlSlice = (s): s is ControlSlice => 'controlType' in s.META
```

**Known tradeoff — barrel vs typed overload:**
```
Barrel:   mod.Shell as NodeRenderer cast needed in registerSlice().
          Typed overload register<K extends keyof NodeTypeMap> cannot be used via barrel.
Explicit: full typed overload — TypeScript validates renderer ↔ node type match.
At 22 slices: explicit is equally readable + stronger type safety.
Barrel pays off at 50+ slices. Reassess at 50.
NEVER use import.meta.glob — type assertion, not check.
```

---

## Layer 3 — Developer Usage Layer  ✅ (partial)

```
src/data/              — SHARED: DataStore instances + adapters
src/data/pages/        — TRACK A: PageConfig registry (Constructor-compatible)
src/features/          — TRACK B: Feature-based React app
```

### Track A — `src/data/pages/`  ✅
```
src/data/pages/
  registry.ts     — loadPage(id) · listPages() · buildNav(pages)
  (page configs live in src/data/site.config.ts as SITE.pages array)
```

**Phase 2 drop-in (registry.ts):**
```ts
// Phase 1 (now): return SITE.pages.find(p => p.id === id) ?? null
// Phase 2:       const res = await fetch(`/api/pages/${id}`)
//                return res.ok ? res.json() : null
// Zero other changes.
```

### Track B — `src/features/`  ✅
```
src/features/
  gdp/          — GdpPage (Track A migrated — PageConfig)
  accounts/     — AccountsPage (Track A migrated — PageConfig)
  regional/     — RegionalPage (Track A migrated — PageConfig)
  landing/      — LandingPage (Track B — React component, no JSON)
```

**Track A vs Track B — when to choose:**
```
Track A (src/data/pages/):   Constructor edits Phase 2 · JSON-serializable · consistent rendering
Track B (src/features/):     Full React power · custom hooks · custom layout · developer owns forever
Both share: src/data/ (same DataStores) · plugins/ (same Shells) · packages/ (same hooks)
```

### `src/data/`  ✅
```
src/data/
  gdp/
    raw.ts          — GDP_RAW + GDP_CLASSIFIERS + GDP_DISPLAY
    adapter.ts      — fromGDPFacts(raw): Observation[]
    store.ts        — export const gdpStore = new ExternalStore(...)
  accounts/
    raw.ts
    adapter.ts      — fromAccountsFacts() + fromSDMX()
    store.ts
  regional/
    raw.ts
    adapter.ts
    store.ts
  pages/
    registry.ts     ← page registry (Track A)
  site-manifest.ts  ← SiteManifest + fetchSiteManifest() — THE SEAM
  site.config.ts    ← SITE object (pages array + nav)
  store-manifest.ts ← STORE_MANIFEST: Record<string, DataStore>
```

**Current SiteManifest (simpler than SKELETON target):**
```ts
// src/data/site-manifest.ts
interface SiteManifest {
  stores: Record<string, DataStore>  // → SiteProvider
  nav:    NavEntry[]                 // → SiteProvider
  // Phase 2 adds: pages · chrome · tokens (Constructor-managed)
}
```

---

## Layer 4 — `src/`  Bootstrap  ✅

```
src/
  main.tsx              — top-level await + createRoot
  app/
    App.tsx             — ThemeProvider + SiteProvider + Router
    routes.tsx          — PageLoader routes (Track A) + explicit routes (Track B)
    PageLoader.tsx      — loads page by id → SiteRenderer
  data/
    site-manifest.ts    ← THE SEAM (Phase 1→2 transition)
```

**`src/main.tsx` (current pattern):**
```ts
import '@geostat/react/styles'               // base styles
import { setupRegistrations } from './app/setupRegistrations'  // ⏳ target
import { fetchSiteManifest  } from './data/site-manifest'
import { createRoot         } from 'react-dom/client'
import { App                } from './app/App'

// Current: registration happens in engine/react/src/engine/register-all.ts
// Target:  src/setupRegistrations.ts — all registrations centralized here
const manifest = await fetchSiteManifest()
createRoot(document.getElementById('root')!).render(<App manifest={manifest} />)
```

**`src/app/App.tsx`:**
```tsx
import { SiteProvider } from '@geostat/react'
// ThemeProvider + GEOSTAT_THEME → ⏳ planned (ThemeConfig + mergeTheme)

export function App({ manifest }: { manifest: SiteManifest }) {
  return (
    <SiteProvider stores={manifest.stores} nav={manifest.nav}>
      <Router>
        <Routes />
      </Router>
    </SiteProvider>
  )
}
```

**`src/app/routes.tsx`:**
```tsx
export function AppRoutes() {
  return (
    <Routes>
      {/* Track A — dynamic from manifest (Constructor adds page → route appears) */}
      {pages.map(p => <Route key={p.id} path={p.path ?? `/${p.id}`}
                             element={<PageLoader pageId={p.id} />} />)}
      {/* Track B — explicit (developer-owned, no Constructor) */}
      <Route path="/landing" element={<LandingPage />} />
    </Routes>
  )
}
```

**`src/data/site-manifest.ts` — THE SEAM (Phase 1→2 transition):**
```ts
// Phase 1 (now): static TypeScript files
export async function fetchSiteManifest(): Promise<SiteManifest> {
  return { stores: STORE_MANIFEST, nav: buildNav(listPages()) }
}

// Phase 2 (Constructor live) — ONE LINE CHANGE:
// return fetch('/api/site').then(r => r.json())
// src/data/pages/ deleted. data/nav → Constructor DB.
// STORE_MANIFEST stays (stores = infrastructure, not Constructor-managed).
```

### `src/setupRegistrations.ts`  ⏳ PLANNED

> Currently: registration in `engine/react/src/engine/register-all.ts`.
> Target: move to `src/` — discoverability rule (all registrations in one place).

```ts
// Target pattern:
export function setupRegistrations() {
  ;[
    ...Object.values(Nodes),
    ...Object.values(Chrome),
    ...Object.values(Controls),
  ].forEach(registerSlice)

  engine.extendSpec('account-sequence', accountSequenceResolver)
}
// Adding a node: plugins/nodes/<type>/ + 1 line in index.ts → zero changes here
```

---

## Rendering Pipeline  ✅

```
PageConfig (JSON / DB in Phase 2)
  → PageLoader(pageId)
      → SiteRenderer
           useStores()   → ctx.stores
           useFilterState(page.filterBar) → filtersResult
           filtersResult.ctx → sectionCtx
      → renderNode(pageConfig, baseCtx)

renderNode(node, ctx):
  step 1. node.derive      → evalDerived(NodeDeriveMap, scope) → ctx = { ...ctx, vars }
  step 2. node.visibleWhen → evalVisibility(expr, filterParams) → false → return null
  step 3. node.data        → interpretSpec(spec, sectionCtx, stores) → ctx.rows
  step 4. node.view        → evaluate ViewParams → ctx.view
  step 5. childDefs        = resolve children from node fields (chart?, table?, tabs?)
  step 6. rendered         = childDefs.map(c => renderNode(c, ctx))   ← recursive
  step 7. children: ChildrenArg = { defs, rendered, renderChild }
  step 8. Shell = nodeRegistry.get(node.type, node.variant ?? 'default')
          <Suspense fallback={skeleton}><NodeErrorBoundary>
            {Shell(node, ctx, children)}   ← NodeRenderer<T> — plain function call
          </NodeErrorBoundary></Suspense>
```

**Skeleton resolution (three levels):**
```
1. ctx.theme.skeletons?.[type]           — brand override (ThemeConfig ⏳)
2. nodeRegistry.getMeta(type)?.skeleton  — type default (from plugins/ Skeleton export)
3. generic node-skeleton div             — engine fallback
```

---

## Chrome Flow  ⏳ PLANNED

```
App.tsx
  ThemeProvider(GEOSTAT_THEME)     ⏳
    SiteProvider({ stores, pages, nav, chrome: manifest.chrome })
      Router
        SiteRenderer
          renderNode({ type: 'inner-page', id: 'gdp', ... })
            InnerPageShell(def, ctx, children)
              <AppChrome>                    ← plugins/chrome/AppChrome.tsx
                <ChromeLayout slots={[...]}>
                  chromeRegistry.get('AppHeader',  manifest.chrome.AppHeader)
                  chromeRegistry.get('AppSidebar', manifest.chrome.AppSidebar)
                  <main>{children.rendered}</main>
                </ChromeLayout>
              </AppChrome>
```

**Constructor changes chrome — zero code change:**
```
manifest.chrome.AppHeader = 'minimal'
→ fetchSiteManifest() → SiteProvider(chrome: { AppHeader: 'minimal' })
→ chromeRegistry.get('AppHeader', 'minimal') → MinimalHeader
→ no code change, no deploy ✅
```

---

## Key Rules

```
Shell dispatch    → nodeRegistry.get(type, variant ?? 'default')
Chrome dispatch   → chromeRegistry.get(slot, key ?? 'default')     ⏳
ThemeConfig       → skeletons only; shells + chrome → registries   ⏳

All register()    → src/setupRegistrations.ts (discoverability)    ⏳ (currently register-all.ts)
Chrome components → () => ReactNode — ZERO PROPS (data from hooks inside)

NodeRenderer      → plain function, NOT React component (hooks forbidden)
                    hooks → inner component wrapper (component wrapper pattern)

ctx.dims['time'] ✅    ctx.year / ctx.regionId        ❌
data: DataSpec   ✅    getRows: (ctx) => DataRow[]    ❌
bars: BarDef     ✅    bars: ReactNode[]              ❌

DataStore.query() → SYNC EngineRow[] always. Async = throw Promise/Error internally.
DeriveMap         → Array<{ key, expr }> — NOT Record (explicit order)
ctx.stores        → Record<string, DataStore> — NOT ctx.store (multi-store)
NavItem[]         → independent of PageConfig (data/nav, NOT in PageConfig.children)

JSON.parse(JSON.stringify(config)) === config  ← Phase 2 compatibility test
META functions    → ❌ (META must be JSON-serializable for Constructor DB storage)
Skeleton in META  → ❌ (Skeleton = separate named export, added by registerSlice)
```

---

## Phase 2 Swap Points — zero config change

```ts
// 1. Site manifest — only line that changes:
//    src/data/site-manifest.ts
//    Phase 1: return { stores: STORE_MANIFEST, nav: buildNav(listPages()) }
//    Phase 2: return fetch('/api/site').then(r => r.json())
//    src/data/pages/ deleted. STORE_MANIFEST stays (infrastructure, not Constructor).

// 2. Store swap (per dataset):
//    Phase 1: new ExternalStore(GDP_ADAPTED)
//    Phase 2: new HttpDataStore('/api/datasets/gdp', fromSDMX)
//    Same DataStore interface. DataSpec unchanged. Zero config change.

// 3. Chrome config — Constructor writes, zero code change:                    ⏳
//    manifest.chrome.AppHeader = 'minimal'
//    → chromeRegistry.get('AppHeader', 'minimal') → MinimalHeader

// 4. PageConfig — Constructor generates, zero code change:
//    Constructor → NodeDef JSON → DB → fetchSiteManifest() → PageLoader
//    <PageLoader pageId="gdp" /> — unchanged

// 5. Brand tokens — Constructor writes, zero code change:                     ⏳
//    manifest.tokens['--color-primary'] = '#C8102E'
//    → applyTokens() → CSS :root updated → all components reading var() update instantly
```

---

## Multi-Site — same plugins/, different manifests  ⏳ PLANNED

> New site = new manifest + new tokens. Zero new code.
> plugins/ is a generic library. Any statistical agency uses it as-is.

```
Same plugins/ (deployed once):
  nodes/ · chrome/ · controls/ · landing/   ← shared by all sites

Different manifests (per site, from Constructor):
  Geostat: { tokens: { '--color-primary': '#005A9C' }, nav: [...], chrome: {...} }
  ENstat:  { tokens: { '--color-primary': '#003F87' }, nav: [...], chrome: {...} }
  ArmStat: { tokens: { '--color-primary': '#CC0000' }, nav: [...], chrome: {...} }

// src/manifest.ts — the only org-specific line:
// return fetch('/api/site').then(r => r.json())
// Constructor for Geostat → /api/site returns Geostat manifest
// Constructor for ENstat  → /api/site returns ENstat manifest (different DB row)
// Same plugins/, same src/main.tsx, same everything. Different DB record.
```