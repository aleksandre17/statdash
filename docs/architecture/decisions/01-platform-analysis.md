# Platform Analysis — What We Learned

> ოთხი commercial platform-ის key decisions, ჩვენი equivalent.
> ყოველი architectural choice-ი platform-ზე დაფუძნებულია.

---

## Grafana

**Core pattern:** Plugin JSON declares capabilities → Grafana core renders.

| Grafana | Our Equivalent |
|---------|---------------|
| Dashboard JSON (panel array) | PageConfig (children: NodeDef[]) |
| `PanelPlugin.register()` | `nodeRegistry.register(type, renderer)` |
| `useTheme2()` ThemeContext hook | `useTheme()` → `ctx.theme: ThemeConfig` |
| `bootData` (nav + stores from API on startup) | `fetchSiteManifest()` → `{ stores, pages, nav }` |
| datasource UID → registry | `storeKey: string` → `SiteProvider.stores[storeKey]` |
| Plugin nav.json declares nav section | `nav.config.ts: NavItem[]` (independent of page content) |
| `PanelChrome` wraps plugin, pre-renders | engine wraps child in `<div className="slot--{pos}">`, renderer receives `children: ChildrenArg` |
| `?var-region=tbilisi` URL state | `useSearchParams()` — all filter state in URL |
| Alert conditions in JSON | `effects: [{ when: {...}, set: {...} }]` |

**Key takeaway:** Plugin is content, not structure. Grafana core handles rendering. Same here: renderer is content, engine handles traversal.

---

## Builder.io

**Core pattern:** `builder.get('page', url)` → PageConfig JSON → `<Page def={def} />`.

| Builder.io | Our Equivalent |
|------------|---------------|
| `Builder.registerComponent(Cmp, { name, inputs })` | `nodeRegistry.register(type, renderer)` at `src/setupEngine.ts` |
| `builder.get('page', { url })` | `loadPage(id)` → `PageConfig` |
| `<Page model="page" content={content} />` | `<PageLoader pageId="..." />` → `<SiteRenderer def={def} />` |
| Component receives `children` pre-rendered | `ChildrenArg: { defs: NodeDef[], rendered: ReactNode[] }` |
| Nav/sitemap = separate content model | `nav.config.ts: NavItem[]` — independent of `PageConfig` |
| Visual editor → generates JSON | Constructor (Phase 2) → generates `PageConfig` JSON |
| `builder.get('nav-menu')` separate call | `fetchSiteManifest()` returns `{ pages, nav, stores }` — three concerns |

**Key takeaway:** Content (page) and navigation are separate models. Builder.io never couples page JSON with nav structure. We follow the same principle.

---

## Retool

**Core pattern:** Named datasources, computed state, effect chaining.

| Retool | Our Equivalent |
|--------|---------------|
| Named datasource (query library) | `storeKey: string` → `DataStore` in registry |
| `datasource.query({ params })` | `interpretSpec(spec, ctx, store)` |
| Computed state `{ expr: 'datasource.data.length' }` | `derive: [{ key, expr: ExprVal }]` — DeriveMap |
| Effect chaining `[{ type:'setVariable', ... }]` | `effects: [{ when: Expr, set: Record<string, ExprVal> }]` |
| App-level nav (not per-component) | `nav.config.ts: NavItem[]` — site-level, not page-level |
| Resource by name (string key, runtime resolved) | `storeKey: string` → `SiteProvider.stores[storeKey]` |
| URL params as state | `useSearchParams()` — filter state in URL, permalink-ready |

**Key takeaway:** Computed state is declarative JSON (`{ expr: ... }`), not functions. DeriveMap follows this exactly.

---

## AppSmith

**Core pattern:** Widget JSON tree, canvas renders, app-level config.

| AppSmith | Our Equivalent |
|----------|---------------|
| Widget JSON (type + props) | NodeDef (type + def fields) |
| Canvas renders widget, widget stays blind | Engine renders node, node stays blind to parent |
| App-level nav config (pages can be hidden) | `NavItem.hidden?: boolean` in `nav.config.ts` |
| Page ≠ nav item (explicit linking) | `NavItem.pageId?` links to PageConfig (optional) |
| Container widget receives children | `ChildrenArg` — pre-rendered children array |
| Datasource install → use by name | `SiteProvider.stores` registry → `storeKey` reference |

**Key takeaway:** Hidden pages (admin, landing) exist in the system but not in nav. `NavItem.hidden` + `NavItem.pageId?` is optional — direct result of this pattern.

---

## Vega-Lite (data philosophy)

| Vega-Lite | Our Equivalent |
|-----------|---------------|
| `compile(spec)` — pure transform | `interpretSpec(spec, ctx, store) → DataRow[]` |
| Spec declares WHAT, not HOW | DataSpec declares what data, engine resolves how |
| No side effects in transform | `interpretSpec` = pure function (same inputs → same output) |

**Key takeaway:** Data transformation is a pure function. No async in renderer. No side effects in config. `interpretSpec` is our `compile()`.

---

## Consensus Across All Platforms

| Concern | All Platforms Say |
|---------|------------------|
| Extensibility | Registry pattern (register type → handler) |
| Children | Pre-rendered, array-based, parent blind |
| Theme | Context/hook injection, not props threading |
| Nav | Site-level concern, independent of page content |
| State | URL params (permalink), declarative |
| Data | Named sources, declarative spec, runtime resolved |
| Constructor | JSON-serializable everything |
