# SPEC — Authoring Reconception M0: The Governed Metric/Dimension Catalog + Metric Palette

> **Status:** DESIGNED (build-ready) · **Author:** platform-architect (Opus) · **Date:** 2026-07-09
> **Milestone of:** AR-49 (`SPEC-authoring-reconception-vision.md`, owner-APPROVED). This is the **detailed technical design for M0 only.**
> **Registry:** AR-49 card (`ARCHITECTURE-REGISTRY.md` §B) — pointer appended.
> **Consumes / completes:** AR-40 (semantic-layer spine — DONE + LIVE in code), AR-10 (`describeApp()` capability discovery).
> **Grounded against (read, in code):** `packages/core/src/data/metric.ts` · `packages/core/src/config/{prop-schema,data-spec,kpi-spec}.ts` · `packages/contracts/src/manifest.ts` · `packages/react/src/engine/constructor.ts` (`describeApp().metrics`) · `apps/panel/src/inspector/{EnumRefField,FieldControlRegistry,schemaSource}` · `apps/panel/src/discovery/{cubeEnumOptions,useActiveProfile,cubeProfile.store}` · `apps/panel/src/features/data-layer/fieldwells/*`.
>
> **Scope discipline:** M0 is **purely additive over the existing `DataStore`/`fromSDMX`/`resolveMeasureRef` boundary and breaks nothing.** The wizard, the query/pivot/transform editors, and every runner render-path are UNTOUCHED. The full Model/Compose surface separation is M1+ (this spec designs only the browsable catalog, the governed picker, and the bind affordance).

---

## 0. What M0 is, in one paragraph

The AR-40 semantic-layer *spine* already exists and is live: `MetricDef` registry, `resolveMeasureRef` as the single measure-resolution seam, manifest→boot delivery (`registerMetrics`), and `describeApp().metrics` already ships the whole catalog to the Constructor. M0 does **three additive things on top of that spine**: (1) **completes the catalog** — adds the peer `DimensionDef` governed-dimension layer (Law 1: dimensions are equal citizens of the semantic layer, not a metric afterthought) and surfaces both metrics and dimensions as a **browsable catalog**; (2) **adds one governed picker vocabulary** — `metric-ref`/`dimension-ref`, implemented as new **`enum-ref` discovery sources** (`'metrics'`, `'dimensions'`), so the *existing generic Inspector* renders a "bind to metric" control with **zero new field-type machinery**; (3) **adds the Metric Palette** — a browsable governed surface in the panel with a drag/click **bind affordance** that writes a metric-id into a block's existing `measure` field. The load-bearing guarantee: **binding a block to a metric writes config that is byte-identical to what a steward would hand-author, and lowers through the *unchanged* `resolveMeasureRef` → `DataStore` pipeline** — so renderer, ViewSnapshot, and export/provenance are untouched.

---

## 1. The governed Metric & Dimension model (SDMX/OLAP-native, our terms)

### 1.1 Metric — already formalized (AR-40); M0 confirms, does not re-open

`MetricDef` (`packages/core/src/data/metric.ts`) is the governed measure — Cube's *measure-with-`dataSource`* × LookML's *define-once* × Malloy/dbt's *measure-algebra*, in our SDMX-native form. It already carries everything M0 needs; **M0 adds no field to it.** For the record, the governed noun is:

| Facet | Field (exists) | Semantic-layer role |
|---|---|---|
| Underlying SDMX code(s) | `code?: string \| string[]` | base metric ← `fromSDMX` (Law 5) |
| Measure-algebra | `calc?: MetricCalc` (expr over other metrics, via `@statdash/expr`) | derived metric (GDP per capita = GDP ÷ population), authored once |
| Bilingual label | `label: LocaleString` | governed display noun |
| Unit | `unit?: LocaleString` | governs the unit shown everywhere |
| Default format | `format?: FormatKey` | governs numeric formatting once |
| Aggregation | `agg?: 'sum'\|'avg'\|'last'` | cross-time reducer |
| Provenance | `methodology?: string` → `ProvenanceRecord.methodology` | integrity as a native property (Law 9) |
| Drill hierarchy | `parent?: string` | OLAP parent |
| Store routing | `dataSource?: string` | Cube `dataSource`-on-measure |
| Default coordinate | `dims?: Partial<Record<string, FilterValue>>` | *default perspective/dimension pins* — Law 1 generic `Record`, never `year`/`geo` special-cased |

**Refusals held (the "LookML line", per AR-40):** no `filters`/`joins`/`sql` on `MetricDef`. It stays a thin declarative vocabulary leaf. Fitness `FF-METRIC-THIN` already guards this. This is exactly why we **grow AR-40 and refuse Cube/Malloy as a runtime** (they assume a SQL warehouse → break Law 5 `fromSDMX`-only + Law 2).

### 1.2 Dimension — the peer M0 adds (`DimensionDef`)

Today "dimensions" reach the author only as **raw cube-profile members** (`enum-ref source:'cube.dimensions'|'cube.members'` — ungoverned SDMX codes, thin labels; `dimensionOptions()` literally shows `code (conceptRole)`). To make the *governed noun* symmetric with the metric (the vision's "compose by picking governed nouns: metric × dimension × perspective"), M0 adds a thin governed dimension over the same cube-profile spine.

**New vocabulary leaf `packages/core/src/data/dimension.ts`** (sibling of `metric.ts`; same purity invariant — imports only `LocaleString`/sdmx types, nothing from `registry/`):

```ts
export interface DimensionDef {
  /** The SDMX/cube dimension code this governs (Law 5 — members come FROM the DSD). */
  code:          string
  /** Governed bilingual label (the cube profile carries only a thin code label). */
  label:         LocaleString
  /** Concept role hint: 'geo' | 'time' | 'sector' | … — an OPEN string, NOT a
   *  privileged union (Law 1). Purely advisory metadata for the palette/ShowMe;
   *  the engine never branches on a hardcoded dimension name. */
  conceptRole?:  string
  /** Default member pin when the author drops the dim without choosing (e.g. '_T'). */
  defaultMember?: DimVal
  /** Curation whitelist: expose only these members to the author. ABSENT ⇒ all
   *  members from the cube profile (Law 5 — we never DUPLICATE the SDMX member
   *  list in config; we reference/curate it). */
  members?:      DimVal[]
  /** Longer description for the info-affordance. */
  description?:  LocaleString
}
```

- **Members are NEVER copied into config** — the resolved member list is read from the cube profile (the `fromSDMX` boundary, Law 5). `DimensionDef` only *curates* (label, default, optional whitelist). Fitness `FF-DIMENSION-MEMBERS-FROM-SDMX` guards that `members?` is a subset-reference, never the SSOT.
- **Law 1 enforced structurally:** `conceptRole` is an open `string`, the engine has no `if (dim === 'time')`. Fitness `FF-NO-PRIVILEGED-DIM` scans `dimension.ts` + resolvers for a hardcoded dimension literal.
- Registry mirrors metrics exactly: `registerDimension(s)` / `getDimension` / `listDimensionDefs()`.

### 1.3 Package placement (the arrow, Law 3) — justified

```
contracts   : ManifestMetric (exists) + ManifestDimension (NEW wire mirror), SiteManifestContract.metrics[]/dimensions[]
  → expr    : MetricCalc reuses @statdash/expr (no new eval)
  → core    : metric.ts (exists) + dimension.ts (NEW) — pure vocabulary + registries + resolveMeasureRef (SSOT)
  → charts / react : describeApp() composes listMetricDefs()+listDimensionDefs() (react)
  → plugins : block schemas gain enum-ref source:'metrics'/'dimensions' fields
  → apps    : geostat registers the manifest catalog at boot (exists for metrics; +dimensions); panel browses it; api/provisioning authors it
```

**Why core, not contracts, owns the definition:** `MetricDef`/`DimensionDef` reference core's `LocaleString`, `FilterValue`, and (metrics) `@statdash/expr` — none of which contracts (the zero-`@statdash`-dep innermost layer) may import. Contracts carries only the *wire mirror* (`ManifestMetric`/`ManifestDimension` — plain JSON, refined to the core type at the boot seam, exactly as `format` already does). This is byte-for-byte the split AR-40 already uses; **no arrow change.**

### 1.4 Catalog structure + discovery

The catalog is **not a new store type** — it is the union of the two registries, already discoverable:

- **Engine side (exists + extend):** `describeApp()` already returns `metrics: Record<id, MetricDef>` (AR-10/N26). M0 adds `dimensions: Record<id, DimensionDef>` alongside it. This is the *capability-discovery* SSOT (Law 8) — the Constructor browses what's registered; nothing is a one-off.
- **Panel side (new, mirrors `cubeProfile.store`):** a `metricCatalog.store` + `useMetricCatalog()` hook in `apps/panel/src/discovery/`, populated from the **site manifest being edited** (`manifest.metrics[]`/`dimensions[]` refined via the same `registerManifestMetrics` path the runner boots). Pure resolvers `metricOptions(catalog, locale)` / `dimensionOptions(catalog, locale)` mirror `cubeEnumOptions.ts` (profile→options), so they are trivially testable and OFF the network.

---

## 2. The `metric-ref` / `dimension-ref` PropSchema field

### 2.1 The decision: a governed **`enum-ref` discovery source**, NOT a new `PropFieldType`

The vision calls it a "`metric-ref` field type." The **correct, minimal realization is a new `PropFieldSource`, reusing the existing `enum-ref` type** — because that is *exactly* what the `enum-ref` seam was built for. `prop-schema.ts` documents it verbatim: *"Open discriminant — a new discovery source is a new token here + a new panel resolver, with no Inspector/engine interface change (OCP)."* Governed metric/dimension picking is the same shape as the already-shipped `cube.measures`/`cube.dimensions`/`cube.members` picking — it differs only in *which catalog* backs it (the governed semantic layer vs the raw cube profile).

**Additive change to `packages/core/src/config/prop-schema.ts` — two tokens on the open `PropFieldSource` union:**

```ts
export type PropFieldSource =
  | 'cube.measures' | 'cube.dimensions' | 'cube.members'   // raw SDMX (exists)
  | 'dataSpecs' | 'tokens' | 'pages' | 'filterParams' | 'perspectives'
  | 'metrics'        // ★ NEW — governed MetricDef ids from the semantic layer
  | 'dimensions'     // ★ NEW — governed DimensionDef ids from the semantic layer
  | (string & {})
```

Then the two governed field descriptors are **just enum-refs** (no new type, no new control needed):

```ts
// metric-ref
{ field: 'value.measure', type: 'enum-ref', source: 'metrics',
  label: { ka: 'მეტრიკა', en: 'Metric' }, required: true }

// dimension-ref
{ field: 'sliceBy', type: 'enum-ref', source: 'dimensions',
  label: { ka: 'განზომილება', en: 'Dimension' } }
```

**Trade-off named (ISO 25010: modularity/extensibility vs. one-off richness).** A new `PropFieldType 'metric-ref'` would (a) bump `CONTRACT_VERSION` (a new axis on the contract surface — `constructor.fitness.test.ts` would force it), (b) require a new `FieldControlRegistry.register('metric-ref', …)` control, and (c) fork the resolution path that `enum-ref` already owns. The enum-ref-source route costs **zero** of that: `EnumRefField` and the Inspector are untouched; the `describeApp` contract gains only *values* (a new source token + the `dimensions` map = a MINOR back-compat bump, not a surface change). We buy the same author experience for a fraction of the surface. **Rejected alternative captured in §9.**

### 2.2 How the generic Inspector resolves the options (mirrors the `enum-ref` pattern exactly)

`EnumRefField` already has two source families: `STORE_SOURCES` (session) and the cube-profile family (via `useActiveProfile`). M0 adds a **third family: the semantic catalog**, resolved via `useMetricCatalog()` — structurally identical to the cube-profile branch:

```ts
// apps/panel/src/inspector/controls/EnumRefField.tsx  (additive branch)
const catalog = useMetricCatalog()                    // mirrors useActiveProfile()
if (isSemanticSource(sourceKey)) {                    // 'metrics' | 'dimensions'
  if (catalog.status !== 'ready') return { options: [], hint: 'catalog loading…' }
  const opts = sourceKey === 'metrics'
    ? metricOptions(catalog.metrics, locale)          // pure: catalog → {value:id, label:metricLabel+unit hint}
    : dimensionOptions(catalog.dimensions, locale)
  return { options: opts, hint: `no ${sourceKey} available` }
}
```

`metricOptions` (in `discovery/semanticCatalogOptions.ts`, sibling of `cubeEnumOptions.ts`) is pure `catalog → CubeOption[]`, label = resolved metric `label` + a `unit` hint (e.g. `"GDP · მლნ ₾"`) — the same shape `measureOptions` returns, so the existing `<select>` renders it unchanged. The author **picks a governed noun, never types a code** (Law 2). Governance (`FF-METRIC-REF-GOVERNED`): a `metric-ref` field can only emit a registered metric-id.

### 2.3 Worked example on an existing block (kpi-strip)

Today a KPI item's `value.measure` is a free string (a raw SDMX code or, post-AR-40, a metric-id). `KpiStripNode`'s schema declares only `{ field:'items', type:'array' }` (the item shape is a raw JSON sub-editor today). M0 makes the **per-item measure a governed picker** by declaring the nested descriptor the Inspector already resolves by dot-path:

```ts
// KpiStripNode.ts — add nested governed pickers (array-item PropSchema)
export const KpiStripSchema: PropSchema = [
  { field: 'items', type: 'array', label: { ka:'KPI მეტრიკები', en:'KPI metrics' }, required: true,
    itemSchema: [
      { field: 'value.measure', type: 'enum-ref', source: 'metrics',
        label: { ka:'მეტრიკა', en:'Metric' }, required: true },   // ← metric-ref
      { field: 'value.filter.geo', type: 'enum-ref', source: 'dimensions',
        label: { ka:'რეგიონი', en:'Region' } },                    // ← dimension-ref (slice)
    ] },
]
```

Binding "GDP · real growth" writes `items[i].value = { type:'point', measure:'gdp.realGrowth', … }`. That is **identical to hand-authoring the metric-id** — and `interpretKpi` → (AR-40 U1) `resolveMeasureRef` lowers it to the underlying code + governance. (Same story for a `chart`/`query` block: the metric-ref writes `query.encoding`'s measure / `query.query` measure, lowered by `resolveQueryMeasures → resolveMeasureRef`.) *(`itemSchema` for array-item field descriptors is a small additive Inspector affordance; if the array item-editor does not yet honor a nested schema, M0 P-panel adds it — flag `ITEM-SCHEMA`; otherwise the metric-ref lands via the Metric Palette bind in §4 with the raw JSON item-editor as the interim.)*

---

## 3. Bind → DataSpec lowering — the load-bearing compatibility point

**There is no new runtime lowering.** This is the whole safety of M0. "Bind block to metric" is an *authoring* operation that writes a **metric-id into the block's existing measure field**; the metric-id → underlying-code lowering already exists and is live (AR-40 `resolveMeasureRef`, used by `query` DataSpecs, calc-metrics, and every KPI reducer post-U1).

```
AUTHOR (panel)                         CONFIG (SSOT)                 RUNTIME (unchanged)
bind "gdp.realGrowth" to KPI block  →  value.measure="gdp.realGrowth"
                                                    │
                                    interpretKpi / interpretSpec
                                                    │
                                     resolveMeasureRef("gdp.realGrowth")   ← the ONE seam (exists)
                                                    │
                                    { codes:['B1GQ_GR'], unit, format,      ← governance filled as DEFAULTS
                                      methodology, dims, dataSource }         (explicit consumer value wins, Postel)
                                                    │
                                       DataStore.observe / storeVal          ← fromSDMX pipeline (unchanged, Law 5)
                                                    │
                                     DataRow[] → renderer → ViewSnapshot → export/provenance   ← ALL unchanged
```

**The compatibility guarantee (precise):** for any metric `M` with underlying code(s) `C`, a block **bound to `M`** produces a config whose `interpretSpec`/`interpretKpi` output is **deep-equal** to the same block **hand-authored with `C`** plus `M`'s governance (unit/format/methodology/dims applied as defaults). A raw code that is not a registered metric-id passes through byte-identically (Postel; `FF-RAW-CODE-IDENTICAL`, already green). Therefore:
- **Renderer** — sees a DataSpec/KpiSpec it already handles; no code path added.
- **ViewSnapshot / export / provenance** — resolve from the same `DataRow[]` + `ResolvedMeasure`; metric governance actually *improves* provenance (methodology now flows via `withMetricProvenance`) but changes no shape.
- **Reversibility** — un-binding rewrites the field to a raw code; nothing downstream knows the difference.

This is why M0 "breaks nothing": it adds an *authoring surface* over an *already-load-bearing resolution seam*.

---

## 4. The Metric Palette (panel) — browsable governed catalog + bind affordance

### 4.1 What it is and where it lives

A new **`MetricPalette`** surface in `apps/panel/src/discovery/` (rendered beside `NodePalette` in the canvas rail). It is the author's *primary data affordance* — the browsable view of the governed catalog the define-vs-curate split promises. It is **additive to the current wizard** for M0 (the wizard's `DataStep` and the query editors stay exactly as-is, as the steward/advanced path).

### 4.2 Reuses existing panel infra (no new mechanism)

| Need | Reused infra |
|---|---|
| Catalog data | `useMetricCatalog()` (new, mirrors `useActiveProfile`) → `describeApp().metrics/.dimensions` shape |
| Browsing / search | `command/` cmdk (already the command palette) — group metrics by `dataSource`/`category`, search by label |
| Option rendering | `metricOptions`/`dimensionOptions` pure resolvers (mirror `cubeEnumOptions`) |
| Drag-to-bind | `features/data-layer/fieldwells/{dragData,binding}.ts` — the exact drag-a-field-onto-a-well pattern, generalized to drag-a-metric-onto-a-block (@dnd-kit) |
| Encoding suggestion | `features/data-layer/showme/ShowMe.tsx` — on bind to a chart, suggest the encoding (Power-BI "Show Me"), now sourced from the governed metric not raw cube dims |
| Config write | the constructor store's node-patch path (same as Inspector writes, composes with undo/redo) |

### 4.3 The bind affordance (two gestures, one write)

1. **Drag** a metric tile onto a block on the canvas → `binding.ts` writes the metric-id into the block's measure field (chart → `query` encoding measure; kpi → the item `value.measure`; featured-slider → an `items[]` entry). `ShowMe` picks a sane default encoding.
2. **Select block + click metric** (a11y/keyboard path) → same write.

Both gestures converge on **one** store mutation that sets a measure field to a metric-id — the same config a hand-author would produce (§3). No block gains a special "bound" state; the metric-id in the measure field *is* the binding.

---

## 5. Minimal metric authoring for M0 (populate the catalog)

M0 **defers the steward "Model mode" UI** (that is M2). The catalog is populated by **config authoring**, riding the paths that already exist:

- **Metrics** — authored in `geostat.provisioning.json` `metrics[]` (AR-40 P1 already populated 11). M0 extends coverage to the measures authors actually want to bind on the GDP/accounts/regional pages. Validated by the existing `config-cube-contract` fitness (metric.code ∈ dataset CL_MEASURE) and `config-no-locale-leak`.
- **Dimensions** — seeded **from the cube profile** (Law 5): a one-shot generator reads the DSD/codelist the panel already fetches (`cubeApi` profile) and emits governed `dimensions[]` entries (code + bilingual label from the codelist + `conceptRole` from the profile's `conceptRole`). Members are **not** copied — `DimensionDef.members?` stays absent (⇒ all-from-profile) unless a curation whitelist is wanted. Authored bilingual (no locale leak).
- **M0-needs vs later:** M0 needs = `dimensions[]` in the manifest + the catalog store + the palette + the enum-ref sources. **Later (M2):** a Model-mode UI to CRUD metrics/dimensions visually (relocating the query/pivot editors behind the steward role). M0 does **not** build any authoring UI for the semantic layer — it makes the config-authored layer *browsable and bindable*.

---

## 6. Strangler-Fig fit

| Component | Disposition in M0 |
|---|---|
| `DataStore`, `fromSDMX`, `resolveMeasureRef`, all resolvers, renderer, ViewSnapshot, export/provenance | **UNTOUCHED** — M0 rides these seams; §3 is the proof |
| 3-step wizard (`features/wizard/*`) | **UNTOUCHED** — dissolved in M1, not M0 |
| Query/pivot/transform editors (`features/data-layer/editors/*`) | **UNTOUCHED** — stay as the advanced/steward path; the Metric Palette sits *beside* them, not replacing |
| `AR-40` metric spine, `describeApp().metrics` | **EXTENDED additively** (+ `dimensions`) |
| Metric Palette + `enum-ref source:'metrics'/'dimensions'` + `metricCatalog.store` | **NEW (additive)** |
| **react-admin CRUD `<Resource>` screens** | **DESIGN NOTE only** — the dead fork the vision retires; M0 deliberately authors metrics via *config*, NOT via react-admin, so M0 grows no new react-admin usage (avoids first-tenant-erosion). **Actual retirement is M1** — sequencing to the lead. |

Every M0 cut is reversible and independently valuable: authors can pick a metric instead of building a query *before* any wizard is touched.

---

## 7. Test / fitness strategy

| Fitness fn | Asserts | Where |
|---|---|---|
| **FF-BIND-PARITY** (★ the Δ-parity seam) | for metric `M`(code `C`): a block *bound to `M`* → `interpretSpec`/`interpretKpi` output **deep-equals** the block *hand-authored with `C` + M's governance*. Proves bind-via-metric ≡ hand-authored DataSpec. | `core/data` (drives `resolveMeasureRef` + interpret over a fixture store) |
| **FF-RAW-CODE-IDENTICAL** (reuse, green) | a raw-code block is byte-identical post-M0 | `core/data/kpi-raw-code-identical.fitness` |
| **FF-METRIC-CATALOG-SERIALIZABLE** | `describeApp().metrics`/`.dimensions` JSON round-trip (deep-equal) | `react/engine/constructor.fitness` |
| **FF-METRIC-REF-GOVERNED** | a `metric-ref`/`dimension-ref` field emits only registered ids (never free-text) — Law 2 | panel inspector (rendered-DOM) |
| **FF-CATALOG-DISCOVERY-PURE** | `metricOptions`/`dimensionOptions` are pure catalog→options (off network/store) | panel discovery (mirrors `cubeEnumOptions.test`) |
| **FF-NO-PRIVILEGED-DIM** | `dimension.ts` + resolvers carry no hardcoded dimension literal — Law 1 | `core/data/dimension.fitness` |
| **FF-DIMENSION-MEMBERS-FROM-SDMX** | `DimensionDef` never SSOTs a member list; resolves from the cube profile — Law 5 | `core/data/dimension.fitness` |
| **FF-METRIC-THIN** (reuse) | no filters/joins/sql added to `MetricDef`/`DimensionDef` | `core/data/metric.fitness` |
| **config-cube-contract / config-no-locale-leak** (reuse) | every metric.code ∈ dataset; no monolingual catalog label | provisioning scan |

Pyramid: unit (parity + pure resolvers) > component (inspector governed-select, palette bind) > integration (catalog from a real manifest, docker api). Warm===render already structurally guarded by AR-40.

---

## 8. Build decomposition (ordered; owner tier; deps; parallelism)

| # | Work item | Owner tier | Depends on | Parallel? |
|---|---|---|---|---|
| **1** | Contracts: `ManifestDimension` wire type + `SiteManifestContract.dimensions?[]` (mirror `ManifestMetric`) | database-architect / engine-specialist | — | ∥ start |
| **2** | Core: `dimension.ts` — `DimensionDef` + registry (`registerDimension(s)`/`getDimension`/`listDimensionDefs`) + purity invariant | engine-specialist | 1 | after 1 |
| **3** | Core config: add `'metrics'`/`'dimensions'` to `PropFieldSource` (+ docs) | engine-specialist | — | ∥ with 2 |
| **4** | Boot: `registerManifestDimensions` in the runner boot seam (mirror `registerManifestMetrics`) | engine-specialist | 2 | after 2 |
| **5** | Engine: `describeApp()` += `dimensions: listDimensionDefs()` (+ `contractVersion` MINOR bump) | engine-specialist | 2 | after 2 |
| **6** | Data/authoring: seed `dimensions[]` (generator from cube profile) + extend `metrics[]` coverage in `geostat.provisioning.json` | database-architect | 1,2 | ∥ with 7–9 |
| **7** | Panel discovery: `metricCatalog.store` + `useMetricCatalog()` + pure `metricOptions`/`dimensionOptions` (mirror `cubeProfile.store`/`cubeEnumOptions`) | react-specialist | 5 (shape) — can mock | ∥ (mock shape) |
| **8** | Panel inspector: semantic-source branch in `EnumRefField` (`isSemanticSource`) | react-specialist | 3,7 | after 7 |
| **9** | Panel: `MetricPalette` surface + bind affordance (dnd via `fieldwells/binding`+`dragData`, ShowMe on bind, store write) | senior-frontend / plugins-specialist | 7 (,8) | after 7 |
| **10** | Plugins: add `metric-ref`/`dimension-ref` governed pickers to block schemas (kpi item `value.measure`, chart query measure) + `itemSchema` array-item resolution if needed | plugins-specialist | 3,8 | after 8 |
| **11** | Fitness: `FF-BIND-PARITY` (core) + `FF-METRIC-CATALOG-SERIALIZABLE` (react) + `FF-METRIC-REF-GOVERNED`/`FF-CATALOG-DISCOVERY-PURE` (panel) + `FF-NO-PRIVILEGED-DIM`/`FF-DIMENSION-MEMBERS-FROM-SDMX` (core) | engine-specialist (parity/core) + react-specialist (panel) | alongside each | ∥ per item |

**Critical path:** 1 → 2 → 5 → 7 → 8 → 9/10. **Parallel lanes:** 3 (config token) ∥ 2; 6 (data) ∥ 7–9 (panel, mockable); 11 (fitness) ∥ each. The engine/core+contracts lane (1–5) and the panel lane (7–9) only meet at the `describeApp` shape (5), which 7 can mock — so the two lanes run largely concurrently.

---

## 9. Rejected alternatives (ADR discipline)

- **(a) A new `PropFieldType 'metric-ref'` + dedicated control.** Rejected as the mechanism: bumps `CONTRACT_VERSION` (new surface axis), needs a new `FieldControlRegistry` control, and forks the resolution the `enum-ref` seam already owns — for no author-visible gain over `enum-ref source:'metrics'`. The enum-ref-source route is the documented OCP extension (`prop-schema.ts` header). *Kept in reserve:* if a genuinely richer inline control (provenance-preview, faceted search **inside** the Inspector field) is later needed, promote to a type then — YAGNI today; the Metric Palette (§4) already carries the rich *browsing*.
- **(b) Copy SDMX members into `DimensionDef`.** Rejected: violates Law 5 (`fromSDMX` sole boundary) and duplicates the DSD SSOT → drift. `DimensionDef` curates (label/default/whitelist); members resolve from the cube profile.
- **(c) Adopt Cube/Malloy as the metric runtime.** Rejected (vision §5, held): SQL-assuming → breaks Law 5 + reintroduces a query language into config (Law 2). We grow AR-40.
- **(d) Build Model-mode metric CRUD UI in M0.** Rejected as scope: modeling is a M2 role surface; M0 makes the *config-authored* catalog browsable/bindable (fastest first value, additive, reversible).
- **(e) Evolve the wizard's `DataStep` into the palette.** Rejected: couples M0 to the wizard's retirement (M1). The Metric Palette sits *beside* the untouched wizard so M0 breaks nothing.

---

## 10. Definition of done (M0 first demonstrable slice)

An author, on the canvas, opens the **Metric Palette**, browses the governed catalog (metrics grouped by dataset, bilingual labels + units, searchable), **drags "GDP · real growth" onto a chart block** — and the block renders the **live governed number** with no query authored, the encoding suggested by Show Me, the same metric-id reused by the page's KPI so every surface shows one governed number, provenance/methodology flowing from the metric — **and `FF-BIND-PARITY` proves the bound config is byte-identical to the hand-authored equivalent**, with the wizard and every runner render-path untouched.
</content>
</invoke>
