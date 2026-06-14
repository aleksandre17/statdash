# All Agreements — Summary Reference

> 19 + S-1..S-3 + C-5 confirmed agreements. ყოველი decision-ი NEW_ARCHITECTURE.md-ში დეტალურად.

---

## #1 engine/react/ = zero app content

engine/react/ არ შეიცავს Geostat-ის კოდს. Zero brand. Zero app-specific node types.
App-specific → `src/` always. Extension → `engine.extend(nodeRegistry)`.

---

## #2 NodeRenderer only

`(def, ctx, children) => ReactNode` — ეს signature. ყოველთვის. SlotWrapper removed (#18).
"Wrapper" ≠ "Renderer" — removed distinction, one type remains.

---

## #3 NodeRegistry: T extends { type: string }

NOT `T extends NodeDef`. `NodeDef` = engine/react/ built-ins only.
App-specific types (LandingHeroNode) have `T extends NodeBase`, not in `NodeDef`.
Open constraint allows `nodeRegistry.register('landing-hero', LandingHeroRenderer)`.

---

## #4 ThemeConfig injectable via ctx.theme

Grafana ThemeContext pattern. `ctx.theme.shells['section']` — always.
Never import src/ component in engine/react/. Bridge: `useTheme()` → `baseCtx.theme`.

---

## #5 Engine State vs UI State

Engine (`interpretSpec`, `evalExpr`, `renderNode`) — pure, no side effects.
Shell (src/) — `useState` toggle, collapse, hover, animation, interaction.
Boundary: renderer returns `<Shell />`. Shell is a React component with hooks.

---

## #6 Shell Props: def pass-through

Renderer receives `def` (typed NodeDef). Passes entire `def` to shell.
Shell reads any field from def — no intermediate prop picking.
```ts
<Shell def={def} children={children} />
// Shell: function GeostatSectionShell({ def, children }: SectionShellProps)
//   def.title, def.layout, def.view — all accessible
```

---

## #7 App extension: engine.extend(nodeRegistry)

One arg. `slotRegistry` removed (#18). Called once at startup in `src/app/setupEngine.ts`.

---

## #8 ThemeProvider + useTheme() + ctx.theme bridge

```
<ThemeProvider theme={GEOSTAT_THEME}>  ← React world (once)
  useTheme()                            ← SiteRenderer bridge
  ctx.theme                             ← Engine world (plain fn renderers)
```
Nested ThemeProvider = per-page override (per Material UI / Radix pattern).

---

## #9 DEFAULT_THEME scope

`DEFAULT_THEME` shipped in engine/react/. Contains functional defaults (all shells render).
Structural defaults only — no brand CSS, no Geostat identity. New project works immediately.
GEOSTAT_THEME spreads DEFAULT_THEME and overrides: `{ ...DEFAULT_THEME.shells, 'section': GeostatSectionShell }`.

---

## #10 src/ Internal Architecture

Three separations:
```
data/       ← zero deps on features/ or components/
features/   ← data/ storeKey strings only (never DataStore instances)
components/ ← engine/react/ (ThemeConfig, Shell props)
app/        ← wires all
```

---

## #11 Filter System: ThemeConfig Level 1

> **⚠️ DEPRECATED — FilterBarShell in ThemeConfig.shells**
> ახალი canonical: `nodeRegistry.register('filter-bar', 'default', GeostatFilterBarShell)` in setupRegistrations.ts.
> `ctx.theme.shells['filter-bar']` → `nodeRegistry.get('filter-bar', 'default')` in renderNode().

FilterBarShell is in ThemeConfig shells. Level 1 customization (not injected into engine internals).
`ctx.theme.shells['filter-bar']` — same pattern as section/chart/table.

---

## #12 Migration Order — Strangler Fig

> **⚠️ DEPRECATED — this migration order (references ThemeConfig.shells + ctx.theme dispatch)**
> ახალი canonical migration order: `migrate.md` → Dependency Order section.
> Key differences: ThemeConfig.shells → nodeRegistry. ctx.theme dispatch → nodeRegistry.get().

```
// ❌ DEPRECATED migration order:
① NodeRegistry T constraint (TypeScript only)
② ThemeConfig types + ChildrenArg + layout     (new types)
🗂 layout components → src/components/layout/  (file moves)
③ Landing → src/features/landing/
④ Page shells (InnerPage · Tab · Container)
⑤ Chrome shells + App restructure
⑦ GeostatSectionShell     ← BEFORE ⑥ (critical)
⑥ SectionRenderer → ctx.theme + array-only
⑧ All other renderers → ctx.theme + ChildrenArg
🗑 SlotRegistry + SlotWrapper + renderSlots()
🗑 SectionBlock deleted

// ✅ CANONICAL: see migrate.md → Dependency Order
```
`tsc → 0 errors` at every step.

---

## #13 Layout System — Layout IS a node type

Layout nodes (inner-page, tab-page, container-page) = node types. Same registry.
`children: NodeDef[]` — free composition, any depth, any order.
`layout.position/order/span/label/role` on NodeBase — hints to parent shell.

---

## #14 Chrome Components — ThemeConfig entries

> **⚠️ DEPRECATED — AppHeader/AppSidebar/AppFooter in ThemeConfig**
> ახალი canonical: `chromeRegistry.register(slot, key, Shell)` in setupRegistrations.ts.
> AppChrome reads `chromeRegistry.get(slot, chromeConfig[slot] ?? 'default')`.
> Per-page override: `<ShellOverrideProvider>` — NOT nested ThemeProvider.

`AppHeader / AppSidebar / AppFooter` → `ThemeConfig` fixed entries.
`() => ReactNode` — no props, reads `useSiteNav()` / `useLocation()` internally.
Shell reads via `useTheme()` — zero hardcoding.
Per-page override: nested ThemeProvider.

---

## #15 Node Layout Hints — engine wrapping + CSS

`NodeBase.layout: { position?, order?, span?, label?, role? }`
Engine ALWAYS wraps each child: `<div className="slot slot--{position ?? 'flow'}">`.
No `slotLayout` registration option — wrapping is unconditional. Shell provides CSS context only — zero JS layout logic.

---

## #16 Array-Only Children

> **⚠️ DEPRECATED — `ChildrenArg = { defs, rendered }` without renderChild**
> ახალი canonical: `ChildrenArg = { defs, rendered, renderChild }`.
> მიზეზი: TabPageShell-ს lazy render სჭირდება. renderChild = engine's lazy entry point.

ALL nodes: `def.children: NodeDef[]` — no named fields.
`ChildrenArg = { defs: NodeDef[], rendered: ReactNode[], renderChild: (i: number) => ReactNode }`.
`NodeRenderer<D> = (def, ctx, children: ChildrenArg) => ReactNode`.
SectionNode: `chart?/table?` removed → `children: NodeDef[]` + `layout.role`.
Engine: always reads `def.children`, never named fields.

---

## #17 Layer Rule + ChromeProps removed

`engine/react/` renderer → `ctx.theme.shells['type']` (MUST).
`src/` renderer → `ctx.theme.shells` OR direct import `src/` component (both valid).
`LandingPageRenderer` (src/) → imports `GeostatLandingShell` directly — NOT exception, layer rule.
`ChromeProps` removed — `AppHeader: () => ReactNode`.

---

## #18 Registration System Simplified

`SlotRegistry` → REMOVED. `layout.position/order` replaces.
`SlotWrapper` → REMOVED. Engine wrapper + CSS replaces.
`renderSlots()` → REMOVED, replaced by `renderNode(root, ctx)`.
`engine.extend(nodeRegistry)` — one arg only.
`register(type, renderer)` — two args only, no manifest options. `slotLayout` removed entirely.

---

## #19 Public API — engine/react/

Tiered exports:
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

// Tier 2: Values
export { DEFAULT_THEME }
export { engine, nodeRegistry }

// Tier 3: Components + Hooks
export { ThemeProvider, useTheme }
export { SiteRenderer, PageLoader }
export { SiteProvider, useStores, useSiteNav, usePageById }
export { useStoreQuery }           // imperative data path (third path): { data, isLoading, error? }

// Tier 4: Filter API
export { defineFilters }
export { useFilters }
export { FilterProvider, useFilter }
export type { FilterBarSpec, ParamDef, FiltersResult, FilterSchema }
export type { FlatFilters }        // FlatFilters<B> = UnionToIntersection<B[keyof B]['filters']>
```

---

## I-1 SiteContext Nav — Platform-Aligned Redesign

NavItem[] independent of PageConfig (Grafana/Retool/AppSmith consensus).
`nav.config.ts` → `SiteProvider.nav` → `useSiteNav()`.
`buildNav()` removed — nav is declared, not derived.
`SiteProvider: { stores, pages: Record<string, PageConfig>, nav: NavItem[] }`.
`usePageById(id): PageConfig | null` — sync O(1) lookup replaces async `loadPage()`.

---

## C-1 Circular Dependency Resolved

`tree-field / map-field` → REMOVED from `@geostat/expr`.
These ops require data access (DataSpec + store) → `@geostat/engine` DeriveEntry.
`DeriveEntry = ExprVal | DataLookupOp` — engine handles both.
`@geostat/expr` stays zero deps. `@geostat/engine` imports `@geostat/expr`. No circular.

---

## C-2 Multi-Store — ctx.stores registry

`ctx.store: DataStore` → `ctx.stores: Record<string, DataStore>`.
`SiteProvider(stores=storeManifest)` → `useStores()` → `baseCtx.stores`.
`interpretSpec: spec.storeId ?? pageStoreKey → stores[id]`.

---

## I-5 DeriveMap Array

`Record<string, ExprVal>` → `Array<{ key: string; expr: ExprVal }>`.
Explicit order. JSON-safe. Constructor-safe. No implicit JS key ordering.
Each entry may reference `$derived` from earlier entries only.

---

## C-4 Phase 2 Data Path — `type: 'url'` replaces named stores

**Named stores (`storeId`) = Phase 1 convenience only.**
**Constructor (Phase 2) pages always use `type: 'url'` DataSpec.**

```
Phase 1 (hand-crafted src/ pages):
  data: { type: 'timeseries', storeId: 'gdp', indicator: 'B1G' }
  → named DataStore pre-registered in STORE_MANIFEST (static TypeScript)

Phase 2 (Constructor-created pages):
  data: { type: 'url', href: '/api/sdmx/GDP_GE', transform: 'fromSDMX' }
  → HttpDataStore (built-in) — no registration, no factory, no store manifest entry
```

**Mechanism — `href?` on DataSpecBase:**
All named-query DataSpec types (timeseries, row-list, pivot, …) accept `href?` alongside `storeId?`.
`interpretSpec` store resolution: `href` → HttpDataStore · `storeId` → registry · (none) → pageStoreKey.

```ts
// Phase 1 (hand-crafted src/ page):
{ type: 'timeseries', storeId: 'gdp', indicator: 'B1G', dims: { geo: { $ctx:'geo' } } }

// Phase 2 (Constructor DB page) — identical shape, href instead of storeId:
{ type: 'timeseries', href: 'https://api.geostat.ge/sdmx/v1/data/GDP_GE',
  transform: 'fromSDMX', indicator: 'B1G', dims: { geo: { $ctx:'geo' } } }
```

**Why no store factory needed:**
- URL + transform string = complete store identity (Eurostat/ONS/World Bank pattern)
- HttpDataStore handles any URL — registered once at engine startup
- `transform?: string` — open string key into TRANSFORM_MAP, stored as-is in DB → JSON-safe, agnostic
- ALL DataSpec types work with `href` — no new spec types for Phase 2

**`storeKey` on PageConfigBase = Phase 1 hint only.**
Constructor pages omit it. Phase 2 manifest `stores: {}` — empty, HttpDataStore is built-in.

**Phase 2 manifest loading (Grafana `bootData` pattern):**
```ts
// fetch('/api/site-manifest') → { pages, nav }   ← no stores needed
// SiteProvider.stores = {}   (HttpDataStore built-in, handles all href-based DataSpecs)
```

---

## C-3 Three Data Paths — one DataRow[] output

`type: 'url'` DataSpec + built-in `HttpDataStore` — three paths, all produce `DataRow[]`:

```
Declarative named  →  { type: 'timeseries', storeId: 'gdp' }  → named DataStore in ctx.stores
Declarative URL    →  { type: 'url', href: '/api/...' }        → HttpDataStore (built-in 'http')
Imperative         →  ctx.stores + useStoreQuery hook           → any DataStore

სამივე → DataRow[] → renderer ctx.rows-ს კითხულობს, სხვაობა არ ჩანს
```

**HttpDataStore rules:**
- Registered once at startup: `engine.registerBuiltinStore('http', new HttpDataStore())`
- Suspense pattern: throws `Promise` if not cached — React catches, shows fallback
- `transform?: string` — open string key → `TRANSFORM_MAP` maps to function at runtime (not a closed union)
- JSON-safe: Constructor stores `'fromSDMX'` as string in DB, never the function reference

```ts
// JSON config (DB-storable):
{ type: 'url', href: '/api/regional/2024.json', transform: 'fromSDMX' }

// Runtime resolution in HttpDataStore:
TRANSFORM_MAP['fromSDMX'] → fromSDMX()
```

---

## S-1 Shell Props ISP — Interface Segregation per Shell Type

Each shell receives exactly what it needs — not a full `RenderContext`.

```ts
SectionShellProps:   { def: SectionNode;    children: ChildrenArg;  view: ResolvedViewParams }
ChartShellProps:     { def: ChartNode;      output: ChartOutput }   // interpretChart() in renderer
TableShellProps:     { def: TableNode;      rows: DataRow[];        view: ResolvedViewParams }
FilterBarShellProps: { def: FilterBarNode;  bars: FilterBarSpec[] } // useFilters() in inner component
KpiStripShellProps:  { def: KpiStripNode;   rows: DataRow[];        view: ResolvedViewParams }
PageShellProps<T>:   { def: T;              children: ChildrenArg }
```

`KpiCardProps: { row: DataRow }` — internal helper inside KpiStrip shell. NOT in ShellMap.
ShellMap maps `'kpi-strip'` → `KpiStripShellProps` (all-rows). `kpi-card` = not registered.

**KpiStrip all-rows rule (ONS/Grafana pattern):** shell receives ALL rows and iterates internally.
Full layout control stays in the shell — not split across renderer + shell.

---

## S-2 view Prop Delivery — Engine Resolves, Shell Never Reads def.view

```
Engine step 4:  evalExpr(def.view, ctx)  →  ctx.view: ResolvedViewParams
Renderer:       passes ctx.view to shell
Shell:          reads view.subtitle, view.exportable, etc.
Shell NEVER:    reads def.view  (ExprVal — still unresolved at shell level)
```

`def.view` = `ExprVal` (may be `{ $ctx: '...' }` — not a plain string).
`ctx.view` = `ResolvedViewParams` — already evaluated, safe to use directly.

```ts
// Renderer (correct):
return <Shell def={node} rows={ctx.rows} view={ctx.view} />

// Shell (correct):
function GeostatTableShell({ def, rows, view }: TableShellProps) {
  return <>{view.subtitle && <p>{view.subtitle}</p>}</>
}

// Shell (WRONG — def.view is ExprVal, not ResolvedViewParams):
function GeostatTableShell({ def, rows }: ...) {
  return <>{def.view?.subtitle}</>   // ❌ type error + runtime risk
}
```

---

## S-3 Generic Role Toggle — Open String, No Hardcoded Role Names

`layout.role` = open string. Shell NEVER hardcodes `'chart'` or `'table'`.

```tsx
// Shell collects distinct roles from children:
const roles = [...new Set(
  children.defs.map(d => d.layout?.role).filter((r): r is string => !!r)
)]

// Toggle label = layout.label ?? role (always works without extra config)
const label = children.defs.find(d => d.layout?.role === role)?.layout?.label ?? role

// No role → always visible | has role → visible only if role === activeRole
const visible = !role || role === activeRole
```

**SOLID O:** new role pair (e.g. `'map'/'table'` or `'annual'/'quarterly'`) → zero shell change.
**PRINCIPLES rule 1:** `role` stays open string — never close to `'chart' | 'table'` union.
`roles.length === 1` → no toggle shown. `roles.length > 1` → one button per distinct role.

---

## D-1 DataBundle — universal contract per dataset

Every dataset module (`src/data/<ds>/raw.ts`) exports the same triplet shape:

```ts
export const <DS>_FACTS:       Observation[]                         // surrogate ids on classifier-backed dims
export const <DS>_CLASSIFIERS: Record<string, Classifier>            // STRUCTURAL only: id → { code, parent? }
export const <DS>_DISPLAY:     Record<string, DisplayMap>            // UI overlay per dim, id-keyed (uniform with classifier)
```

Both `classifiers` and `display` use the **same id space** — display rows
are joined to classifier rows by id (engine handles via `resolveDisplayRef`).
Renaming a business code touches the classifier entry only; display stays
valid. Locale/theme swap = swap a parallel id-keyed map.

`new ExternalStore(facts, { classifiers, display })` — engine reads classifiers
for code↔id translation + rollup expansion; ignores display. `display` is
merged onto classifier entries by `resolveClassifierRef()` only at consumer-
facing `{ $cl }` refs.

**Rationale:** SDMX wire format (Codelist vs annotations), Phase 2 DB shape (one
table per dim + one JSONB column for display), i18n swap (per-locale display),
engine agnosticism enforced by file boundary not just discipline.

`*_CATALOGUE` static exports are **forbidden** — derive year ranges via
`codesOf(REGIONAL_CLASSIFIERS.time)` (engine helper). One source of truth.

Detail: `architecture/18-classifier-pipe.md`.

---

## D-2 Dim refs: `$cl` (structural) vs `$d` (UI)

Two refs, two purposes — explicit separation of concerns:

| Ref | Returns | Use case |
|---|---|---|
| `{ $cl: 'dim' }` | classifier entries `{ code, parent?, …structural }` | hierarchy traversal, structural iteration |
| `{ $d:  'dim' }` | display entries with `code` injected `{ code, label, color, … }` | UI: lookup.from, selectors, find/breadcrumbs |

```ts
// lookup.from — UI fields → $d
{ op: 'lookup', key: 'geo', from: { $d: 'geo' }, fields: ['label', 'color'] }

// InlineSource.items — selector with leaf filter + display labels
{ type: 'inline', items: { $d: 'sector', view: 'leaves' },
  valueField: 'code', labelField: 'fullLabel', … }

// filter-derive source — find/breadcrumbs by code, with UI fields available
{ op: 'find', source: { $d: 'geo' }, by: 'region', idField: 'code', field: 'color' }
```

`view`: `'byCode' | 'items' | 'leaves' | 'rollups'` (omitted = consumer default).
For `$d`, classifier (when present) drives view filter; display supplies attrs.

Pattern parity: Vega-Lite `{signal}`, Grafana `$variable`, MongoDB `$ref`,
Cube.dev `${cube.dim}`, dbt `{{ ref() }}`. Phase 2 Constructor stores refs
verbatim; runtime registry resolves.

**Engine boundaries preserved:** engine internals (`DimResolver`, `ExternalStore`)
read classifier ONLY. `$cl` and `$d` are CONSUMER-facing. Display data NEVER
crosses into engine compute paths.

**No `*_CODELISTS` bundle exports** in store.ts — configs reference via refs,
never reach into pre-computed view dicts.

---

## D-3 DataSpec field rename: `transform` → `pipe`

`transform?: TransformStep[]` field on `'query'` DataSpec, `QuerySource`,
`ApiSource`, `InlineSource` is renamed **`pipe?`**. The `TransformStep` type
name is retained (avoids fanout churn); the array is the **pipeline**, each
entry is a transform step.

Op surface (full force): `melt · rename · cast · filter · sort · addField ·
select · derive · aggregate · rollup · lookup · join`. New capabilities:
- `aggregate` short form: `{ by, measure, agg, as? }`
- `rollup`: append totals row (Cube/OLAP "totals" pattern)
- `derive` string expr: `{ as, expr: 'value / total * 100' }` (shunting-yard)
- `filter` CtxRef: `{ where: { time: { $ctx: 'time' } } }`
- `sort using`: explicit code-order `{ by, using: ['AGRI','MANUF',…] }`
- `lookup.from` accepts `{ $cl }` ref OR inline dict
- `join`: array LEFT JOIN with `{ $cl }` ref OR inline rows + `on`/`onRight`

Detail: `architecture/18-classifier-pipe.md`.

---

## C-5 FilterBarNode.bars — Record in Config, Never Array

```ts
// Config (FilterBarNode.bars) — JSON-serializable, DB-storable:
bars: Record<string, BarDef>
// e.g. { main: { position: 'sticky', order: 1, filters: { time: { type: 'year-select' } } } }

// Runtime (FilterBarSpec[]) — output of useFilters() inside FilterBarRenderer inner component:
bars: FilterBarSpec[]
```

**NEVER** `FilterBarSpec[]` or `[]` in config or examples. `FilterBarSpec` = runtime resolved type.
`BarDef` = config input (JSON-serializable). `FilterBarSpec` = runtime output (has handlers, state).
`useFilters({ bars: node.bars })` → `FilterBarSpec[]` — conversion happens inside renderer.
