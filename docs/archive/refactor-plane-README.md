
# Refactor Plan — Geostat National Accounts

> სრული არქიტექტურული გეგმა. ყველა შეთანხმება, ტიპი, წესი, migration path.
> **პრიორიტეტი:** ახალი არქიტექტურა — სტანდარტია. კოდი ეგუება, არა პირიქით.

---

## How to Execute (New Session Guide)

This folder is self-contained and executable. A new session with no prior context can implement the full migration by reading in this order:

```
0. PRINCIPLES.md                        — philosophy, mindset, collaboration rules (read before anything)
1. decisions/00-decision-framework.md   — how we make decisions (read first)
2. decisions/05-architecture-mandate.md — the operating principle (bold, fearless)
3. decisions/02-non-negotiables.md      — immutable rules
4. architecture/10-agreements.md        — all 19+ confirmed agreements
5. types/all-types.md                   — complete TypeScript reference
6. migration/01-violations.md           — what needs to change (prioritized)
7. migration/02-strangler-fig.md        — step-by-step migration plan
```

Then for any specific topic → see the detailed files below.

**The one rule above all:** Architecture leads. Codebase follows. Never adapt the new design to old code.

---

## File Map

### decisions/ — Why We Decided What We Decided

| File | Contents |
|---|---|
| `00-decision-framework.md` | ★ 4-step decision process · 5 tests · authority hierarchy |
| `01-platform-analysis.md` | Grafana/Builder.io/Retool/AppSmith/Vega-Lite comparison |
| `02-non-negotiables.md` | Immutable rules from CLAUDE.md + all agreements |
| `03-anti-patterns.md` | 15 anti-patterns with before/after + why |
| `04-solid-principles.md` | SOLID mapped to our architecture (litmus tests) |
| `05-architecture-mandate.md` | "Architecture leads, codebase follows" doctrine |
| `06-key-success-rules.md` | Generic over concrete · Vite trap · renderer hooks · JSONB |

### architecture/ — How the System Works

| File | Contents |
|---|---|
| `01-monorepo-overview.md` | Dep graph · layer rules · three separations in src/ |
| `02-node-system.md` | NodeBase · NodeDef · NodeRegistry · ChildrenArg · visibleWhen |
| `03-theme-system.md` | ThemeConfig · shell access pattern · DEFAULT_THEME · AppChrome |
| `04-render-pipeline.md` | Full renderNode() pipeline · SiteRenderer · Chrome flow |
| `05-data-pipeline.md` | DataSpec types · interpretSpec · multi-store · fromSDMX |
| `06-expression-system.md` | @geostat/expr types · evalExpr · evalDerived · native→Expr |
| `07-filter-system.md` | defineFilters · useFilters · Phase 2 compat · FlatFilters |
| `08-site-manifest.md` | NavItem · SiteManifest · SiteProvider · Phase 2 DB schema |
| `09-layout-system.md` | LayoutHints · CSS-first · SlotWrapper removed |
| `10-agreements.md` | All 19+ agreements confirmed |
| `11-backend-standards.md` | SDMX DSD · Kimball · fromSDMX · SNA sequence · JSONB |
| `12-ux-standards.md` | ONS/Eurostat UX · Page anatomy · WCAG 2.1 AA · export |
| `13-testing-strategy.md` | Risk matrix · interpretSpec tests · evalExpr · fromSDMX |
| `14-next-priorities.md` | Error handling · skeletons · tests · metadata · memoization |
| `15-constructor.md` | Constructor Phase 2 architecture · node schema registry · transform list · data catalog API |
| `16-styling-architecture.md` | CSS Custom Properties + CSS Modules + BEM · token file · layer rules · DEFAULT_THEME vs GEOSTAT_THEME · Phase 2 white-labeling |
| `17-data-cube.md` | SDMX N-D model · CubeQuery · Encoding Spec · geo+breakdown dims · DataStore evolution · migration path ეტაპი 1–5 |
| `18-classifier-pipe.md` | DataBundle (facts + classifiers + display) · `{ $cl }` refs · pipe ops (rollup, aggregate-short, derive-string, filter-CtxRef, sort-using, lookup-with-ref, join) · PipelineContext · InlineSource · regional reference impl |

### SKELETON.md — Full Implementation Skeleton

> სრული სიმულაციური ფაილების სისტემა. ყველა package + src/ ყველა key file-ის stub.

| File | Contents |
|---|---|
| `SKELETON.md` | engine/expr · engine/core · engine/react · src/ — complete file tree + code stubs |

### types/ — TypeScript Reference

| File | Contents |
|---|---|
| `all-types.ts` | Complete type definitions for all three packages |

### packages/ — Package Details

| File | Contents |
|---|---|
| `expr.md` | @geostat/expr: structure · ExprVal · evalExpr · key rules |
| `engine.md` | @geostat/engine: structure · DeriveEntry · DataLookupOp |
| `react.md` | @geostat/react: structure · Agreement #19 public API |

### src/ — App Layer

| File | Contents |
|---|---|
| `overview.md` | src/ tree · three separations · layer rule #17 · GEOSTAT_THEME |

### migration/ — What to Do

| File | Contents |
|---|---|
| `00-pre-flight.md` | Phase 1 backend constraints + what doesn't exist yet |
| `01-violations.md` | 15 violations across 5 priority levels |
| `02-strangler-fig.md` | ①②③🗂④⑤⑦⑥⑧🗑 step-by-step with code |

### future/ — Future Projects (Planning Only)

| File | Contents |
|---|---|
| `01-database/overview.md` | Database migration planning skeleton |
| `02-backend-java/overview.md` | Java backend planning skeleton + known endpoints |
| `03-constructor/overview.md` | Constructor Phase 2 planning skeleton |

### examples/ — Concrete Code

| File | Contents |
|---|---|
| `gdp-page-config.ts` | InnerPageNode with filter-bar, kpi-strip, section |
| `tab-page-config.ts` | TabPageNode + ContainerPageNode |
| `filter-schema.ts` | defineFilters + useFilters + Phase 2 scenario |
| `nav-config.ts` | NavItem[] independent of PageConfig |
| `site-manifest.ts` | SiteManifest + fetchSiteManifest() layered + SiteProvider 3-prop wiring + App.tsx + catch-all routing + PageLoader + hooks |
| `main.tsx` | Top-level await bootstrap · Grafana bootData pattern · Phase 1↔2 zero changes · anti-pattern comparison |
| `constructor-registry.ts` | nodeRegistry.register() with meta · list() · getSchema() · engine.listTransforms() · data catalog API · buildDataSpecFromCatalog() |
| `data-spec.ts` | All DataSpec types · by-param · pipe · encoding · static↔API store swap · codebase pattern mapping |
| `transform-pipeline.ts` | ★ All 15 TransformStep operations · composition · DeriveExpr · ExprParser · real pipelines (accounts, regional, GVA) |
| `encoding.ts` | ★ EncodingSpec · applyEncoding() · pct variants · negate · seriesFormat · seriesOrder · hierarchy channels · full pipeline |
| `http-data-store.ts` | HttpDataStore full example · TRANSFORM_MAP open registry · type:'url' vs href · Suspense · setupEngine() |
| `filter-shell.tsx` | GeostatFilterBarShell · registerFilterControl() registry (Open/Closed) · useFilter() hook communication · setupFilterControls() |
| `chart-def.ts` | ChartDef Grammar of Graphics examples · open encoding channels · interpretChart→ChartOutput→toApexOptions pipeline |
| `vertical-slice.ts` | Full stack: SQL schema · SDMX-JSON wire format · fromSDMX Phase1/2 · isCarryForward SNA dedup · DataStore setup · engine.renderNode · swap matrix |
| `visible-when.ts` | visibleWhen ExprVal on NodeDef + filter-level visibility |
| `theme-config.md` | GEOSTAT_THEME + GeostatAppHeader implementation |
| `renderer-section.md` | NodeRenderer + Shell + component wrapper pattern |
| `derive-map.ts` | DeriveMap pure + engine DataLookupOp + order matters |

---

## docs/ — Project Knowledge Layer

> `docs/` = historical context, narrative guides, vision. For authoritative architecture → use files above.
> **Session entry point:** [`.claude/README.md`](../.claude/README.md) — skills · rules · context · patterns

| docs/ file | What it adds beyond refactor-plane/ |
|---|---|
| [`PRINCIPLES.md`](../docs/PRINCIPLES.md) | Philosophy · 5 inviolable rules · SOLID mapping · collaboration format (canonical) |
| [`VISION.md`](../docs/VISION.md) | Product direction · current status · known gaps · Phase 2 plans |
| [`concepts.md`](../docs/concepts.md) | Implemented vs future concepts inventory (GoG, SDMX, CDR…) |
| [`fixes_log.md`](../docs/fixes_log.md) | FIX-01..09 session history |

---

## Quick Reference — Rules That Never Change

```
engine/react/  → zero app content         src/ nodes → engine.extend()
ctx.theme.shells['type']  → ALWAYS          never direct import in engine/react/
layout.position/order/span/label/role       CSS-first, engine wraps, parent blind
ChildrenArg: { defs, rendered }             tab labels from defs[i].layout.label
defineFilters() = pure schema (no hooks)    useFilters() = hook (URL state)
DeriveMap = Array<{ key, expr }>            NOT Record — order explicit
ctx.stores: Record<string, DataStore>       NOT ctx.store (multi-store)
NavItem[] independent of PageConfig         nav.config.ts, NOT PageConfig.nav
NodeRenderer = plain function               hooks → Shell or inner component only
Generic before concrete                     groupBySpan<T> not groupSectionsBySpan
JSON-serializable config                    functions/JSX in config = Phase 2 fail
```

---

## SOLID in One Line Per Principle

| Principle | Our Rule |
|---|---|
| **S** — Single Responsibility | Renderer dispatches. Shell renders. Adapter converts. |
| **O** — Open/Closed | `engine.extend()` extends. Never modify packages/ for app features. |
| **L** — Liskov | Engine dispatches by `type` string, never branches with if/switch. |
| **I** — Interface Segregation | Per-shell typed props. DeriveMap/DeriveEntry split by package. |
| **D** — Dependency Inversion | `ctx.theme.shells` injects. `DataStore` abstracts. Never concrete imports. |

---

## Project Identity

- **Who:** Geostat — საქართველოს ეროვნული სტატისტიკა
- **Stack:** React + TypeScript + Vite + Monorepo (local packages)
- **Goal:** JSON-driven page rendering. Constructor (Phase 2) creates any page with zero code.
- **Standard:** Eurostat · ONS · World Bank · IMF · OECD

---

## Monorepo (one-line per package)

| Package | Role |
|---------|------|
| `engine/expr/` `@geostat/expr` | Pure TS expression evaluator. Zero deps. |
| `engine/core/` `@geostat/engine` | Data pipeline. interpretSpec, evalDerived, fromSDMX. |
| `engine/react/` `@geostat/react` | React adapter. Engine bridge. Zero app content. |
| `src/` | Geostat app. Configs, data, brand shells. |

Dependency: `@geostat/expr` ← `@geostat/engine` ← `@geostat/react` ← `src/`

---

## Phase 2 Compatibility Test

Before adding any feature, ask:

> "Constructor-ი ამ config-ს JSON-ად შეინახავს DB-ში და გამოიღებს — იმუშავებს?"

```ts
JSON.parse(JSON.stringify(value)) // must equal value
```

- ✅ `{ op: 'eq', left: { $ctx: 'mode' }, right: 'year' }` — ExprVal, JSON, works
- ✅ `Array<{ key, expr }>` — DeriveMap, JSON, ordered, works
- ✅ `NavItem[]` in nav table — JSON, independent rows, works
- ❌ `(ctx) => ctx.rows.filter(...)` — function, NOT JSON, fails Phase 2

---

## The Architecture Mandate

> **ახალი არქიტექტურა — სტანდარტია. კოდი ეგუება, არა პირიქით.**

- "ახლა ასეა კოდში" — **is not an argument**
- "ეს ძველი კოდი გაართულებს" — **is not a blocker**
- Migration = Strangler Fig: new → switch → delete. No step 1.5.

Details: `decisions/05-architecture-mandate.md`
