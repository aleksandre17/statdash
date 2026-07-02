# SPEC — Render Data-Pipeline TARGET (implementation-ready, zero-ambiguity)

> **Owner:** platform-architect (Opus). **Date:** 2026-07-01. **Status:** TARGET SPEC — build from this, no rework. **Feeds:** a work-board; each `E#`/`C#` is a board-item boundary.
> **Method:** converge-the-maximal-target-first. Screenshots (`scriness/img*.png`) define the intended LAYOUT; correctness = layout **+** drift fixes (axis must not lie · map not flat · "average" aggregates · components roll up · async store not cold-crash).
> **Supersedes/extends** `DESIGN-rendering-architecture.md` (AR-28), `DESIGN-time-mode-decision.md` (AR-22, ratified), `ARCHITECTURE-REGISTRY.md`: promotes warm-contract + formatting-SSOT from convention to build gates, consolidates the two choropleth engines (AR-12/RX-16), adds a first-class **mean** KPI reduction, re-specs the **effects** capability lost at `0ea99b6`.

---

## DELTA — img_6…14 (added 2026-07-02)

> Per-image breakdown + C7 spec + E9 + O-8…O-12 / LV-1…LV-5 ledgers → companion **`SPEC-render-pipeline-target.DELTA-6-14.md`** (split for the one-concern ceiling). Corrections landed IN THIS file: **(1)** E6 expenditure = `contribution`/waterfall **bridge**, not a bar (prov. 1758, `C+I+X−M=მშპ`, `isTotal` red `=GDP`). **(2)** New conditional axis **C7** — per-section chart↔table toggle (`view.role` sibling children; section owns `data`, both views re-encode the same warmed rows). **(3)** New page + element **E9** — SNA `/accounts` T-account sequence as `hbar-diverging` (prov. 377, `perspective-is year`); E8 pivot is its table view.

---

## 0. Canonical target pipeline (the SSOT flow)

```
PerspectiveDef.scope.binding (selection: point|window|all) → scopeCtxByPerspective(perspectiveState) folds into ctx.dims
  → SectionContext { dims, perspectiveState, filterParams, locale }
  → WARM PASS (async store): extractRequirements(DataSpec)+extractKpiRequirements(KpiSpec) → store.warm(reqs)  [C2: warm===render]
  → interpretSpec(spec,ctx,store) → EngineRow[] → DataTable/PivotTable  &  interpretChart → ChartOutput → Apex/GeoMap/donut
  → number formatting via ONE registry (getFormatter · fmtNum · compact)  [C1: never the `/1000+' 000'` hack]
```

**Invariants (each a fitness function — see §4):** **I-1 Formatting SSOT** — every number (KPI·cell·axis tick·data-label·tooltip) funnels through `getFormatter`/`fmtNum`/compact; no hand-rolled abbreviation `[C1]`. **I-2 Warm===Render** — every data-reading node/KPI contributes its exact read-set; no spec warms `[]` while reading `[C2]`. **I-3 One choropleth engine** — value→fill in one place; `panels/map` deleted `[C4]`. **I-4 No privileged dimensions** — `ctx.dims['time']`, no `if mode==='year'` (Law 1). **I-5 Declarative config** — data+intent only, never functions/`fetch` (Law 2).

---

## 1. CROSS-CUTTING CAPABILITY SPECS (build these first — every element depends on them)

### C1 — Formatting SSOT (fixes DRIFT 1: axis labels lie / disagree with tables)

**Root cause.** `packages/plugins/panels/chart/default/utils/apex/base.ts` `yFormatter` does, when `decimals` is undefined and `|val| ≥ 1000`:
```ts
fmtNum(val / 1000, 0) + ' 000'    // rounds to nearest 1000, hard-codes last 3 digits as "000"
```
Lossy by construction: `88 425.6 → "88 000"`, `4 830 → "5 000"`, ticks `1500` & `2000` both → `"2 000"` (duplicate, non-monotonic). It bypasses the `LocaleFormatter`/`fmtNum` SSOT and disagrees with the table, which prints the same datum honestly as `88 425.6`.

**Target.** Delete the `/1000 + ' 000'` branch. Route axis ticks through a **compact-notation formatter** registered in the ONE formatter registry (`packages/core/src/data/transform/formatters.ts`), so axis and table derive from the same source and never disagree in magnitude.

- Add `compact` to `FORMATTERS`, backed by `Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 })` — resolves through the locale registry (Law 4, adopt the standard whole), deterministic under jsdom/SSR via the builtin fallback.
- `yFormatter(unit, decimals)`:
  - `decimals` given → `fmtNum(val, decimals)` (unchanged, correct).
  - `decimals` undefined → **`compact(val)`** (e.g. `88.4K` / `88.4 ათ.`), NOT `/1000+'000'`.
- The compact formatter is **monotonic** (equal ticks never collapse to duplicates) because it preserves 1 significant fraction digit.
- Data-labels (`cartesian.ts` end-labels) already pass `decimals ?? 1` → correct; leave them.

**[OWNER-CONFIRM O-1]** Axis-tick style. DEFAULT = **compact** (`88.4K`, locale-aware) — industry standard (Grafana/Datawrapper/OWID), scales to any magnitude, agrees with the table by rounding-not-fabricating. Alternative = **honest-full** (`88 426`, space-separated) — exact but wide on tall-value axes. I recommend compact; confirm the abbreviation glyph for `ka` (`ათ.`/`მლრ.` vs `K`/`B`).

**Boundary.** Fix is in `formatters.ts` (add `compact`) + `base.ts` (`yFormatter` else-branch) + `responsiveYAxis` (already re-carries the formatter — keep). Wide blast radius, single-seam fix. Law 6 root-cause.

---

### C2 — Warm-contract guard (fixes the static→async cold-crash regression, standing vector)

**Root cause.** The async `ApiStore` **throws** on cold `querySync`; the old sync `ExternalStore` never did. Every data-reading node/KPI MUST register its reads in the warm pass or it renders EMPTY / crashes in production (the `5881a5b`/`ba9d1a9` failure family). Today two gaps remain latent:

1. **`pivot` and `transform` DataSpec types return `[]` from `extractRequirements`** (`spec.ts:228-230`). Any panel whose data lowers to `transform`/`pivot` (e.g. a table-only or client-shaped spec) warms nothing → cold-crash on async. The geostat sections use `query`+`pipe` (warmed), but the seam is a live footgun.
2. **No structural gate** asserts that every registered node/KPI spec contributes to the warm set. New features re-regress silently (the #1 recurring trap named in `effect-variable-architecture-drift.md`).

**Target — make the requirement contract enforced, not conventional.**

- **C2-a `extractRequirements` covers every read-issuing spec type.** For `pivot`/`transform`: emit the requirements of the **upstream `query`/base read** the pipe consumes (the pipe transforms already-fetched rows; the fetch is the `query` under it). If a spec type genuinely issues no store read (pure client compute), it must be *provably* read-free, asserted by C2-c — not defaulted to `[]`.
- **C2-b Warm === Render SSOT.** The warm walk (`warm.ts collectRequirements`) and the render read (`interpretSpec`) share the SAME visibility gate (`visibilityGate.ts`, already true) AND the SAME requirement extractor. KPIs use `extractKpiRequirements` (already covers the `t-1` comparison year, `cagr` from+to, `share` num+denom, `metric` components — correct; keep). Confirm the geograph node's `data.query` is walked by `collectRequirements` (it is: `node['data']` → `extractRequirements`).
- **C2-c Fitness gate `FF-WARM-COVERS-RENDER`.** For each page × perspective × locale: run the warm pass to build `warmSet`, then execute a render against a store that **throws on any `querySync` whose key ∉ warmSet**. A cold read = build failure. This converts the standing regression vector into a caught-at-CI defect. This is the single highest-value guard in this spec after C1.
- **C2-d Registration rule (board-item acceptance criterion, binding on every new element):** a new data-reading node/KPI type is not "done" until (1) it registers its reads in `extractRequirements`/`extractKpiRequirements`, and (2) it honours the visibility gate so only the active perspective's slices warm. No exceptions.

**[OWNER-CONFIRM O-2]** For `transform`/`pivot` specs that wrap a `query`: confirm the fetch is always the nested `query` (so warm = the query's reqs). If any pipe issues its own secondary store read (e.g. a lookup that hits the store rather than a codelist), name it — it needs its own requirement contribution.

---

### C3 — Effects recovery: reactive param mutation on mode switch (lost at `0ea99b6`)

**Root cause.** The static era's `effects` (change perspective A → set/clear param B) were narrowed away when the config migrated onto the perspective seam, which modeled *only* visibility (`perspective-is`), never reactivity. The deleted `Effect`/`applyEffects` was correctly removed as dead code — but the **capability** was lost at P5, not at the deletion. Today the `წლიური↔დინამიკა` toggle is purely presentational: entering `range` does NOT clear the stale single `year` or pin `sector:'_T'`; leaving `range` does NOT clear `fromYear`/`toYear`. Stale params linger hidden across a toggle.

**Target — re-express effects FORWARD on the perspective/expr seam (NOT a rollback of the deleted `Effect` type).**

- **Contract (JSON-serializable, Constructor-authorable, on `PerspectiveDef`):**
  ```jsonc
  "perspectives": [{
    "id": "range",
    "scope": { "binding": { … } },
    "onEnter": { "set": { "year": null, "sector": "_T" } },   // fired when this perspective becomes active
    "onExit":  { "set": { "fromYear": null, "toYear": null } } // fired when leaving it
  }]
  ```
  - `set` values are whitelisted `ExprVal`/literal/`null` (clear). No functions. Optional `when?: VisibilityExpr` guard per rule (reuses `perspective-is/in/not`+`eq/isset/in`).
- **Evaluator:** pure `applyPerspectiveEffects(active, prev, params) → params'` in the filter-resolution pass (the slot the deleted `applyEffects` occupied — `useFilterState`/`SiteRenderer`, after `computed`, mutating only the flat param Record). Deterministic, one pass.
- **Constructor:** an "Effects" sub-pane beside Perspectives — `onEnter`/`onExit` `set`-rules as key→value rows (registry-driven).
- **Guard:** `check-laws.sh` forbids the OLD `applyEffects`/`Effect[]`/`.effects` names — the recovery lands under the NEW `onEnter`/`onExit` vocabulary, so those guards stay intact.

**[OWNER-CONFIRM O-3]** Build now vs defer. Effects is a real but low-visibility capability (no user-visible break in the screenshots; the stale-param cases are edge). DEFAULT = **build it now** as a small, bounded capability, because (a) it closes the P5 gap at the seam (visibility + reactivity become peer perspective capabilities), (b) it gives dependent-selector/cross-filter cascades a reusable base, and (c) the geostat config genuinely wants the `range→clear year, pin _T` rule for correctness. If the owner would rather defer behind a named door until a second consumer, mark it `D-EFFECTS` and it costs nothing to open later (the seam — perspectiveState transition — is already observed by `useFilterState`).

---

### C4 — Choropleth consolidation: one engine, correct join (fixes DRIFT 2: flat map)

**Root cause (two problems).**
1. **Flat map.** `GeoMap.tsx` builds `colorByGeo` keyed by `String(r.id)` (the `geo` dim value, e.g. `R5`), and `colorFor(geoId)` looks up by `geoId = geoCodeMap[iso]` (ISO→code). When `rows` is empty at first paint (cold warm) OR the join key mismatches, every lookup misses → `fillColor()` = flat `--color-accent`. In `img_1` the whole map is one flat blue while the adjacent table has all 10 regional values → the join/feed failed, not the color math (`quantileColors`/`sequentialRamp` are correct and index-aligned).
2. **Two rival engines (SSOT violation).** `packages/plugins/nodes/geograph/.../GeoMap.tsx` (`quantileColors`) AND `packages/plugins/panels/map/default/mapColorUtils.ts` (`buildColorScale` quantile/linear/threshold). AR-12/RX-16 decision: fold map into `geograph`, delete the `panels/map` stub.

**Target.**
- **C4-a One engine.** `geograph` is the sole map node. Delete `packages/plugins/panels/map/default/mapColorUtils.ts` and its `buildColorScale`. The value→fill scale is `styles/utils/choropleth.ts` (`sequentialRamp` + `quantileColors`) — the token-derived, agnostic, rebrandable one (AR-25). `capabilityGate` gates on the `geo` capability, not a type-sniff.
- **C4-b Fix the join.** The color map and the feature lookup MUST key on the SAME space. Target: build `colorByGeo` keyed by the **geo dim code** (`r.id`), and resolve each feature's code ONCE via `geoCodeMap[iso]`, then look up `colorByGeo.get(code)`. Add a dev-time assertion: if `rows.length > 0` and EVERY feature misses the color map, emit a diagnostic (`GEO_JOIN_EMPTY`) — a flat map becomes a loud failure, not a silent one (fail-fast, Law 6). Verify `geoCodeMap` covers every `isoField` value in the GeoJSON (the geostat map has 11 `GE-*`→`R#` entries; the occupied-territory ISOs `GE-AB`/`GE-OS` correctly have no datum → `labelOverrides` tooltip, no fill).
- **C4-c Cold-paint correctness.** The map must not paint flat because `rows` is empty at first paint. Under the warm contract (C2), the geograph's `data.query` warms before render, so `rows` is populated at paint. Guard: the color memo recomputes on `rows` change (it does — `useMemo([rows])`); ensure the GeoJSON `style` callback re-runs when `colorByGeo` changes (today it's keyed only on `selectedGeos.join(',')` — **add `colorByGeo` identity to the GeoJSON `key`** so a late-arriving `rows` re-styles the layer). This is the concrete flat-map fix if the cause is async warm rather than a key mismatch.
- **C4-d Selection vs value encoding stay orthogonal.** Fill COLOR = value (sequential ramp). Fill OPACITY + stroke WEIGHT = selection/hover (`FILL_SELECTED`/`WEIGHT_SELECTED`). `img_5`'s two dark regions are the *selection highlight* on a 2-region filter (correct), NOT the value ramp — keep this orthogonality (Mapbox/Vega convention).

**[OWNER-CONFIRM O-4]** Whether the value ramp should be **active in the annual "all regions" view** (`img_1` — I assert YES: shade all 10 regions by GVA, the headline visual) AND remain a flat-with-selection-highlight in a multi-region *filtered* view (`img_5`), or always ramp. DEFAULT = **always ramp by value; selection adds opacity/stroke on top** (both encodings live simultaneously — the most information-dense and the reference-platform norm).

---

### C5 — First-class `mean` KPI reduction (fixes DRIFT 3: "average real growth" = 0.0%)

**Root cause.** `kpi.ts` `KpiValueSpec` has no arithmetic-mean reduction (`point|yoy|cagr|share|expr|metric`). To show an "average" of a rate series the config (mis)uses `cagr`, whose guard `vFrom && to > from ? … : 0` returns **0** when the baseline value is falsy. For `real-gdp-growth-rates` the 2010 baseline is `0` → `vFrom` falsy → **0.0%**. Two faults: (i) CAGR (a *level* operator) applied to a *rate* series (wrong tool), (ii) the falsy-baseline guard silently yields 0 instead of failing loud.

**Target.**
- **C5-a New `KpiValueSpec` discriminant `mean`** (Law 8 platform capability; OCP — new arm, interpreter unchanged):
  ```jsonc
  { "type": "mean", "measure": "real-gdp-growth-rates",
    "from": {"$ctx":"fromYear"}, "to": {"$ctx":"toYear"},
    "filter": {"geo":"GE","approach":"_Z"}, "format": "sign_pct" }
  ```
  Semantics: arithmetic mean of the measure over the inclusive `[from,to]` coordinate set: `Σ v(t) / N`. Reads N observations; warm contribution = one requirement per year in `[from,to]` (mirror the `growth` DataSpec's per-year enumeration in `extractKpiRequirements`).
- **C5-b Bind the card.** The GDP-dynamics "საშუალო რეალური ზრდა / Average real growth" KPI uses `type:'mean'` on `real-gdp-growth-rates`. Expected: mean of the 2010–2025 real-growth series ≈ **+4–6%/yr** (the series in `img_3`/`img_4`: 0, +7.9, +6.6, +5.1, +4.1, +3.4, +3.4, +5.2, +6.1, +5.4, −6.3, +10.6, +11, +7.8, +9.7, +7.5). Trend dir from the sign.
- **C5-c Fail-loud guard.** The `cagr` falsy-baseline branch that returns `0` is a silent-zero footgun (Law 6). Target: when `vFrom` is falsy (missing/zero baseline) for a `cagr`, emit a `KPI_CAGR_ZERO_BASELINE` diagnostic rather than silently returning 0 — so a future misuse surfaces at dev time instead of publishing a wrong statistic. Keep the numeric fallback for production resilience, but make it observable.

**[OWNER-CONFIRM O-5]** Mean semantics for the base year. The 2010 real-growth datum is `0` (it is the baseline year with no prior). DEFAULT = **include all N years in the mean** (matches "average annual growth over 2010–2025"). Alternative = **exclude the base year** (`N-1`, average of actual year-on-year growth) → yields a higher figure (~+5.5%). This is a published-statistic definition call — confirm which the NSO intends. (Geometric mean is the third option but the label says "average," and CAGR already covers geometric growth of *levels* — do not conflate.)

---

### C6 — Component decomposition rollup + dimension pinning (fixes DRIFT 4 & 5)

**Root cause (Drift 4).** "GDP by expenditure method" renders 2 bars (88 425.6, 104 598.1 — two *years* of total GDP) instead of a component breakdown; "GDP by production method" donut collapses to ~4 slices. The panel query `{ measure:'*', filter:{ geo:'GE', approach:'PROD', time:{$ctx:'time'} } }` (provisioning ~1535) under-specifies the decomposition: the component dimension is neither pinned to a single member nor cleanly rolled up, and `time` is not resolving to a single year (returning multiple years → the two-bar artefact). The obs read does no aggregation; whatever rows exist render.

**Root cause (Drift 5).** Per-capita 2014 = "483" (~10× low, wedged between 4 712 and 4 085). Not the C1 formatter (the table uses the real field formatter). A wrong/partial row was resolved for 2014 — a component or unit-scale mismatch in the obs read / `storeVal` row-selection (same underspecification family as Drift 4).

**Target — every component chart pins its full coordinate and rolls up the component dimension explicitly.**
- **C6-a Pin the coordinate.** Each component-decomposition panel MUST pin: the approach (`approach:'PROD'|'EXP'`), the geo (`geo:'GE'`), a **single** `time` (verify `{$ctx:'time'}` resolves to one year in `year` mode — the perspective `binding.selection.kind:'point'` pins `time` to `{$ctx:'year'}`; confirm `time` is not left multi-valued), and iterate the **component dimension** as the series/category axis.
- **C6-b Explicit rollup.** Use the pipe's `aggregate by [<componentDim>, time]` → one row per component (the sectoral donut at ~3370 already does this correctly for `sector`; the GDP expenditure/production charts must mirror it for their component dimension). Add the `rollup` total row where a "Total/სულ" wedge is shown (as the sectoral donut does).
- **C6-c Degenerate-guard.** If a component decomposition resolves to `< 2` components, emit a `COMPONENT_DECOMP_DEGENERATE` diagnostic (a decomposition that isn't decomposing is a data/config error, not a valid render). Empty → the panel's empty-state, never a misleading 2-bar chart.
- **C6-d Per-capita row-selection.** Trace the per-capita measure's `interpretSpec` row selection for 2014: assert exactly one observation is selected per (measure, geo, time); if the store returns multiple candidate rows (e.g. a unit-scale duplicate), the resolver must select deterministically and a multi-match must diagnose (`ROW_AMBIGUOUS`), not silently pick the wrong one.

**[OWNER-CONFIRM O-6]** The **component dimension** that carries the expenditure/production breakdown. The DSD dimensions are `account, geo, measure, sector, side`. For GDP-by-expenditure/production the components appear to live on the **`measure`** dimension (sub-codes under an `approach`), not a dedicated component dim. Confirm: is the expenditure breakdown `measure` sub-codes filtered by `approach:'EXP'`, and production by `approach:'PROD'`? The correct query is "iterate `measure` where `approach=EXP`, pin geo+single-time, roll up." I need the exact `measure`-code set (or the `side` dim role) to finalize the query — this is the one place I cannot fully resolve from config alone. **This is the highest-material OWNER-CONFIRM.**

**[OWNER-CONFIRM O-7]** Per-capita 2014 = 483: is this a **seed-data error** (bad observation in the gold layer) or a **pipeline row-selection** fault? DEFAULT assumption = pipeline row-selection (C6-d fixes it). If the seed value itself is 483 (should be ~4 831), it is a data-ingest fix, out of pipeline scope — flag to database-architect. Quick check: query the gold layer for GDP-per-capita geo=GE time=2014.

---

## 2. PER-ELEMENT × PER-MODE × PER-FILTER TARGET MATRIX

> Notation: **Annual** = `year` perspective (`binding.selection.kind:'point'`, `time={$ctx:'year'}`). **Dynamics** = `range` perspective (`binding.selection.kind:'window'`, bounds `fromYear`/`toYear`). Every data read obeys the warm contract (C2) and formats through the SSOT (C1).

### E1 — KPI strip (4 cards; per-perspective set via `KpiSpec.when: perspective-is`)

| Aspect | Target |
|---|---|
| **Encoding** | Card = big number (channel: text) + unit + trend arrow/pct + trendSub caption. Color = the card's semantic accent (top border). |
| **Annual set (GDP page, `img_2`)** | GDP current (`point`, mln_gel) · Real growth (`point` on `real-gdp-growth-rates`, sign_pct) · Per capita (`point`, usd) · Deflator (`point`/`expr`, sign_pct). Each `when: perspective-is year`. |
| **Dynamics set (GDP page, `img_3`/`img_4`)** | GDP avg nominal growth (`cagr` on level GDP — **valid**, 10.9%) · **Average real growth (`mean` on rate series — C5, MUST be ~+5%, not 0.0)** · Per capita final-year (`point` @ toYear, usd) · Deflator avg (`cagr`/`mean`, 11.1%). Each `when: perspective-is range`. |
| **Regional Annual set (`img_1`)** | Cumulative growth (share/point) · Total (`point` @ selected year, sum over selected regions) · National share (`share`) · Avg growth. |
| **Regional Dynamics set (`img.png`)** | Cumulative CAGR (`cagr` on GVA level — valid) · Final-year total (`point` @ toYear) · Base-year total (`point` @ fromYear) · Average annual growth (`cagr` on GVA level — valid). |
| **Format** | Via `getFormatter(format)` (`mln_gel`·`sign_pct`·`usd`·`pct`). Locale from `ctx.locale`. NEVER a local abbreviation. |
| **Filter reactions** | **year-range change** → dynamics cards re-read at new `fromYear`/`toYear` (the `cagr`/`mean`/`point@toYear` re-resolve; warm set includes both bounds + every year in `[from,to]` for `mean`). **region select** (regional page) → cards that sum over `geo` re-aggregate over the selection (wildcard geo when "all"; the selected set otherwise — see `img_5` "total of current selection = 9 686"). **locale toggle** → label/unit/trendSub re-resolve from LocaleString; numbers reformat via locale. **mode toggle** → `kpiVisible` swaps the visible set; warm set swaps identically (C2). |
| **Warm contract** | `extractKpiRequirements` yields: `point`→1 read · `yoy`→t and t-1 · `cagr`→from and to · `share`→num and denom · `mean`→every year in [from,to] · `metric`→component reads. Visibility-filtered by the SAME `kpiVisible` predicate. |
| **Empty/degenerate** | Missing observation → card renders its zero/empty state, never a fabricated number. Preliminary datum → "P" badge (provenance port). Falsy CAGR baseline → diagnose (C5-c), do not silently show 0. |

### E2 — Region table with inline proportion bars (`img.png` dynamics; `img_1` has the same as a "Table" view)

| Aspect | Target |
|---|---|
| **What** | One row per region, sorted by value desc; columns = value (mln_gel) + share % with an inline horizontal proportion bar (`bar.max:100`). Footer = `sum`. |
| **Encoding** | Row = category (geo); value → text + bar length (channel: length); share → text + bar. Row color dot = per-geo palette color (from `lookup` on the `geo` codelist). |
| **DataSpec** | `query { measure:'regional.gva', filter:{ geo:{$ne:'_T'}, measure:'GVA', sector:{$ctx:'sector'}, time:{$ctx:'time'} } }` → pipe `aggregate by [geo,time]` → `lookup geo (label,color)` → `sort value desc`. Encoding `pct: {sumOf:'value'}`. (This is the correct, already-well-formed pattern — the reference for C6.) |
| **Format** | value → `mln_gel` (honest full: `42 982.6`) · pct → `pct` (`53.1%`). Table and any sibling chart axis now AGREE (C1). |
| **Filter reactions** | **year change** (annual) → re-reads at the pinned year; rows re-rank. **range** (dynamics) → the table shows the window's terminal/aggregate per its `time` binding. **region select** → rows filter to the selection; footer sum = selection total (drives the "total of current selection" KPI, `img_5`). **locale** → region labels + column headers re-resolve. |
| **Warm** | `query` case: per-year pin when `time` set; unbounded req when range. Covered. |
| **Empty** | No regions → empty table with header; footer sum = 0. |

### E3 — GDP bar chart — annual dynamics (`img.png` regional; `img_3` GDP `production` method 2010–2025)

| Aspect | Target |
|---|---|
| **What** | Vertical bars, one per year across the window (2010→2024/2025); y = GDP level (mln_gel). |
| **Encoding** | x = time (category) · y = value (length) · single series, single color. |
| **DataSpec** | `query`/`growth` over the time window; pipe `sort time asc`; encoding `label:time, value:value`. Bounds from `fromDim`/`toDim` (range mode) or the point (annual). |
| **Format** | **Axis ticks → `compact` (C1): `2K, 4K, 6K, 8K` — NOT `2 000, 2 000, 3 000`** (the duplicate-tick bug). Data-labels (if on) → `fmtNum(v,1)`. |
| **Filter reactions** | **year-range change** → re-reads the enumerated years; bars add/remove; axis rescales. **locale** → axis/label glyphs. **mode toggle** → this element `visibleWhen perspective-is` its owning perspective. |
| **Warm** | `query`/`growth` enumerates each year in the window → one req per (code, year). Covered; range-mode unbounded req keys identically to the read (GAP-4 handling in `spec.ts`). |
| **Empty** | Zero years → empty plot area with axes. |

### E4 — Sectoral structure — historical stacked-area (`img.png` bottom, 2010–2024)

| Aspect | Target |
|---|---|
| **What** | Stacked area, one band per sector, stacked to the GDP total across the full time window; y = level (mln_gel). |
| **Encoding** | x = time · y = value stacked · color = per-sector categorical palette (from `lookup` on `sector` codelist) · series = sector. |
| **DataSpec** | `query { measure:'regional.gva'|GVA, filter:{ geo pinned, sector:{$ne:'_T'}, time: window } }` → pipe `aggregate by [sector,time]` → `lookup sector (label,color)` → stack by sector over time. |
| **Format** | y-axis → `compact` (C1). Legend = sector labels (localized). |
| **Filter reactions** | **range change** → re-reads window; bands extend/contract. **region select** (if geo-scoped) → re-aggregates for the selection. **locale** → legend + axis. **mode** → visible only in the perspective that owns the historical view (dynamics). |
| **Warm** | Per-(sector,year) reads across the window. **Verify the stacked-area spec lowers to a warmed type** (query+pipe = warmed; if it lowers to `transform`, C2-a must cover it). |
| **Empty** | No sectors → empty; single sector → degenerate area (valid, not an error). |

### E5 — Choropleth map (`img_1` annual all-regions; `img_5` filtered selection)

| Aspect | Target |
|---|---|
| **What** | Georgia regions shaded by GVA value (sequential ramp); occupied territories labelled, unshaded; click = region select (multi, max 10). |
| **Encoding** | fill COLOR = value (quantile sequential ramp, C4) · fill OPACITY + stroke WEIGHT = selection/hover (orthogonal) · tooltip = label + value + share%. |
| **DataSpec** | `geograph.data = query { measure:'regional.gva', filter:{ geo:{$ne:'_T'}, measure:'GVA', sector:{$ctx:'sector'}, time:{$ctx:'time'} } }` → aggregate by [geo,time] → lookup geo (label,color). `geoCodeMap` bridges ISO→geo code. |
| **Correctness (C4)** | Ramp ALL regions by value in `img_1` (not flat). Join keys on the geo dim code both sides. Re-style on late `rows` (add `colorByGeo` to GeoJSON `key`). Diagnose an all-miss join. |
| **Format** | tooltip value → `fmtNum(v,0)` + unit; share → `fmtNum(pct,1)%`. |
| **Filter reactions** | **region select** → clicked region toggles into `region` param (multi); selected regions get `FILL_SELECTED`/`WEIGHT_SELECTED` highlight (`img_5`); value ramp persists underneath. **year change** → re-reads at year; ramp recolors. **locale** → tooltip labels. **mode** → the map is an annual-perspective element (`visibleWhen`). |
| **Warm** | geograph `data.query` walked by `collectRequirements` (C2-b). Must warm before paint (C4-c) or the map paints flat cold. |
| **Empty** | No rows → all features `fillColor()` neutral (documented empty state), tooltip absent; NOT a silent flat "success". |

### E6 — GDP component quartet: expenditure `contribution`/waterfall bridge · production donut · income treemap · capital donut-% (`img_6`/`img_9`)

| Aspect | Target |
|---|---|
| **What / Encoding** | Decompose GDP across a component dim at a single year (`img_6`/`img_9`). **Expenditure = `contribution`/waterfall BRIDGE** (prov. 1758; `C+I+X−M=მშპ`; import as a down-bar −55 669.6; `isTotal` red `=GDP` closing bar) — NOT a plain bar. Production = **donut** (center total). Income formation = **treemap** (prov. 2109). Capital formation = **donut %**. category = component (measure-subcode / sector) · color = categorical palette · donut center = total (`centerLabel`). |
| **DataSpec (C6)** | `query { measure: <component set>, filter:{ geo:'GE', approach:'EXP'|'PROD', time: single year } }` → pipe `aggregate by [<componentDim>, time]` → `rollup` total (where a Total wedge shows) → `lookup (label,color)` → `sort`. **MUST pin approach + geo + single time and iterate the component dim** (fixes the 2-bar / 1-slice degeneracy). |
| **Format** | value → `mln_gel` or `pct`; data-labels → `fmtNum`. |
| **Filter reactions** | **year change** → re-reads at the new single year; all components re-resolve. **locale** → component labels (localized codelist). **mode** → annual-only elements. |
| **Warm** | `query`+pipe warmed per component code at the pinned year. |
| **Degenerate guard (C6-c)** | `< 2` components resolved → diagnose; never render the misleading 2-bar chart. |

### E7 — Real GDP growth bar + contribution-to-growth bar + per-capita line (`img_3`/`img_4` dynamics)

| Aspect | Target |
|---|---|
| **Real growth bar** | Vertical bars per year, y = % (`sign_pct`), `axes.y.decimals:1` (so it uses `fmtNum(v,1)`, NOT compact — a rate axis wants `10, 5, 0, -5`). Negative bars render below zero (`img_3` 2020 = −6.3). The `mean` of this series feeds the E1 avg-real-growth KPI (C5). |
| **Contribution bar** | Per-year % contribution; `hideOverlappingLabels`+responsive rotate (AR-14) so year labels never clip. |
| **Per-capita line** | Line, x=year y=usd (`img_3`/`img_4`: 3 281→10 297). **The 2014 point must NOT be 483 (C6-d).** Axis → compact or honest. |
| **Filter/locale/warm** | As E3 (window enumeration, per-year warm, locale glyphs). |

### E8 — National Accounts SNA pivot table (`/ka/accounts`, AR-35; Resources/Uses `series`)

| Aspect | Target |
|---|---|
| **What** | Cross-classified pivot: account rows × Resources/Uses (`series`) columns. Dispatches to `PivotTable` (not `SimpleTable`). |
| **Correctness** | Header↔column alignment from ONE `alignClass(col)` source (numeric→right); header freezes on vertical scroll with a bounded `max-height` wrap (AR-35, already BUILT+VERIFIED). Numbers via C1 SSOT. |
| **Filter/mode** | Account selection + time binding per perspective. |
| **Warm** | If the pivot spec lowers to `pivot`/`transform`, C2-a MUST cover its underlying query reads (today `pivot`/`transform` warm `[]` — the latent gap). |

---

## 3. FILTER-INTERACTION CONTRACTS (cross-element)

| Interaction | Param mutation | Query re-run | Warm/requirements contract |
|---|---|---|---|
| **Year-range change (Dynamics)** | `fromYear`/`toYear` update in the flat filter map; `binding.selection.window` bounds re-resolve into `ctx.dims`. | Every window-scoped element (E3/E4/E7 charts, dynamics KPIs) re-reads the enumerated year set. | Warm set = per-year reqs across `[from,to]` + both bounds for `cagr`/`mean`. Range-mode `query` emits the unbounded req keyed identically to the read (GAP-4). |
| **Single-year change (Annual)** | `year` updates; `binding.selection.point.at` pins `time`. | Every annual element (E5/E6 + annual KPIs) re-reads at the one year. | One req per (code, year). |
| **Region select (Regional page)** | `region` param (multi, max 10) updates. `_geoMode` var derives `single`/`multi` (`region contains ','`). | geo-scoped elements re-aggregate over the selection (wildcard when "all"). Sectoral single-region view shows `visibleWhen _geoMode==single`. | Reqs fold the selected geo pins into `dims`; wildcard drops the dim so `val()` sums over geo. |
| **Locale toggle (ka↔en)** | `locale` in ctx. No data re-read. | No query re-run — pure re-resolve. | LocaleString labels/units/legends re-resolve; numbers reformat via the locale registry (C1). |
| **Mode toggle (წლიური↔დინამიკა)** | `perspectiveState.mode` flips; **`onEnter`/`onExit` effects fire (C3)**: enter range → clear `year`, pin `sector:'_T'`; exit range → clear `fromYear`/`toYear`. | The active perspective's `binding` folds into `ctx.dims`; `perspective-is`-gated nodes/KPIs swap. | Warm set swaps to the active perspective's slices ONLY (visibility gate); `kpiVisible` filters KPIs identically at warm and render (warm===render). |

---

## 4. FITNESS FUNCTIONS (lock the target as build gates)

| FF | Asserts | Fixes |
|---|---|---|
| **FF-FORMAT-SSOT** | No `+ ' 000'` / hand-rolled magnitude abbreviation in `packages/**`; every axis/label/cell formatter resolves through `getFormatter`/`fmtNum`/`compact`. | C1 / Drift 1 |
| **FF-AXIS-MONOTONIC** | For a sample scale, formatted ticks are strictly monotonic (no duplicate adjacent labels). | C1 / Drift 1 |
| **FF-WARM-COVERS-RENDER** | Per page×perspective×locale: render against a store that throws on any read ∉ warmSet → no cold read. | C2 / static-era regression |
| **FF-NO-EMPTY-REQS-FOR-READING-SPEC** | No DataSpec type that issues a store read returns `[]` from `extractRequirements` (pivot/transform covered or provably read-free). | C2 |
| **FF-ONE-MAP-ENGINE** | `panels/map/mapColorUtils` deleted; exactly one value→fill implementation (`styles/choropleth`). | C4 / Drift 2 |
| **FF-GEO-JOIN-NONEMPTY** | Given rows + geoCodeMap covering the GeoJSON ISO set, `colorByGeo` matches ≥1 feature (a total-miss = failure). | C4 / Drift 2 |
| **FF-KPI-MEAN-AGGREGATES** | `mean` KPI over a known rate series returns the arithmetic mean, not 0; falsy-baseline `cagr` diagnoses. | C5 / Drift 3 |
| **FF-COMPONENT-DECOMP** | A component-decomposition query yields ≥2 components for the seed data, or diagnoses. | C6 / Drift 4 |
| **FF-ROW-UNAMBIGUOUS** | Per-capita (measure,geo,year) resolves exactly one observation; multi-match diagnoses. | C6 / Drift 5 |
| **FF-EFFECTS-DECLARATIVE** | `onEnter`/`onExit` `set` values are literals/`ExprVal`/`null` only — no functions; retired `applyEffects`/`Effect[]` tokens stay absent. | C3 |
| (inherited) **FF-NO-MODE-LITERAL** | No `=== 'year'`/`=== 'range'` mode literal anywhere. | Law 1 (already green) |

---

## 5. OWNER-CONFIRM LEDGER (reasoned defaults; do not silently guess)

| # | Decision | DEFAULT (build this unless told otherwise) |
|---|---|---|
| **O-1** | Axis-tick style | **Compact** (`88.4K`, locale-aware); confirm `ka` abbreviation glyph. |
| **O-2** | `transform`/`pivot` warm = nested `query` reqs | Yes — fetch is the nested query; name any secondary store-hitting pipe op. |
| **O-3** | Effects: build now vs defer (`D-EFFECTS`) | **Build now** (small, closes the P5 gap, geostat wants `range→clear year, pin _T`). |
| **O-4** | Map: always value-ramp + selection overlay | **Always ramp; selection adds opacity/stroke** (both encodings live). |
| **O-5** | `mean` includes base year? | **Include all N years** (matches "average 2010–2025"); alt = exclude base (N−1). |
| **O-6** | **Component dimension for GDP expenditure/production** (highest-material) | Iterate `measure` sub-codes filtered by `approach:'EXP'`/`'PROD'`, pin geo+single-time, roll up. **Confirm the exact measure-code set / `side` dim role** — the one thing config alone can't finalize. |
| **O-7** | Per-capita 2014=483: pipeline vs seed-data | Assume **pipeline row-selection** (C6-d); if the gold value itself is 483, it's a data-ingest fix → database-architect. |

---

## 6. BOARD-ITEM MAP (each row = one work-board item)

- **BI-C1** Formatting SSOT · **BI-C2** Warm-contract guard + `FF-WARM-COVERS-RENDER` · **BI-C3** Effects recovery (`onEnter`/`onExit`) · **BI-C4** Choropleth consolidation · **BI-C5** `mean` KPI + fail-loud CAGR · **BI-C6** Component rollup + pinning + per-capita row-selection. Details = §1.
- **BI-C7** Section chart↔table dual-view (assert data warmed once at section, both `view.role` children read it) · **BI-E9** SNA `/accounts` `hbar-diverging` sequence + pivot table view (companion DELTA file).
- **BI-E1…E10** Per-element wiring against the matrix (config `kit` edits once C1–C7 land) · **BI-FF** the §4 suite, landed alongside its capability.

**Build order:** C1 → C2 → (C4 · C5 · C6 · C7 in parallel) → C3 → E# verification → FF lock. C1/C2 are prerequisites for trustworthy verification.
</content>
</invoke>
