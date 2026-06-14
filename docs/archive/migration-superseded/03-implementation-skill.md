# Migration Skill — Implementation Rules

> ეს არის სამუშაო კონტრაქტი migration-ისთვის.
> ყველა session-ი, რომელიც migration-ს ეხება, ამ დოკუმენტს ემყარება.
> PRINCIPLES.md-ის დამატება, არ ჩაანაცვლებს.

---

## Core Direction — ეს არ განიხილება

**ახალი არქიტექტურა არ ეგუება ძველს. ძველი ეგუება ახალს.**

ძველი კოდი = migration target. ახალი arch = ground truth.
თუ ძველი კოდი რაღაცას სხვანაირად აკეთებს — ძველი კოდი იცვლება.
თუ ახალი arch-ში pattern-ი განსხვავდება — ახალი arch იმარჯვებს.
გამონაკლისი: ნული.

---

## Rule 1 — Architecture leads, code follows

ახალი arch documents-ი (refactor-plane/):
- `types/all-types.md` — canonical type reference
- `SKELETON.md` — 4-layer structure
- `architecture/*.md` — design decisions
- `examples/*.ts` — usage patterns

ყველა implementation ამ sources-ს მიჰყვება. კოდი, რომელიც
all-types.ts-ს ეწინააღმდეგება — არასწორია. Refactor-plane — ჩვენი standard.

---

## Rule 2 — Phase 1 = static JSON + Phase 2 ready. ერთდროულად.

**Phase 1:** pages/ folder-ი შეიცავს სტატიკურ NodeDef JSON configs-ს.
**Phase 2:** ერთი გადართვა manifest.ts-ში — ყველაფერი constructor/DB-ზე გადადის.

### Phase 2 readiness contract

გადართვა = **ერთი ფაილი, ერთი ხაზი:**

```ts
// src/manifest.ts — THE SINGLE SEAM
// Phase 1 (now):
export async function fetchSiteManifest(): Promise<SiteManifest> {
  return {
    datasources: DATASOURCE_CONFIGS,
    pages:       pagesRecord(),
    nav:         NAV,
    tokens:      GEOSTAT_TOKENS,
    chrome:      { AppHeader: 'default', AppSidebar: 'default' },
  }
}

// Phase 2 (one line change):
export async function fetchSiteManifest(): Promise<SiteManifest> {
  return fetch('/api/site').then(r => r.json())
}
```

**ამ ხაზის გამოცვლის გარდა, main.tsx, App.tsx, routes.tsx, SiteProvider — ვერაფერი იცვლება.**
თუ Phase 1-ის implementation-ი ამ contract-ს ტოვებს, ის არასწორია.

### Phase 2 readiness checklist (ყოველი ფაილისთვის)

```
□ SiteManifest.datasources: DatasourceInstanceConfig[]  — JSON ✅ (NOT DataStore)
□ SiteManifest.pages: Record<string, PageConfig>        — JSON ✅
□ buildStoreManifest(datasources) → DataStore[]          — works from both phases
□ engine.registerDatasource() called before buildStoreManifest()
□ No Phase 1-only API outside manifest.ts
□ No hardcoded store references in App.tsx / SiteProvider
```

---

## Rule 3 — Full implementation. არაფერი არ რჩება "მოგვიანებით".

**"ახლა ეს გვერდი არ გვაქვს" — არ ნიშნავს "shell-ი არ უნდა დავწეროთ".**
**"ახლა geo-map არ გვიყენია" — არ ნიშნავს "GeoMapShell Phase 2-ისთვის".**

ყველა ახალი arch component-ი implement-ირდება სრულად:

```
interpretSpec    → ყველა DataSpec type (8 types — ყველა, არა მხოლოდ "used pages")
NodeRegistry     → ყველა node type (geo-map, links, page-header — registered)
FilterControls   → ყველა control type (chip-select — registered)
SectionNav       → ყოველთვის present (SiteRenderer wraps; entries=[] = OK)
GeoRegistry      → registered at bootstrap (empty until geo pages added)
DatasourcePlugin → ყველა 3 plugin (sdmx-api, rest-json, static — registered)
Chrome           → ყველა slot (AppHeader, AppSidebar, AppFooter — wired)
```

**Implementation order rationale:** რაც register-ირდება ახლა, Constructor-ი palette-ში ხედავს Phase 2-ში.
არ register-ირებული node = Constructor palette-ში არ ჩანს = Phase 2-ში გამოყენება შეუძლებელია.

---

## Rule 4 — Strangler Fig. ყოველ ნაბიჯზე.

```
① ახალი კოდი → tsc → 0 → visual check → ✅
② გადართვა (import swap / registration change)
③ ძველი კოდი → DELETE

NEVER: ② → ① (visual regression window)
NEVER: ① → დავტოვოთ ③ "მოგვიანებით"
```

ძველი კოდი, რომელიც replace-ირდა — **same session-ში წაიშლება**.
Coexistence = temporary, not permanent. Dead code = ნებადაურთველია.

---

## Rule 5 — tsc → 0 at EVERY step

ყოველი commit-ი, ყოველი step:
```bash
npx tsc --noEmit    # 0 errors required
```

TypeScript error = step incomplete. შემდეგ step-ზე გადასვლა აკრძალულია სანამ tsc → 0 არ არის.

---

## Rule 6 — Quality gates per step (visual + functional)

ყოველი step-ის შემდეგ:
```
□ npx tsc --noEmit → 0 errors
□ Landing page renders correctly
□ GDP page: filter bar sticky, chart/table toggle, KPI strip visible
□ Accounts page: tab navigation works, content renders
□ Regional page: map renders, geo filter updates
□ Nav sidebar: links correct, active state correct
□ URL state: filter change → URL updates → reload → same state restored
□ No console errors / warnings about unknown node types
```

ნებისმიერი regression = step-ი არ დასრულებულა. შემდეგ step-ზე ვერ გადავდივართ.

---

## Rule 7 — Agnostic and growth-oriented. ყოველ decision-ზე.

Migration-ის დროს გამოჩნდება "shortcuts":

```
❌ "ეს hardcode-ი ახლა კი, Phase 2-ში გამოვასწორებ"
❌ "ახლა chip-select-ი არ გვჭირდება, მოგვიანებით"
❌ "ეს string union ახლა closed, Phase 2-ში open გავხდი"
❌ "ctx.year ახლა კი, ctx.dims['time'] Phase 2-ში"
❌ "packages/-ში Geostat-specific კოდი ახლა კი"
```

ეს shortcuts **migration-ის შემდეგ დარჩება**. Phase 2 არ "გაასუფთავებს" technical debt-ს.

Non-negotiables:
```
ctx.dims['time'] as number   ✅    ctx.year / ctx.regionId        ❌
data: DataSpec               ✅    getRows: (ctx) => DataRow[]    ❌
JSON-serializable config     ✅    JSX / functions in config      ❌
open ParamDefMap / NodeTypeMap ✅  closed union                   ❌
packages/ = zero app content ✅    Geostat brand in packages/     ❌
```

---

## Migration Order — Dependency Graph

```
① Engine layer          engine/core/src/
   DataStore interface  val/observe → query(): EngineRow[]
   interpretSpec        all 8 DataSpec types
   DatasourcePlugin     registerDatasource, buildStoreManifest
   SuspenseStore        Tier 1/2/3 classifiers
   GeoRegistry          register/get/has

② React layer           engine/react/src/
   Types                NodeTypeMap, ParamDefMap, RenderContext updates
   SectionNavContext    SectionNavProvider + useSectionNav()
   SiteContext          stores + pages + nav + chrome
   FilterContext        unchanged (already correct)
   Engine               renderNode (data-section-id, resolveNodeRows)

③ Data layer            src/data/
   datasources.ts       DATASOURCE_CONFIGS: DatasourceInstanceConfig[]
   geo/                 GeoJSON files for geoRegistry
   adapters             fromSDMX stays
   DELETE store-manifest.ts

④ Plugin layer          plugins/
   nodes/               All shells: section, chart, table, kpi-strip, filter-bar,
                         geo-map, links, page-header, inner-page, tab-page, container-page
   chrome/              AppChrome, AppHeader, AppSidebar, AppFooter
   controls/            year-select, cascade, select, range, multi-select, chip-select
   landing/             hero, stats

⑤ App bootstrap         src/
   setupRegistrations   engine.registerDatasource + nodeRegistry + geoRegistry
   manifest.ts          THE SEAM (Phase 1 static)
   main.tsx             5-step bootstrap
   routes.tsx           dynamic routes from manifest.pages
   theme.ts             GEOSTAT_THEME (merges DEFAULT_THEME + shells)

⑥ Page configs          pages/  (Track A)
   gdp.config.ts        NodeDef tree
   accounts.config.ts   NodeDef tree (chip-select, section nav)
   regional.config.ts   NodeDef tree (geo-map)
   landing.config.ts    NodeDef tree

⑦ Tests
   interpretSpec unit tests (all 8 DataSpec types)
   FilterSchema integration tests
   renderNode snapshot tests
```

**Rule:** ყოველი tier implement-ირდება სრულად სანამ შემდეგზე გადავდივართ.
გამონაკლისი: ⑤ bootstrap შეიძლება ⑥-ის დაწყებამდე partial იყოს (sequential dependency).

---

## The Single Switch — Phase 1 → Phase 2

Phase 2-ისთვის მზადყოფნა ნიშნავს:

```
manifest.ts     ← ერთი ხაზი: static → fetch('/api/site')
pages/          ← DELETE (Constructor writes to DB)
src/data/*/raw  ← მოიხსნება (data comes from API)

ყველა დანარჩენი — უცვლელი:
  packages/     ← 0 changes
  plugins/      ← 0 changes
  src/app/      ← 0 changes (setupRegistrations, theme, routes)
  src/manifest.ts ← 1 line change
```

Constructor-ი ნებისმიერ moment-ში დაემატება — კოდი არ ელოდება.

---

## What "Implemented" Means

node type-ი "implemented" = :

```
□ Interface in all-types.ts (or module augmentation)
□ NodeSlice in plugins/nodes/{type}/
   □ Shell.tsx      — renders the node
   □ Skeleton.tsx   — loading state (same dimensions as Shell)
   □ META           — { type, label, icon, category, schema }
   □ index.ts       — exports NodeSlice
□ Registered in plugins/nodes/index.ts barrel
□ setupRegistrations.ts imports + dispatches via registerSlice

filter control "implemented" = :
□ FilterControlSlice in plugins/controls/{type}/
   □ Shell.tsx      — renders the control
   □ META           — { controlType, label, category }
   □ codec          — encode/decode URL state
   □ defaultValue   — resolves DefaultSpec
   □ validate       — validates current value
□ Registered in plugins/controls/index.ts barrel
□ setupRegistrations.ts imports + dispatches

DataSpec type "implemented" = :
□ Type in all-types.ts (discriminated union member)
□ SpecResolver in engine/core/src/data/spec.ts
□ Registered in defaultRegistry
□ Unit test: interpretSpec({ type: '...', ... }, ctx, store) → DataRow[]
```

---

## What "Phase 2 Ready" Means Per Layer

```
engine/core/  → no Phase 1 vs Phase 2 distinction here. Pure logic.
engine/react/   → same. No env checks. No Phase flags.
plugins/          → same. Zero Phase awareness.
src/data/datasources.ts → DatasourceInstanceConfig[] (same shape Phase 1 + Phase 2)
src/manifest.ts   → THE ONLY PLACE that knows about Phase. One function.
pages/            → EXISTS Phase 1, DELETED Phase 2. Nothing imports from here outside manifest.ts.
```

---

## Before Starting Each Step

```
1. Read current state: git status, tsc output, which files changed
2. Read the target: all-types.ts + relevant arch doc + relevant example
3. Write new code. Do not modify old code yet.
4. tsc → 0
5. Visual check (all pages)
6. Replace old with new (import swap / registration update)
7. DELETE old code (same session)
8. tsc → 0 again
9. Visual check again
```

---

## Automatic Blockers — stop and resolve before continuing

These must be resolved before any page migration:

```
BLOCKER 1: DataStore interface (val/observe → query)
  All DataStores must implement query() before interpretSpec works.
  interpretSpec calls store.query() — mismatch = runtime crash.

BLOCKER 2: RenderContext (ctx.store → ctx.stores)
  All renderers reference ctx.stores (plural). Mismatch = crash.

BLOCKER 3: FilterBarNode structure (array → Record)
  Old: bars: [] (array). New: bars: {} (Record<string, BarDef>).
  FilterBarRenderer reads new shape. Old configs crash immediately.

BLOCKER 4: SectionNode (chart?/table? → children[])
  Old SectionNode has named fields. New engine reads children[].
  Mismatch = sections render empty.
```

Blockers 1–4 must be resolved in that order before any page config can be migrated.
The migration order above (①②③④⑤⑥) automatically handles this.