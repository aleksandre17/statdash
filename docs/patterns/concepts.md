# Architectural Concepts — WHY we do what we do

> ყოველი concept: origin + ჩვენი კონკრეტული გამოყენება ახალ arch-ში.
> "ახალი decision-ის წინ: ეს სტანდარტი ამ პრობლემას როგორ წყვეტს?"

---

## ✅ დანერგილი

### Grammar of Graphics
Wilkinson 1999 → ggplot2, Vega-Lite, Observable, Altair.
**ბირთვი:** data model ≠ visualization. ერთი data source → n × view (table, chart, export).
**ჩვენთან:** `DataSpec → interpretSpec → DataRow[] → DataTable + Chart`
ერთი `DataSpec` → chart + table + export. ცვლილება ერთ ადგილას.

### SDMX (Statistical Data and Metadata eXchange)
ISO 17369. Eurostat, IMF, World Bank, UN official standard.
**ბირთვი:** indicator codes (B1G, D1, P5…), DSD (Data Structure Definition), Dataflow.
**ჩვენთან:** indicator code naming (`B1G`, `D4_REC`…), `DataSpec` types mirror SDMX Dataflow.
`fromSDMX()` = ერთადერთი ადგილი API format → internal `DataRow[]`.

### Config-Driven Rendering
**ბირთვი:** page = pure renderer. ყველა structure config-შია. UI კოდი არ იცის data-ს შესახებ.
**reference:** Grafana dashboard JSON, Builder.io page tree, Eurostat CMS.
**ჩვენთან:** `NodeDef` tree → `renderNode()` → ReactNode.
`JSON.parse(JSON.stringify(nodeDef)) === nodeDef` ✅ — Constructor DB-ში ინახავს.

### Repository Pattern
**ბირთვი:** data access abstracted behind interface. consumers არ იციან source-ის შესახებ.
**ჩვენთან:** `DataStore` interface → `StaticDataStore` / `ApiStore` / `CachedStore`.
`interpretSpec(spec, ctx, store)` — ნებისმიერ `DataStore`-ს იღებს. Store swap = zero config change.

### Declarative over Imperative
**ბირთვი:** describe WHAT, not HOW. serializable, analyzable, generatable.
**ჩვენთან:** `data: DataSpec` (declarative) replaces `getRows: (ctx) => DataRow[]` (imperative).
Declarative = Constructor ინახავს DB-ში. Imperative function = ❌ ვერ ინახავს.

### Single Source of Truth
**ბირთვი:** ერთი canonical state. ყველა view derives from it.
**ჩვენთან:** `DataRow[]` from `interpretSpec` → table + chart.
`filterSchema` on `PageConfigBase` = single owner for all filter state — არა per-node.
URL params = single source for filter values.

### URL as State
**ბირთვი:** application state lives in URL. shareable, bookmarkable, back/forward works.
**reference:** Eurostat dataset explorer, ONS data explorer.
**ჩვენთან:** `FilterContext` + `useSearchParams` — ყველა filter param URL-შია.
URL = permalink. filter change → URL update → reload → same state ✅.

### Escape Hatch (Custom DataSpec)
**ბირთვი:** declarative system-ს აქვს `custom` გამოსვლა კომპლექსური შემთხვევებისთვის.
**reference:** CSS `!important`, React `dangerouslySetInnerHTML`, GraphQL `@client`.
**ჩვენთან:** `{ type: 'custom', id: 'sna-hero' }` in DataSpec +
`defaultRegistry.register('custom', myResolver)` in engine setup.
Config = plain JSON ✅. Resolver = registered in engine, not inline in config.

---

## ⏳ მიმართულება (შემდეგი ეტაპები)

### Constructor / Low-Code Platform
**ბირთვი:** admin UI generates JSON configs. developer არ სჭირდება ახალი გვერდების შექმნისთვის.
**reference:** OECD.Stat "Customise", Eurostat dataset builder, Grafana dashboard editor.
**ჩვენთან:** Constructor → `NodeDef` JSON + `DataSpec` JSON → `renderNode()` → rendered page.
Phase 2: `fetchSiteManifest()` fetches from API — one line change in `manifest.ts`.

### Prefetch / Batch Loading
**ბირთვი:** N queries → one round-trip. წინასწარ ყველა საჭირო data ერთ call-ში.
**reference:** React Query, SWR, GraphQL DataLoader, Grafana parallel data queries.
**ჩვენთან:** `DataStore.batchQuery?(queries, ctx)` — `StoreCaps.batching: true`.
`runBatch()` helper — uniform interface across store types. Full design → `docs/archive/migration-specs-gen2/01-blockers.md`.

### SNA 2008 / ESA 2010
UN/Eurostat national accounts standard. accounting identities as data constraints.
**ჩვენთან:** indicator chain `P1 → B1G → B2G → B5G → B6G → B8G → B9` enforced in data layer.
`isCarryForward` filter + SNA dedup — data boundary-ზე, არა renderer-ში.

### Separation of Concerns
**ბირთვი:** data / config / rendering — დამოუკიდებელი layers. ცვლილება ერთში = zero effect სხვაში.
**ჩვენთან (ახალი arch):**
```
packages/engine/  ← data logic  (interpretSpec, DataStore, StoreQuery)
packages/react/   ← render logic (renderNode, NodeRenderer, RenderContext)
plugins/          ← shell impls  (UI per node type)
src/pages/        ← config layer (NodeDef JSON trees)
src/data/         ← data boundary (fromSDMX, store instances)
```

### Vintage Data / Revision Tracking
**reference:** IMF WEO — preliminary vs revised vs final. ONS revision policy.
**ბირთვი:** data-ს სტატუსი explicit-ია — preliminary badge, revision note, last updated.
**ჩვენთან:** ⏳ `Indicator.status: 'preliminary'|'revised'|'final'` — not yet implemented.
→ `individual/context/gaps.md` item 4 (metadata / data provenance).

### Metadata alongside Data
**reference:** Eurostat, ONS — methodology links, source notes, revision dates per indicator.
**ბირთვი:** ყოველ indicator-ს: source · methodology URL · last revised · unit · decimals.
**ჩვენთან:** ⏳ `Indicator.metadata?: { source, methodologyUrl, lastRevised }` — not yet.
→ `individual/context/gaps.md` item 4 (metadata / data provenance).