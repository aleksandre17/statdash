# RESEARCH — Data-Source-Binding Architecture (the "storeId" system)

> Research-and-judge brief. Reconstructs OUR history (3 old variants → current), surveys how the
> world's leading statistical-dashboard / data-viz platforms bind data, compares honestly, and
> recommends. **No code changed.** Author: architect (Opus), 2026-06-26.
> Builds on the architect ADRs: `adr_data_source_reference_spectrum`, `adr_data_reference_render_vision`,
> `adr_multistore_storeid_reintroduction`, `adr_data_blending_decision`.

---

## 0. Executive summary (read this first)

**The question.** "We once had three ways to bind data to a chart — LOCAL (inline), HREF (fetch a URL),
and storeId (run it through a query/pipe). The current system looks different. Which architecture is
better, and have we lost something?"

**The answer, in one line.** *We did not lose the three variants — we promoted them from three
disconnected mechanisms into **three KINDS behind ONE port**, which is strictly the better architecture
and is exactly what every best-in-class platform (Vega-Lite, Grafana, Retool, Superset, Cube) converges
on. As of today that promotion is **shipped in code**, not aspirational.*

**The crucial finding (verified in the repo, not from memory).** The evolution this brief would have
*recommended* has **already been implemented**. The three variants are alive and unified:

| Old variant | Today | Evidence |
|---|---|---|
| **LOCAL / inline** | `kind: 'static'` store **+** node-local `transform.source` | `packages/plugins/datasources/static-registrations.ts:119` registers `static`; `core/data/transform` keeps node-local inline rows |
| **HREF / fetch-a-URL** | `kind: 'href'` store, fetch + format-parse + auth + SSRF allowlist | `packages/plugins/datasources/href-registrations.ts:351` registers `href` |
| **storeId / query+pipe** | `kind: 'stats'` store (the live cube) + `DataSpec` query/pipe | `packages/plugins/datasources/stats-registrations.ts:98` registers `stats` |

All three are **the same `DataStore` interface**, built by `registerStoreBuilder(kind, fn)` and dispatched
by `buildStoreManifest`. A node references one by `storeKey`; `resolveStore` (a CSS-cascade) resolves the
key to a store **regardless of kind**. On top of that, two further capabilities that the old system never
had now exist: a **semantic layer** that lets a metric *name its store* (`metric-store.ts` / `MetricDef.dataSource`,
the Cube.dev pattern), and a **declarative cross-store `blend`** step (`core/data/transform/types.ts:304`,
the Tableau/Grafana-Mixed pattern).

**Verdict.** **Keep the current architecture — it is the correct one for this platform class, and it is more
complete than the old three-variant system, not less.** The old system's three variants were *three parallel
code paths*; the current system is *one port with N pluggable kinds* — the canonical, OCP-clean,
Constructor-ready hybrid. Nothing was lost; the binding model was *unified and extended*. The only refinements
worth tracking are bounded and already have named doors (semantic-layer adoption-in-anger, blend grain
reconciliation, the symmetric query planner) — all correctly deferred behind YAGNI.

**What to explicitly NOT do:** do not reintroduce a node-level `data: { values | url | name }` union as a
*second* "which source" mechanism (it would fragment against `storeKey`); do not build a symmetric N-store
query planner / server-side join before a real consumer; do not restore the old per-page imperative
`STORE_MANIFEST` static-import wiring.

---

## 1. What the OLD system actually was (the three variants, from git)

The pre-de-tenant code (`git show 7a47e5d^`) carried the three variants as **three different mechanisms
living in three different places** — which is exactly why "we had three variants" feels true but no single
file held them:

- **1a. LOCAL / inline — *data baked into the app*.** `apps/geostat/src/data/{gdp,accounts,regional}/raw.ts`
  held literal observation arrays; `adapter.ts` ran them through `fromSDMX`; `store.ts` wrapped an in-memory
  store; `store-manifest.ts` wired them by **static import** into a hardcoded `STORE_MANIFEST = { gdp, accounts, regional }`.
  *Data is in the bundle.* Fatal flaw for a JSON platform: a new cube/tenant was a **code change**, not config.
- **1b. HREF — *fetch from a URL*.** Two surfaces: the selector type `ApiSource = { type:'api'; url }` in
  `source.ts`, and the design doc's `sdmx-api`/`rest-json` plugins (`25-datasource-system.md` — fetch
  `config.url` + `auth` + `structureUrl`, behind `SuspenseStore`, three-tier `ApiResponse<T>` envelope).
  *Data lives at a remote URL; fetch + parse it.*
- **1c. storeId — *named cube, queried + piped*.** `DatasourceInstanceConfig { id, kind, url?, params? }`
  named a store by `id`; a node referenced it by `storeKey`; a `DataSpec` (`query` + `pipe`) declared what to
  ask. The mode the user remembers as "ran the data through a query/pipe": a queryable store + a declarative query.

**So the old model was genuinely three things** — *data-in-the-bundle*, *data-at-a-URL*, *data-in-a-named-cube*
— but expressed as a static manifest, a selector type, and a config descriptor. **No single abstraction tied
them together.**

---

## 2. What happened (the honest archaeology)

Two forces reshaped this — neither was "delete the variants":

1. **De-tenanting (ADR-0026/0028) collapsed the backend to ONE.** `apps/geostat` became a content-agnostic
   SDUI runner whose data comes from `GET /api/bootstrap → config.data_source` rows, all `kind: 'stats'`.
   With a single internal Postgres backend, *there was nothing for `local` or `href` to point at* — every
   real source was the stats API. So the runtime only ever registered the `stats` builder. The other two
   kinds had **no registered builder** and briefly became latent/ghost code (the `ApiSource` selector type
   survived its consumer; `local` survived only as scattered fragments — a Null-Object store, node-local
   `transform.source`, inline selector items).

2. **The hardcoded static manifest was correctly killed.** `buildStoreManifest(configs) → Record<storeKey, DataStore>`
   replaced the imperative `STORE_MANIFEST = { gdp, accounts }` static-import wiring. *This is the single
   biggest improvement over the old system*: datasources became **data** (DB rows the Constructor can write),
   not code. Three real cubes (`gdp`/GDP_ANNUAL, `accounts`/ACCOUNTS_SEQUENCE, `regional`/REGIONAL_GVA) are
   now **seeded as config rows**, not imported as modules.

The intermediate state (which the architect ADRs diagnosed in June 2026) was: *storeId fully live and
load-bearing; local surviving as four scattered fragments; href a compile-time ghost.* The ADRs recommended
re-unifying local/href/storeId as **three kinds behind the one port**, registering `static` now, and gating
`href` behind a named door. **That recommendation has since been executed in code** (§3).

---

## 3. What the CURRENT system is (verified in the repo, 2026-06-26)

The current architecture is a **port-and-adapter datasource model** with a **declarative query/binding layer**
on top. Five layers, bottom-up:

### 3a. The `DataStore` port (one interface, the SSOT)
`packages/core/src/data/store.ts`. Every source — inline, remote, or live cube — is a `DataStore` with a
unified `StoreQuery` discriminated union (`val` OLAP cell · `obs` multi-dim rows · `schema` Constructor
palette · `distinct` dropdown options), a sync fast-lane (`querySync`) **and** an async envelope
(`queryAsync → QueryResult{state,data,error,meta}`), with `StoreCaps` declaring batch/stream/sync.
`staticStore` is the Null-Object fallback; `fromSDMX` is the sole adapter boundary (Law 5). This is the
Grafana `DataSourceApi` / Cube `CubeApi` shape, expressed once.

### 3b. The store-builder registry (the OCP extension point) — the three kinds
`registerStoreBuilder(kind, fn)` + `buildStoreManifest(configs)`. **Three kinds are registered today**, and
they ARE the old three variants, unified:

| Kind | = old variant | Builder | What it does |
|---|---|---|---|
| **`static`** | LOCAL/inline | `static-registrations.ts:119` | `new ExternalStore(params.values, {classifiers, display})` — serves inline literal rows through the port. Zero network. (Vega-Lite `values`.) |
| **`href`** | HREF | `href-registrations.ts:351` | `fetch(url) → format-parse → EngineRow[] → ExternalStore`. Ships a **format-parser registry** (json/csv, OCP-open) **and** an **auth-strategy registry** (none/bearer/header), with a **default-safe SSRF allowlist** (`params.allowedOrigins` / `VITE_HREF_ALLOWED_ORIGINS`; no allowlist ⇒ no fetch; secrets never logged). (Vega-Lite `url` + `format`.) |
| **`stats`** | storeId | `stats-registrations.ts:98` | The live cube: per-dim classifier fetch at build time + per-query `ApiStore` (Cache-Aside via `CachedStore`). (Vega-Lite `name`, the governed live source.) |

The descriptor is `DatasourceInstanceConfig { id, kind, url?, params? }` — **pure JSON** (Law 2). Adding a
fourth kind = one `registerStoreBuilder` call + extend `params`; **zero edit to `buildStoreManifest` or any
engine resolver** (OCP). The registry also carries optional `getMetadata`/`testConnection` capabilities
(`source-descriptor.ts`, `SourceMetadata`) — the Constructor's "add → test → browse dims" authoring seam
(Grafana/Retool pattern).

### 3c. The routing layer (which named store a node reads)
A page declares `storeKey`; a node may override it; `resolveStore` (`react/engine/resolveNodeRows.ts`) does a
**CSS-cascade** (node override → page → first → `staticStore`). **Mode-blind**: it resolves a `storeKey` to a
`DataStore` whatever its kind. `resolveStoreByKey` is the explicit (non-cascade) form used by blend.

### 3d. The binding/query layer (what the chart asks for) — the storeId "query/pipe" half
`DataSpec` (discriminated union: `query` · `row-list` · `timeseries` · `growth` · `ratio-list` · `pivot` ·
`by-mode` · `transform` · `custom`) → `interpretSpec(spec, ctx, store) → EngineRow[]` → `applyEncoding` →
`DataRow[]` → chart/table. `ObsQuery` (measure + dim filters + orderBy) is the OLAP slice; `$ctx` refs
parameterize it from runtime dims (Law 1: `ctx.dims['time']`, never `ctx.year`). The `pipe`/`transform`
steps (20+ ops, Pipe-and-Filter, registry-driven) are the "ran it through a pipe" half — **still here, richer
than before.**

### 3e. The semantic layer (NEW vs the old system — the middle tier)
`MetricRegistry` / `MetricDef` (`core/data/metric.ts`) + `metric-store.ts`. A node can reference a **named
metric**; `resolveMeasureRef(ref)` resolves it to `{ codes, agg, dims, unit, methodology, dataSource }`; and
**`MetricDef.dataSource` lets the metric NAME its store** (the Cube.dev `dataSource`-on-measure pattern).
`specDataSource(spec)` walks a spec's measure refs and returns the storeKey to route to. This is the
*logical/dataset tier* every best-in-class multi-store platform locates its power in — and the old system
**did not have it at all**.

### 3f. Cross-store blend (NEW — the Tableau/Grafana-Mixed capability)
A declarative `blend` transform step (`core/data/transform/types.ts:304`) names a secondary `storeKey` +
`ObsQuery` + a shared-dim join key + mode; `resolveBlends` (react) resolves the secondary store from the
manifest and **desugars to the pre-built `joinByField` hash-join engine**. The second-store fetch happens in
react (which holds `ctx.stores`), so **core stays single-store and the dependency arrow holds** (Law 3).

**Current data flow, end to end:**
```
config (node.data: DataSpec, optional metric ref, optional storeKey)
  → specDataSource(spec)  ............. metric.dataSource → storeKey   (semantic routing, NEW)
  → resolveStore(ctx)  ............... CSS-cascade storeKey → DataStore (kind-blind routing)
  → interpretSpec(spec, ctx, store)  . DataSpec → EngineRow[]          (the query/pipe)
  → resolveBlends(...)  .............. optional cross-store enrichment  (NEW)
  → applyEncoding → DataRow[] → chart/table
```

---

## 4. The field — how the leaders bind data (and what to steal)

The convergent pattern across the entire class is a **three-tier reference chain**:
*physical source (connection/resource) → logical layer (dataset/model/metric) → binding (panel references the
logical layer, which routes to the physical source)*. Below, the canonical idea from each, mapped to where we
stand.

| Platform | How it binds / abstracts the source | The idea — and our status |
|---|---|---|
| **Vega-Lite** | `data: { values } \| { url, format } \| { name }` — ONE `data` slot, a discriminated union; `format` rides with `url`; named datasets are registered. | **THE canonical model.** values=local, url+format=href, name=storeId. We adopt it *at the store tier* (kind on `DatasourceInstanceConfig`) rather than the node tier — the better form for a governed platform. **Have it.** |
| **Grafana** | Datasource *plugins* (named instances) + inline/CSV/TestData datasources + the **Infinity** plugin (any REST/CSV/GraphQL URL) + the **Mixed** pseudo-source (one panel, N sources) → `join by field` transform. | Inline-data and URL-data are themselves *datasource types*; Mixed = N queries + a join transform. **Have it:** `static`/`href` are kinds; `blend` = Mixed + `joinByField`. |
| **SDMX ecosystem** (.Stat Suite / Data Explorer, Eurostat) | SDMX-REST: a **data query** (`/data/{flow}/{key}`) is separate from a **structure query** (`/structure/...` — DSD, codelists). Structure resolves dimensions; data resolves observations. | **Structure/data separation is our domain model, not a bolt-on:** `Classifier` (Kimball dimension) + `DisplayMap` (presentation overlay) vs observations; `fromSDMX` the adapter. The `stats` builder fetches classifiers per-dim then observations per-query — *the SDMX two-query model, internalized.* **Lead.** |
| **IMF / OECD / World Bank portals** | SDMX or bespoke REST; a dataset/indicator is a named, governed series; the portal queries by indicator code + dims + time. | Confirms **the governed named-cube model** (= our `stats` kind + `storeKey`). Validates storeId as the *correct default* for official statistics. |
| **Cube.dev** | Semantic layer: `cubes` with `measures`/`dimensions`; `dataSource` declared *on the cube/measure*; the query references **semantic names**, the engine routes + joins. | **The measure names its store.** Exactly `MetricDef.dataSource` + `specDataSource`. **Have it** (wired; adoption-in-anger is the open work). |
| **Looker / LookML** | `dimension`/`measure`/`explore` in LookML; joins declared **in the model**, governed + versioned, reused by every viz. | **Joins live in the model, not the viz.** Reinforces: the blend's *relationship* ultimately belongs in the semantic layer (the metric-level blended view — our named door, deferred). The node-level `blend` is the bridge. |
| **Superset / Metabase** | databases → **datasets** (logical tables, dataset-level metrics) → charts; **CSV/Excel upload → a new dataset** (static promoted to named). | **Dataset = the named logical tier; upload-to-dataset = local data promoted into a named store.** The cleanest Constructor story for `static`: paste/upload → a `static` instance in the manifest, referenced by `storeKey` like any cube. |
| **Tableau** | Multiple sources + **data blending** (primary/secondary linked on shared dims) + Live vs Extract toggle. | **Blend on shared dims** = our `blend` (cheap because our dims are generic, Law 1). **Live/Extract** = a future door (freeze a storeId query into a static snapshot). **Have the blend.** |
| **Power BI** | Field wells + **DAX measures** (named, defined once in the model, referenced by every visual); Import vs DirectQuery vs Composite. | Named measures-in-the-model = the semantic-layer thesis (= `MetricDef`). Import/DirectQuery = static/stats duality. **Have the measure model.** |
| **Observable Plot / Framework** | `FileAttachment("x.csv")` (bundled static-by-reference) + `d3.json(url)` (href) + **data loaders** (build-time generation). | `FileAttachment` = *static-by-reference* (name indirection, not bytes inline) — a door for large static datasets (`params.assetId` instead of `params.values`). Data loaders = a build-time ETL alternative to runtime href. |
| **Retool / Appsmith** | **Resources** (named REST/DB connections, registered globally) + static JS/JSON as a resource; queries run per-component. | **Resource = global named source; static JSON and a REST url are BOTH resources.** Identical to `registerStoreBuilder` + node `storeKey`. The strongest external validation that local/href/storeId belong behind ONE registry, dispatched by kind. |

**Three convergent truths from the field, and our position on each:**
1. **The source-mode is a discriminated union on ONE slot** (never three parallel mechanisms). — *Have it:* `kind` on `DatasourceInstanceConfig`, dispatched by `buildStoreManifest`.
2. **Local and href are STORE KINDS, peers of the named cube** (Grafana inline/Infinity, Retool static-JS/REST, Superset upload). — *Have it:* `static`/`href`/`stats` are three kinds behind one port.
3. **Multi-store power lives in the MIDDLE (logical/semantic) tier** (Cube/Looker/Superset/Power BI). — *Have the seam wired* (`MetricDef.dataSource` + `specDataSource`); the open work is *using* it across the seeded cubes, not building it.

---

## 5. Compare + judge — old vs current, and us vs the field

### 5a. Old three-variant system vs current — is the current one better?
**Unambiguously yes, on every axis that matters for this platform class:**

| Axis | Old (3 parallel mechanisms) | Current (3 kinds, 1 port) | Winner |
|---|---|---|---|
| **Add a new source** | Code change (new `raw.ts` + import, or a new selector type) | A `config.data_source` DB row (`kind` + `params`) | **Current** (Law 5, Constructor-ready) |
| **Unifying abstraction** | None — static manifest ≠ selector type ≠ descriptor | One `DataStore` port, kind-dispatched | **Current** (SSOT, OCP) |
| **Round-trip / serializable** | Static imports are code, not config | `kind`/`url`/`params` are plain JSON | **Current** (Law 2) |
| **Routing** | Hardcoded `STORE_MANIFEST` lookup | CSS-cascade `resolveStore`, composes | **Current** |
| **Logical/semantic tier** | Absent | `MetricDef.dataSource` (Cube pattern) | **Current** (the field's "where the power is") |
| **Cross-source** | Absent | Declarative `blend` → `joinByField` | **Current** |
| **The query/pipe (what users liked about storeId)** | `DataSpec` query + pipe | Same `DataSpec`, richer ops | **Tie / Current** — *nothing was lost here* |

The old system's three variants were *the same three intents* (local / url / named-cube) the current system
serves — but the current system serves them through **one abstraction with pluggable kinds** instead of three
disconnected code paths. **The user's three variants are all present; they are simply no longer three
architectures.** This is the textbook "promote three special-cases to one OCP seam" refactor — the better
design by SOLID/GRASP, and the one the field validates.

### 5b. Where we LEAD the field
- **Generic dimensions (Law 1)** make cross-store blending *architecturally free* — `by: 'time'`, zero per-cube join code (Tableau/Grafana bolt it on awkwardly).
- **Config-as-SSOT + lossless round-trip** — `DatasourceInstanceConfig` is pure JSON; stricter than Grafana/Superset (whose configs leak imperative bits).
- **`extractRequirements` static analysis** — prefetch/warm with zero N+1; no surveyed tool extracts requirements without executing the spec.
- **Structural/presentational dim split** (`Classifier` vs `DisplayMap`) — SDMX/Kimball-correct; and **no-functions-in-config** — a lead over Retool/Appsmith `{{ js }}`.

### 5c. Where we still LAG / the open refinements (all already named doors)
- **Semantic layer wired but under-exercised** (`R1`): `MetricDef.dataSource`/`specDataSource` exist, but
  bindings still mostly use raw codes. Highest-ROI work = *adopting* metric refs across the seeded cubes. An
  adoption gap, not an architecture gap.
- **Symmetric query planner deferred** (`D3-PLANNER`): 3+ stores, pushdown, server-side join, blend-aware
  prefetch. Correctly YAGNI — Metabase/Tableau/Grafana all *constrain* cross-store query.
- **Doors named, unbuilt, consumer-gated:** static-by-reference (`params.assetId`, Observable `FileAttachment`);
  Extract (freeze a storeId query to a snapshot); richer encoding channels (Vega-Lite `type`/`aggregate`, `R2`).

---

## 6. Recommendation

### 6a. KEEP the current architecture — it is the right one, and it is more complete than the old one.
The current model — **one `DataStore` port, N pluggable kinds (`static`/`href`/`stats`), CSS-cascade
`storeKey` routing, declarative `DataSpec` query/pipe, a semantic layer that lets a metric name its store,
and a declarative cross-store `blend`** — is the canonical hybrid the entire field converges on (Vega-Lite
trichotomy × Grafana/Retool resource registry × Cube/Looker semantic layer × Tableau blend). It dominates
the old three-variant system on add-a-source cost, SSOT, round-trip, routing, the logical tier, and
cross-source — while preserving the storeId query/pipe the user valued. **There is no "lost variant" to
recover; all three are present, unified.**

### 6b. The vital-few refinements (finish what's wired, build nothing speculative)
1. **Adopt the semantic layer in anger (highest ROI, no new architecture).** Migrate the seeded cubes'
   bindings to reference *metrics* (which carry `dataSource`, unit, methodology) instead of raw codes. The
   seam (`resolveMeasureRef`/`specDataSource`/`MetricDef.dataSource`) is built; this is *usage*, behind
   `FF-METRIC-FLOWS` / `FF-METRIC-NAMES-STORE`. This makes the middle tier — where the field locates
   multi-store power — load-bearing.
2. **Exercise multi-store routing with real content.** Author one national-accounts page that binds two
   `storeKey`s (gdp + regional), and one chart that `blend`s them on `time`. The routing + blend code is
   done; this proves it end-to-end (`FF-MULTISTORE-ROUTES`, `FF-BLEND-ROUTES-SECOND-STORE`).
3. **Keep the fitness nets green as guardrails** (they already exist): `FF-STATIC-KIND`,
   `FF-SOURCE-KIND-CLOSED` (OCP — adding a kind = one registration, zero resolver edits),
   `FF-NO-FETCH-IN-CONFIG` (Law 2 — no function/fetch/loader ever enters a descriptor),
   `FF-CONFIG-ROUNDTRIP`, `FF-BLEND-*`.

### 6c. What to explicitly NOT do (YAGNI / guardian-of-canon)
- **Do NOT add a node-level `data: { values | url | name }` union.** It would create a *second* "which source"
  mechanism beside `storeKey` — exactly the fragmentation (F-A/F-B) the binding-spine ADR refuses. The
  discriminant belongs at the store tier (Grafana/Retool/Superset all agree). The bounded exception —
  node-local `transform.source` literal rows (Adaptive-Cards `$data`) — stays, carrying *literals only*.
- **Do NOT build the symmetric N-store query planner / server-side join / cross-store pushdown** before a
  real consumer (`D3-PLANNER`). The bounded `blend` lookup + chaining serves the real cases; the planner is
  the one-way-door, wrong-if-built-blind part.
- **Do NOT restore the old imperative `STORE_MANIFEST` static-import wiring** (datasources are DB rows now — strictly better) **or expand `href` auth into a full framework** (the minimal none/bearer/header registry + SSRF allowlist is correct; widen only on a real scheme need).

### 6d. Guardian-of-canon check
Every element of the current architecture and these recommendations holds the project laws: **Law 1**
(dims generic — `blend by` is a generic key; no kind hardcodes a dimension); **Law 2** (descriptors are pure
JSON; `FF-NO-FETCH-IN-CONFIG`); **Law 3** (the arrow — href/blend I/O lives in `plugins`/`react`, core stays
pure and single-store); **Law 4** (the Vega-Lite trichotomy + SDMX structure/data split adopted *whole*);
**Law 5** (swap a source = a DB row); **Law 6/7** (the unification was a root-cause refactor, not a patch —
the three variants migrated onto the one port, the architecture was not bent to keep three code paths);
**Law 8 + YAGNI** (build the kind when its consumer is real — `static`/`href` shipped because consumers exist;
the planner is deferred because its consumer is speculative).

---

## 7. Bottom line for the user

You did not lose the three variants. You **upgraded** them: LOCAL → the `static` kind, HREF → the `href`
kind, storeId → the `stats` kind + `DataSpec` query/pipe — all now **one `DataStore` interface behind one
registry**, exactly how Vega-Lite, Grafana, Retool, Superset, and Cube model it. On top you gained two things
the old system never had: a **semantic layer** (a metric names its store — Cube/Looker) and **declarative
cross-store blending** (Tableau/Grafana-Mixed). The current architecture is **the better and more complete
one.** Keep it. The only work left is *using* the semantic layer you already wired and *exercising* the
multi-store routing you already built — not changing the architecture.

---

### Appendix — file evidence (verified 2026-06-26)
- Three registered kinds: `packages/plugins/datasources/{static,href,stats}-registrations.ts` · descriptor: `core/data/datasource.ts` · port: `core/data/store.ts` · selector trichotomy: `core/data/source.ts`
- Routing: `react/engine/resolveNodeRows.ts` (`resolveStore`/`resolveStoreByKey`/`resolveBlends`) · semantic layer: `core/data/metric.ts` (`resolveMeasureRef`, `MetricDef.dataSource`) + `core/data/metric-store.ts` (`specDataSource`) · blend: `core/data/transform/types.ts:304`, engine `transform/ops/joinByField.ts`
- Old 3-variant history: `git show 7a47e5d^:platform/apps/geostat/src/data/{gdp,accounts,regional}/{raw,adapter,store}.ts` + `store-manifest.ts` · lineage: `docs/architecture/subsystems/25-datasource-system.md`
- Architect ADRs (deep detail): `.claude/agent-memory/architect/adr_{data_source_reference_spectrum,data_reference_render_vision,multistore_storeid_reintroduction,data_blending_decision}.md`
