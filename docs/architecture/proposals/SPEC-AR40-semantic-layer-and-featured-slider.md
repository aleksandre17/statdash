# SPEC — AR-40 Semantic / Metrics Layer + the Landing Featured-Slider (first consumer)

> Status: **DESIGNED** (build-ready). Author: lead/architect. Date: 2026-07-04.
> Registry: `work/ARCHITECTURE-REGISTRY.md` → **AR-40** (status → DESIGNED after this doc).
> Related registry items (elevation, NOT built here): AR-31 (permalink lattice), AR-42 (grammar of interaction / Constructor), AR-43 (lineage/provenance), AR-10/AR-11 (Constructor schema SSOT).
> Standard: **MAXIMAL architecture, YAGNI-balanced population** — a real spine, not a toy; no gold-plating beyond the featured-slider need.

---

## 0. Executive concept

A **metric is defined ONCE** — its measure(s), aggregation, default dims, unit, format, methodology — in a **governed semantic layer**, and **every surface (KPI, chart, table, and the featured slider, later the Constructor) resolves a metric reference to values through the ONE `resolveMeasureRef` seam and the existing DataStore pipeline.** No surface re-derives a number or re-declares its format. This structurally kills the *number-consistency bug-class* — the same indicator rendering different figures (or a hand-typed string that drifts) across panels.

The semantic layer **already exists in code** as the `MetricDef` registry (`packages/core/src/data/metric.ts`, delivered manifest→boot→`registerManifestMetrics`). AR-40 is NOT a greenfield build — it is the **formalization + completion** of that spine:

1. **Close the one remaining gap** so *every* measure reference resolves through the single seam: today `query` DataSpecs and calc-metrics are metric-aware, but **`interpretKpi`'s point-read path is NOT** (it passes `spec.measure` straight to `storeVal`). That asymmetry is the Strangler target (Law 7).
2. **Govern presentation once** — add `format` to the metric (the only schema addition), so a slider and the owning page's KPI format the same number identically.
3. **Prove the spine with a genuinely-useful first consumer** — the landing **featured-slider**, built entirely *through* the semantic layer + config pipeline from the yellow-cell → `FEATURED.json` authoring signal, replacing today's **hard-coded** `stats-carousel` (which renders hand-typed strings `"204 000"`, `"54 100"` — already stale: it shows Tbilisi `54 100` while the live figure is `49 374`).

**Reference platforms adopted (Law 4, named):**
- **Cube.dev** — `measure` with a `dataSource` (a measure names its store); pre-aggregations/consistency guarantee. → already adopted as `MetricDef.dataSource`; we complete the "one number" guarantee.
- **LookML** — a `measure` is *defined in a view* (definition), and an `explore`/dashboard *curates which to show* (curation). → the metric def stays a pure definition; **"featured" is a curation** (a coordinate + order), kept a **separate collection**, not a flag on the definition (SSOT + SoC).
- **Malloy / dbt-MetricFlow** — a metric declares its aggregation + is referenced by name everywhere; derived metrics are algebra over base metrics. → already adopted as `MetricDef.agg` + `MetricCalc` (calc metrics).
- **What we deliberately REFUSE** (the "LookML line"): no `filters`/`joins`/`sql` on `MetricDef`. It stays a thin vocabulary leaf. Joins are the existing declarative `blend` seam; filters are the query/coordinate.

---

## 1. Current state (verified in code)

| Concern | Today | AR-40 |
|--------|-------|-------|
| Metric registry | `MetricDef` (base + calc), `registerMetric(s)`, `getMetric`, `resolveMeasureRef` — `metric.ts` | reuse as-is; +`format` field |
| Delivery | manifest `metrics[]` → `registerManifestMetrics` at boot (`site-manifest.ts`), authored in `geostat.provisioning.json` | reuse as-is; +`format` on wire `ManifestMetric` |
| `query` DataSpec measure | metric-aware (`resolveQueryMeasures` → `resolveMeasureRef`) ✓ | unchanged |
| calc-metric (`type:'metric'` KPI) | metric-aware (`resolveMetricValue`) ✓ | unchanged |
| **KPI point-read** (`point/yoy/cagr/mean/share/expr`) | **NOT metric-aware** — `resolveValue → storeVal(store, spec.measure)` passes the raw string; **but warm (`extractKpiRequirements`) already resolves via `resolveMeasureRef`** → a render/warm asymmetry | **make render metric-aware (U1)** → symmetric, unifies interpretKpi with the semantic layer |
| Format governance | per-consumer (`KpiValueSpec.format`, `ColumnDef.format`) → drift risk | `format` declared once on the metric; explicit consumer format still wins (Postel) |
| `FEATURED.json` | committed governed collection (11 obs, yellow-cell authored) — **consumed nowhere** | the featured-slider's authored source (via provisioning) |
| Landing headline | **hard-coded** `stats-carousel` slides (`value:"204 000"` strings) | Strangler-replaced by data-bound `featured-slider` |

---

## 2. The semantic layer (AR-40 spine) — schema + seams

### 2.1 `MetricDef` — one additive field (the ONLY schema change to the metric)

`packages/core/src/data/metric.ts` — add `format`; everything else already exists.

```ts
export interface MetricDef {
  code?:        string | string[]      // base metric underlying SDMX code(s)
  calc?:        MetricCalc             // derived metric (measure-algebra) — exists
  label:        LocaleString           // exists
  unit?:        LocaleString           // exists — governs the unit shown everywhere
  format?:      FormatKey              // ★ NEW — governs numeric formatting ONCE
  agg?:         'sum' | 'avg' | 'last' // exists
  parent?:      string                 // exists (drill hierarchy)
  methodology?: string                 // exists → ProvenanceRecord.methodology
  description?: LocaleString            // exists
  dataSource?:  string                 // exists (Cube `dataSource`-on-measure)
  dims?:        Partial<Record<string, FilterValue>> // exists — default coordinate pins
}
```

`format` reuses the existing `FormatKey` union (`kpi-spec.ts`: `'mln_gel'|'sign_pct'|'pct'|'decimal1'|'decimal2'`). `MetricDef` stays thin — **no filters/joins/sql added** (the refused LookML line, per `project_semantic_layer_n26`).

Wire mirror: add `format?: string` to `ManifestMetric` (`packages/contracts/src/manifest.ts`) and pass it through `registerManifestMetrics` (`site-manifest.ts`), exactly as `unit` flows today. `format` is a plain string on the wire (contracts has no `FormatKey` import concern — it is refined to `FormatKey` at the runner boot seam like every other blob field).

`ResolvedMeasure` (in `metric.ts`) gains `format?: FormatKey`, filled first-metric-wins alongside `unit`/`methodology` (same precedence machinery already there).

### 2.2 U1 — make the KPI point-read metric-aware (the unification / Strangler target)

`packages/core/src/data/kpi.ts` — `resolveValue` + `resolveTrend` currently call `storeVal(store, spec.measure, …)`. Route the measure through the SSOT seam first:

```ts
// BEFORE:  const n = storeVal(store, spec.measure, atTime(t, c))
// AFTER:   const rm = resolveMeasureRef(spec.measure)              // SSOT seam
//          const cc = mergeMetricDims(c, rm.dims)                  // metric default dims (explicit filter wins)
//          const n  = storeValMulti(store, rm.codes, atTime(t, cc))// resolves 1..n underlying codes
```

- `resolveMeasureRef` already exists and is what **warm already uses** — so after U1, **render and warm resolve the IDENTICAL underlying codes** (kills the asymmetry the metric-delivery memory warns about: no cache-miss, no dead preliminary badge when a KPI references a metric-id).
- `mergeMetricDims` folds `rm.dims` as *defaults under* the KPI's own `filter` (explicit filter wins — the same precedence `query` specs use).
- Governance inheritance: when `spec.format` is absent, fall back to `rm.format`; when the KPI omits `unit`, `interpretKpi` fills from `rm.unit`. **Explicit consumer value always wins** (Postel / expand-contract). A raw code (not a registered metric-id) resolves to itself with no governance → **byte-identical** to today (guarded by FF-RAW-CODE-IDENTICAL, extended to the KPI path).
- Multi-code metrics on a *point* read: for `point/yoy/cagr/mean` the metric is expected single-underlying-code; `storeValMulti` sums when `codes.length>1` (documented; the featured metrics are all single-code). `share`/`expr` keep their existing multi-ref shapes.

**After U1 the platform has ONE measure-resolution path** (`resolveMeasureRef`) across `query` DataSpec, calc-metric, and every KPI reducer — the SSOT the whole AR-40 concept rests on.

### 2.3 The featured collection — a curated list of `MetricRef`s (NOT a flag on the metric)

`packages/core/src/data/featured.ts` (NEW — a core vocabulary leaf, sibling of `kpi-spec.ts`):

```ts
/** One curated headline item: a metric-id resolved at a pinned coordinate. */
export interface FeaturedItemSpec {
  /** Semantic-layer metric-id (SSOT). Its label/unit/format/methodology govern the card. */
  metric:  string
  /** Coordinate pins beyond time (Law 1, generic dims): { geo:'R2', account:'…', side:'U' }.
   *  Merged OVER the metric's default dims; reuses the KPI DimFilter vocabulary
   *  (literal | { $ctx } cross-filter ref), so a featured card can also follow selection. */
  at?:     DimFilter
  /** Time pin (literal year or {$ctx}). The "latest published year" for this headline. */
  time?:   TimeRef
  /** Optional prior-period context shown under the value. Reuses KpiTrendSpec (yoy/cagr/static). */
  trend?:  KpiTrendSpec
  /** Drill-through target — the owning page (permalink, Law 9). LocaleString for localized routes. */
  href:    LocaleString | string
  /** Editorial grouping → one slide/tab (e.g. "National Accounts" / "GDP" / "Regional"). */
  group?:  LocaleString
  /** Optional decorative glyph (a11y hidden). */
  icon?:   string
  /** Display order within its group. */
  order?:  number
}

/** Resolved featured card — a KpiDef plus the slider-only affordances. */
export interface FeaturedSlideDef {
  card:  KpiDef            // ← produced by interpretKpi (value/trend/unit/preliminary/methodologyUrl)
  href:  string           // resolved to the active locale
  group: string           // resolved group label ('' → single ungrouped slide)
  icon?: string
}

/** interpret — REUSES interpretKpi (DRY; no parallel resolver). */
export function interpretFeatured(items: FeaturedItemSpec[], ctx, store): FeaturedSlideDef[]
/** warm — REUSES extractKpiRequirements (warm === render). */
export function extractFeaturedRequirements(items: FeaturedItemSpec[], ctx): Requirement[]
```

`interpretFeatured` **lowers each `FeaturedItemSpec` to a `KpiSpec`** and calls the existing `interpretKpi`:

```ts
const m = getMetric(item.metric)                       // governance from the SSOT
const kpi: KpiSpec = {
  id:    `${item.metric}@${JSON.stringify(item.at ?? {})}`,
  label: m?.label ?? item.metric,                       // ← label from the metric (SSOT)
  unit:  m?.unit  ?? '',                                 // ← unit  from the metric (SSOT)
  color: '<token>',
  value: { type:'point', measure:item.metric, time:item.time, filter:item.at }, // format ← metric.format (U1)
  trend: item.trend,
  methodologyUrl: m?.methodology,
  // preliminary is DERIVED automatically by interpretKpi from OBS_STATUS at the coordinate (Law 9)
}
```

Because the value goes through `interpretKpi` → (U1) `resolveMeasureRef` → `storeVal`, the slider shows the **live governed number at the featured coordinate** — never `FEATURED.json`'s snapshot value (that snapshot is authoring/verification only; see §5 drift fitness). `preliminary` falls out for free from the OBS_STATUS at the read coordinate (GDP figures are `obsStatus:'P'`).

**Why lower to KpiSpec rather than a new resolver:** maximal reuse (Law 4) — warm/render symmetry, the async warm-then-read hook, the preliminary derivation, the i18n resolution boundary, and template expansion all come for free and stay single-sourced.

### 2.4 Layer placement (the dependency arrow — Law 3)

```
contracts (ManifestMetric +format)
  → expr
  → core   : metric.ts (+format), kpi.ts (U1), featured.ts (FeaturedItemSpec/interpretFeatured)  ← vocabulary + interpreter
  → charts
  → react  : engine/useFeaturedRows.ts (warm+read hook, mirrors useKpiRows)                       ← adapter
  → plugins: nodes/featured-slider/default/** (Shell + META + Skeleton + css)                     ← renderer
  → apps   : geostat (registerManifestMetrics already wired) ; api/provisioning (authoring)
```

Nothing imports against the arrow. `core` owns the declarative vocabulary + pure interpreter (like `DataSpec`/`KpiSpec` do); `react` owns the store-aware hook; `plugins` owns the pixels. This is byte-for-byte the split that `kpi-spec.ts` (core) vs `kpi-strip` Shell (plugins) already uses.

---

## 3. The featured-slider node (plugin) — reference-platform-grade

New node `featured-slider` at `packages/plugins/nodes/featured-slider/default/`:

```
FeaturedSliderNode.ts   type FeaturedSliderNode { type:'featured-slider'; items:FeaturedItemSpec[]; autoplayMs? }
                        + PropSchema / Defaults / Groups / Slots  (Constructor-ready, Law 8)
                        + declare module NodeTypeMap augmentation
meta.ts                 META { sliceType:'node', type:'featured-slider', category:'content',
                               caps:['data'], schema, groups, i18n:{prev,next} }
FeaturedSliderShell.tsx NodeRenderer → useFeaturedRows(def.items, ctx) → FeaturedSlideDef[] → carousel
FeaturedSliderSkeleton  warm/suspense placeholder (mirrors StatsCarouselSkeleton)
featured-slider.css     token-derived ONLY — NO yellow (yellow was an authoring signal, never UI)
index.ts                barrel { Shell, Skeleton, META, types }
```

**Design decision — a NEW node, not evolving `stats-carousel`** (owner-confirmable, reversible):
`stats-carousel` is a `caps:[]` *editorial content* node with **no store access** (its `StatItem.value` is a plain string). Making it data-bound crosses its concern boundary. The featured-slider is a `caps:['data']` node that reads the store through the KPI seam. Clean SoC → separate nodes. Strangler: the landing page migrates from the hard-coded `stats-carousel` to `featured-slider` (§4 P3); `stats-carousel` remains available for genuinely-editorial static slides (or is retired later once no page uses it).

**What each slide shows** (reference-grade — ONS/Eurostat/OWID "key figures"):
- the **metric label** (from the semantic layer, bilingual), the **live value + unit** (governed format), an optional **trend/context** (YoY vs prior year — value text + direction glyph + `aria`), a **preliminary badge** when the coordinate's OBS_STATUS is `P` (Law 9), a **methodology info-affordance** when the metric declares one, and a **drill-through link** to the owning page.
- items are grouped into **tabbed slides** by `group` (National Accounts / GDP / Regional — mirroring today's 3 tabs and `FEATURED.json`'s 3 datasets), auto-advancing (`autoplayMs`), with prev/next.

**Accessibility (WCAG 2.1 AA — Law 9):**
- Carousel semantics: a `role="group"`/`aria-roledescription="carousel"` region; tabs as a `role="tablist"` with `aria-selected`; slides as `role="tabpanel"`; `aria-live="polite"` on the active slide so screen readers announce auto-advance.
- **Keyboard**: Left/Right arrow to move tabs (roving tabindex), Enter/Space to activate, Tab reaches every drill-through link; auto-advance **pauses on focus/hover** (`prefers-reduced-motion` → autoplay off).
- **No color-only information**: trend carries a text value + a glyph + `aria-label` (up/down/flat), never hue alone (the `stats-carousel` today color-codes the arrow — the featured-slider adds the text, satisfying the AR-26 leak-gate + Law 9).
- Each slide is reachable/legible without JS motion; the drill link is a real `<a href>` (crawlable — ties to AR-28 SEO north-star).

**i18n (leak-proof — reuses the AR-26/AR-37 seams):**
- label/unit/group/href resolve to the active locale at the render boundary via `useResolveLocale` (the existing seam) — no new mechanism.
- metric labels are authored bilingual in provisioning `metrics[]` (`FEATURED.json` already carries `{ka,en}`), so the `config-no-locale-leak` fitness (AR-26) structurally forbids a monolingual featured label.
- chrome strings (prev/next) via `META.i18n` (like `stats-carousel`).

**Constructor-ready (Law 8):** `items` is pure declarative data (metric-id + coordinate + href); a new headline = a new item (interface unchanged). The `metric` field is exactly the seam AR-10's `describeApp()`/`listMetricDefs()` metric-picker will populate — noted for AR-10/AR-11, not built here.

---

## 4. Phased build plan (Strangler-Fig; each phase green + demonstrable)

**P0 — Semantic-layer completion (engine spine, additive, byte-identical).**
- Add `format` to `MetricDef` + `ResolvedMeasure` + `ManifestMetric` wire + `registerManifestMetrics`.
- U1: make `resolveValue`/`resolveTrend` metric-aware via `resolveMeasureRef` (codes + `mergeMetricDims` + inherit unit/format when consumer omits).
- **Demonstrable first slice:** migrate ONE existing GDP-page KPI (real GDP growth) from raw code → metric-id; prove **byte-identical** render + warm (FF-RAW-CODE-IDENTICAL + FF-KPI-METRIC-AWARE). No UI change.
- Owner decision: the metric-governance **precedence** (explicit KPI `format`/`unit` wins over metric default) — confirm.

**P1 — Populate the semantic layer with the 11 featured indicators.**
- Author `metrics[]` entries in `geostat.provisioning.json` for each `FEATURED.json` headline not already a metric (GNI/GDI/Gross-Saving/Net-lending on `accounts`; real-growth/per-capita/current-prices on `gdp`; the 4 regional GVA on `regional`), each with label (bilingual, from `FEATURED.json`), unit (from V16 seed — do **not** fabricate), format, `dataSource`, and `dims` defaults (account/side/approach — the "where the indicator lives").
- Validated by the existing `config-cube-contract` fitness (CHECK 3: metric.code ∈ dataset CL_MEASURE).
- Owner decision: unit labels + the "omit methodology, don't fabricate" rule — confirm.

**P2 — The `featured-slider` node.**
- `core/data/featured.ts` (`FeaturedItemSpec`, `interpretFeatured`, `extractFeaturedRequirements`) → `react/engine/useFeaturedRows.ts` → `plugins/nodes/featured-slider/**` → register in the plugins barrel.
- Unit-level: renders live values from a fixture store; a11y roles present; no hard-coded values.
- Owner decision: **new node vs evolve `stats-carousel`** (recommend new node) — confirm.

**P3 — Strangler-migrate the landing headline.**
- Replace the hard-coded `stats-carousel` node in the `landing` page (`geostat.provisioning.json`) with a `featured-slider` whose `items[]` are generated from `FEATURED.json` (metric-id + coordinate + group + href + trend for the GDP/growth items).
- The hand-typed `"204 000"`/`"54 100"` strings die; the slider now shows the **live published** figures.
- **Full demonstrable slice:** landing page shows 3 tabbed slides of live featured figures, bilingual, GDP items badged preliminary, each drilling to its owning page — the whole yellow-cell → `FEATURED.json` → semantic-layer → config → render pipeline, no hardcode.
- Owner decision: FEATURED.json→provisioning is a **generator script** (guarantees "mark yellow → appears") vs hand-authored provisioning for the first slice (recommend hand-author P3 first, add the generator once proven) — confirm.

**P4 — (Elevation, gate on real need) provenance flow + drift guard.**
- Install `withMetricProvenance` in the stats store builder (`packages/plugins/datasources`) so metric unit/methodology reach live Law-9 badges (the metric-delivery memory flagged it is installed *nowhere* today).
- FF-FEATURED-VALUE-MATCHES-SNAPSHOT: an integration fitness asserting each live-resolved featured value ≈ `FEATURED.json.value` (tolerance) — catches data drift between the authoring snapshot and the published store.
- Do NOT build the deep-link drill coordinate here (see §7 elevation → AR-31/AR-42).

---

## 5. Test / fitness strategy

| Fitness fn | Asserts | Where |
|-----------|---------|-------|
| **FF-RAW-CODE-IDENTICAL** (extend to KPI) | a raw-code KPI resolves byte-identically post-U1 (no metric-id collision changes behavior) | `core/data/kpi-value-binding.fitness` |
| **FF-KPI-METRIC-AWARE** | a KPI referencing a metric-id renders the SAME `KpiDef` as the equivalent raw-code KPI + governed unit/format | `core/data` |
| **FF-KPI-WARM-RENDER-SYMMETRY** | post-U1, `extractKpiRequirements` codes === `resolveValue`'s read codes (no cache-miss) | `core/data` |
| **FF-METRIC-FORMAT-GOVERNED** | when a KPI omits `format`, the metric's `format` is applied; explicit wins | `core/data` |
| **FF-FEATURED-THROUGH-KPI-SEAM** | `interpretFeatured` produces values via `interpretKpi`/`storeVal`, never inline/hard-coded | `core/data/featured.fitness` |
| **FF-FEATURED-NO-HARDCODE** | a `featured-slider` node config carries metric-refs (`items[].metric`), never literal `value` strings | plugins |
| **FF-FEATURED-A11Y** | rendered slider has tablist/tabpanel roles, keyboard handlers, trend text (no color-only) | plugins (rendered-DOM) |
| **config-no-locale-leak** (AR-26, reused) | no monolingual featured label leaks | provisioning scan |
| **config-cube-contract** (reused, CHECK 3) | every featured metric.code ∈ its dataSource dataset CL_MEASURE | provisioning |
| **FF-METRIC-THIN** (reused, N26) | `MetricDef` gains no filters/joins/sql (only `format`) | `core/data/metric.fitness` |
| FF-FEATURED-VALUE-MATCHES-SNAPSHOT (P4) | live value ≈ FEATURED.json snapshot | integration (store) |

Test pyramid: unit (interpretFeatured over a fixture store) > component (Shell rendered-DOM a11y) > integration (P4 drift, needs docker api+db). Warm===render is guarded structurally, not by a live server.

---

## 6. Migration path (zero value drift — Law 7)

1. **P0 makes migration safe**: because render and warm both resolve through `resolveMeasureRef`, migrating any KPI/DataSpec `measure` from a raw code to a metric-id is byte-identical *by construction* (the metric's `code` is the same raw code; governance only *fills* absent fields). FF-RAW-CODE-IDENTICAL freezes this.
2. **Headline indicators become metrics (P1)** — the GDP/accounts/regional pages' existing KPIs that today use raw codes can then migrate their `measure` to the shared metric-id, so the **slider and the page KPI render the identical governed number** (the SSOT payoff). This migration is *adoption*, done incrementally page-by-page, each guarded by FF-RAW-CODE-IDENTICAL — not a big-bang.
3. **The hard-coded stats-carousel is retired from the landing page (P3)** — the one place carrying non-derived numbers is deleted, closing the drift at its source.
4. calc-metrics (`accounts.laborShare`) already flow through the semantic layer — no migration needed; they are the proof the pattern holds.

Nothing is rewritten; legacy migrates to the pattern behind fitness guards (Strangler-Fig).

---

## 7. Elevation opportunities (NOTE for the registry — do NOT build here)

- **Deep-link drill-through** (slide → the exact indicator/coordinate on the owning page, `/ka/gdp?metric=…&year=…`) → depends on the **AR-31 permalink lattice** + **AR-42 grammar-of-interaction** (cross-page params). Start with a page-level `href`; elevate when the permalink lattice lands.
- **Provenance / lineage on the slide** (value → SDMX source → vintage → revision → methodology, not a single badge) → **AR-43 data-lineage surface**. `withMetricProvenance` (P4) is the first thread; the full lineage graph is AR-43.
- **Declared dimensionality on `MetricDef`** (which dims a metric is defined over) → enables the **AR-10/AR-11 Constructor metric-picker** to prompt the right coordinate + validate. Deferred (YAGNI — the featured-slider pins coordinates explicitly); note as a Constructor-facing registry follow-up.
- **Featured as a first-class curated collection type** (a `SemanticCollection` the Constructor browses, not just a node's `items[]`) → natural once a *second* curated surface appears (e.g. a "key indicators" section on each topic page). Build on the second consumer, not speculatively (Law 8 / no-capability-without-consumer).

---

## 8. Risks + owner-decision points

**Owner sign-off (schema / data / one-way-ish):**
1. **`format` on `ManifestMetric` (wire contract)** — additive, backward-compatible (expand-contract, absent ⇒ byte-identical), but it *is* a change to the api↔runner contract. Low risk; confirm the field.
2. **The 11 featured metrics' units + labels** (from `FEATURED.json` + V16 seed) and the **"omit methodology, never fabricate"** rule. Data authoring — confirm.
3. **FEATURED.json → provisioning generator vs hand-authored** for P3. Reversible; recommend hand-author first, generator once proven.

**Reversible design calls (confirm, but I recommend):**
4. **New `featured-slider` node** (not evolving `stats-carousel`) — SoC (data-bound vs editorial). Recommend new node.
5. **Strangler-retire `stats-carousel` from the landing page** — keep the node for generic editorial use; delete later only if unused.
6. **Page-level drill href** now, deep-link later (elevation §7).

**Risks (mitigated):**
- *Metric-id/raw-code collision* (U1 changes behavior if a metric-id equals an existing raw code) — none today (metric-ids are namespaced, e.g. `accounts.laborShare`); guarded by FF-RAW-CODE-IDENTICAL. Low.
- *Slider shows a snapshot, not live* — explicitly prevented: values resolve through `interpretKpi`/store; `FEATURED.json.value` is verification-only, guarded by the P4 drift fitness. 
- *Async warm gap* — reuses `useKpiRows`' proven warm-then-read (incl. the YoY t-1 comparison period) via `useFeaturedRows`; no new cold-throw surface.

---

## 9. Definition of done (the first demonstrable slice = P0+P1+P2+P3)

The landing page renders a **data-bound featured-slider** of live published headline figures (GNI/GDI/Gross-Saving/Net-lending, real-GDP-growth/per-capita/current-prices, 4 regional GVA), grouped into 3 tabbed slides, bilingual with no locale leak, GDP items badged preliminary, each drilling through to its owning page, keyboard-navigable with no color-only trend — **built entirely through the semantic layer + config pipeline from the yellow-cell → FEATURED.json signal, with zero hard-coded values**, all fitness functions green, and the same metric-ids reused by the owning pages' KPIs so every surface shows one governed number.
