# Render Data-Pipe Drift Audit

> READ-ONLY audit. Scope: data → transform → encode → render pipeline vs. documented intent
> (root `CLAUDE.md` laws + `platform/packages/CLAUDE.md` + code + git). Evidence = the 6
> screenshots in `scriness/` (`img.png` … `img_5.png`), pages: Regional Accounts + GDP.
> Where an intent question turns on the render/data ADRs currently mid-move into
> `docs/architecture/decisions/`, I flag **[confirm vs consolidated ADR]**.

## One-line thesis

The pipeline's **data half is largely intact; the encode→format tail drifted**: a hand-rolled
thousands abbreviation replaced the locale formatter (SSOT break) so **axis labels lie and
disagree with their own tables**, the choropleth join/feed degrades to a **flat map**, GDP
component charts **collapse to degenerate slice/bar sets** (dimension underspecification), and
the KPI layer has **no arithmetic-mean aggregation** so "average" reuses CAGR and collapses to 0.

---

## Canonical pipeline (for reference)

```
DataSpec → interpretSpec(spec, ctx, store) → DataRow[]      (packages/core/src/data)
      ↓                                          ↓
   toApexOptions (packages/plugins/panels/chart)   DataTable / TableShell
      ↓
interpretChart → ChartOutput → buildCartesian/pie/... → <ReactApexChart/>
```

The value **geometry** (bar heights, donut arcs, slider widths) is computed from the true datum
and is correct in every screenshot. The drifts below are almost all in the **label/format** and
**encode-selection** stages *after* the numbers are right — which is exactly why they are easy to
miss: the charts look plausible until you read the axis.

---

## Ranked drifts

### DRIFT 1 — Lossy axis-tick formatter fabricates the low 3 digits (HIGH · data-pipe bug)

- **(a) Intended:** Law 4 — "the full benefit of standards, not partial." Numbers format through the
  locale strategy (`packages/core/src/i18n/format.ts` `LocaleFormatter`, which already carries a
  `scale` option) / `Intl.NumberFormat` compact notation. SSOT: one number-formatting home.
- **(b) Actual:** the default numeric-axis path in
  `packages/plugins/panels/chart/default/utils/apex/base.ts:118-128` (`yFormatter`) does, when
  `decimals` is undefined and `|val| ≥ 1000`:

  ```ts
  fmtNum(val / 1000, 0) + ' 000'
  ```

  This **rounds the tick to the nearest 1000 and hard-codes the last three digits as the literal
  string "000"**, regardless of the real remainder. It is only lossless for exact multiples of 1000.
  - `88 425.6` → `fmtNum(88.4256,0)` = `"88"` + `" 000"` = **"88 000"** (loses 425.6)
  - `4 830`    → `fmtNum(4.83,0)` = round → `"5"` + `" 000"` = **"5 000"** (reports 5000 for 4830)
  - nice-scale ticks `1500` and `2000` → both round → **"2 000" / "2 000"** (duplicate, non-monotonic)
  - `2500` and `3000` → **"3 000" / "3 000"** (duplicate)
- **(c) Symptom:** broken / duplicated / magnitude-wrong y- and x-axis tick labels.
  - `img_5` bottom hbar x-axis: `… 2 000, 2 000, 3 000, 3 000, 5 000, 5 000, 6 000, 6 000, 7 000` — the
    tell-tale duplicated ticks (fine ApexCharts intervals collapsed to the nearest thousand).
  - `img_1` bottom hbar x-axis and `img_2` / `img_3` y-axes show the same collapsed/duplicated ticks.
  - Bar **end-labels** ("42 982.6" in `img_1`, "104 598.1" in `img_2`) are CORRECT because the
    dataLabels path (`cartesian.ts:207`) passes `decimals ?? 1` and hits the clean `fmtNum(val,dec)`
    branch. Only the **axis ticks** (cartesian.ts:98,177 via `yFmt = yFormatter(unit, undefined)`) are wrong.
- **(d) Root cause:** `yFormatter` in `base.ts` — a hand-rolled abbreviation that (i) bypasses the
  locale `LocaleFormatter`/`Intl` SSOT (Law 4 partial-standard + SSOT violation), and (ii) is lossy
  by construction. The correct fix is `Intl.NumberFormat(locale,{notation:'compact'})` or the existing
  `formatterRegistry` with a real `scale`, not a string suffix. Note also **table↔chart disagreement**:
  the table renders the same datum through the real field formatter (`fmtNum(v, decimals)` →
  "88 425.6") while the chart axis says "88 000" — a direct Law-4 / least-astonishment break.
- **(e) Severity/blast:** HIGH. Fires on **every** numeric axis whose `axes.y.decimals` is undefined
  (all the level/currency charts on both pages). Single-function fix, wide blast radius.

### DRIFT 2 — Choropleth renders flat instead of shaded-by-value (HIGH · design regression)

- **(a) Intended:** commit `f8d8204` "fix(color): geograph choropleth shades by value"; GeoMap's own
  comment (`GeoMap.tsx:116-118`): "This is the choropleth encoding — without it every region paints
  the same accent and the map reads flat." A choropleth encodes value → fill (sequential ramp).
- **(b) Actual:** the map paints a **single uniform accent blue** for all regions (no ramp).
  `GeoMap.tsx:120-126` builds `colorByGeo` keyed by `String(r.id)`; `colorFor(geoId)` looks it up by
  `geoId = geoCodeMap[iso]` (the GeoJSON feature ISO → code map, line 155/206). When that key does not
  equal `row.id` (or `rows` hasn't warmed at paint time), **every** `colorByGeo.get(geoId)` misses and
  falls back to `fillColor()` = flat `--color-accent`. The ramp itself (`sequentialRamp` /
  `quantileColors`, `packages/styles/src/utils/choropleth.ts`) is correct and index-aligned — the
  failure is the **join key / feed**, not the color math.
- **(c) Symptom:** `img_1` (regional levels, all regions) — the whole Georgia map is one flat blue, no
  light→dark gradient, even though the adjacent table has all 10 regional values. (`img_5` shows 2 dark
  regions but that is the *selection* highlight via `fillOpacity` on a 2-region filter, not the value
  ramp — consistent, not a bug.)
- **(d) Root cause hypothesis:** ISO-to-dim-code join mismatch in `GeoMap.tsx` (`geoCodeMap[iso]` vs
  `row.id`), or `rows` empty at first paint (async warm) with no re-color. Confirm by logging
  `colorByGeo` vs the feature ISO set. Secondary smell: **two independent choropleth engines** exist —
  `packages/plugins/panels/map/default/mapColorUtils.ts` (`buildColorScale`, quantile/linear/threshold)
  and `packages/plugins/nodes/geograph/.../GeoMap.tsx` (`quantileColors`). SSOT violation; see
  `work/DESIGN-map-consolidation.md`. **[confirm vs consolidated ADR]** which is canonical.
- **(e) Severity/blast:** HIGH for the regional page's headline visual; contained to the geograph map node.

### DRIFT 3 — "Average real growth" KPI collapses to 0.0% (MEDIUM-HIGH · derivation + design gap)

- **(a) Intended:** the KPI is labelled "საშუალო რეალური ზრდა" (average real growth); the real-growth
  series on the same page averages ≈ +4–6%/yr.
- **(b) Actual:** `img_3` shows **0.0%** ("→0%") while the real-growth bar series right below reads
  0, +7.9, +6.6, … −6.3, … +7.5. The nominal "average annual growth" beside it (10.9%) is fine.
- **(c) Symptom:** a headline KPI reads 0.0% average real growth — clearly wrong; `img_3` (and `img_4`).
- **(d) Root cause:** `packages/core/src/data/kpi.ts` has **no arithmetic-mean aggregation** — value
  types are `point | yoy | cagr | share | expr | metric`. To show an "average," the config reuses
  `cagr`, whose guard is `vFrom && to > from ? … : 0` (kpi.ts:163). For a **rate/growth measure** the
  2010 baseline value is `0` → `vFrom` is falsy → returns **0**. Two intertwined faults: (i) CAGR is a
  *level* operator applied to a *rate* series (wrong tool), and (ii) the falsy-baseline guard silently
  yields 0 instead of failing loud (Law 6 root-cause / fail-fast). Real fix = a first-class `mean`/
  `avg` reduction over a series (new KpiValueSpec discriminant — Law 8 platform capability), then bind
  the KPI to it. **[confirm vs consolidated ADR]** whether an averaging metric is already specced.
- **(e) Severity/blast:** MEDIUM-HIGH (a wrong published statistic). Contained to KPI spec + kpi.ts.

### DRIFT 4 — GDP component decomposition renders degenerate (MEDIUM · data-pipe aggregation drift)

- **(a) Intended:** "GDP by expenditure method" and "GDP by production method" decompose GDP across a
  *component* dimension (final consumption / GCF / net exports; agriculture / industry / services …) —
  Tidy-Data + Grammar-of-Graphics adopted whole (Law 4).
- **(b) Actual:**
  - `img_2` "GDP by expenditure method" bar chart shows only **two bars** (88 425.6 and 104 598.1) —
    not a component breakdown.
  - `img_2` "GDP by production method" donut collapses to ~4 slices dominated by one cyan wedge —
    most sector slices absent/merged.
- **(c) Symptom:** charts that should show N components show 2 bars / a near-single-slice donut. `img_2`.
- **(d) Root cause hypothesis:** panels pin only *measure + time*; the obs route does no aggregation and
  returns raw `dim_key @>` rows, so the unpinned **component dimension is neither pinned nor rolled up**
  → whatever rows exist render, not a clean decomposition. Matches the standing note
  (agent-memory: *GDP Page Dim Underspecification* — obs route does no aggregation; a 4-dim GDP needs
  approach/geo pinned in every panel query). Trace: `interpretSpec` → the query DataSpec for these
  panels + the obs endpoint aggregation. **[confirm vs consolidated ADR]** on the intended long-format
  component contract.
- **(e) Severity/blast:** MEDIUM (headline GDP-page charts misrepresent structure); spans config query
  specs + the obs read path.

### DRIFT 5 — Per-capita 2014 value garbled ("483") (MEDIUM/LOW · data-pipe row-selection)

- **(a) Intended:** GDP per capita is a smooth ~$3,281 (2010) → ~$10,297 (2025) series.
- **(b) Actual:** `img_4` per-capita table row **2014 = "483"**, wedged between 4 712 (2013) and
  4 085 (2015) — ~10× too small. This is **not** the Drift-1 formatter (the table uses the real field
  formatter; `fmtNum(4831,0)` → "4 831", never "483"), so it is a **resolved-value** fault.
- **(c) Symptom:** one impossible per-capita cell. `img_4`.
- **(d) Root cause hypothesis:** the pipeline resolved a wrong/partial row for that period (component or
  unit-scale mismatch in the obs read / `storeVal`), same underspecification family as Drift 4. Trace
  the per-capita measure's `interpretSpec` row selection for 2014.
- **(e) Severity/blast:** MEDIUM data-integrity (one visible wrong figure), LOW confidence on exact cause.

---

## Investigated & NOT a drift

- **`img_5` "მთლიანი … 9 686"** with "12.0% of national" while only Imereti + Shida Kartli show:
  this is a **2-region filtered** state (6 270.6 + 3 414.9 = 9 685.5 ≈ 9 686; 9 686 / 80 979 = 12.0%).
  Internally consistent — the label reads "total" of the *current selection*, expected filter behaviour.
- **Bar/donut/slider geometry** across all shots: proportional to the true datum. The value math is sound;
  the drift is in the *labelling/encode-selection* layers on top.

---

## Top 5 drifts (summary)

| # | Drift | Screenshot | Kind | Root module |
|---|-------|-----------|------|-------------|
| 1 | Axis formatter fabricates "000" / rounds ticks (labels ≠ table) | img_1,2,3,5 | **data-pipe bug** | `plugins/panels/chart/default/utils/apex/base.ts` `yFormatter` |
| 2 | Choropleth paints flat, not shaded-by-value | img_1 | **design regression** | `plugins/nodes/geograph/default/components/GeoMap.tsx` (join key/feed) |
| 3 | "Average real growth" KPI = 0.0% | img_3 | **design gap + derivation bug** | `core/src/data/kpi.ts` (no mean; CAGR-of-rate + falsy-baseline guard) |
| 4 | GDP component charts degenerate (2 bars / 1-slice donut) | img_2 | **data-pipe (aggregation) drift** | obs read path + panel query specs (dim underspecification) |
| 5 | Per-capita 2014 = "483" (10× low) | img_4 | **data-pipe (row-selection) drift** | `interpretSpec`/`storeVal` per-capita read |

**Bug vs regression:** #1, #4, #5 are data-pipe bugs (format / aggregation / selection). #2 is a
design-intent regression (a shipped choropleth encoding no longer paints). #3 is both — a missing
capability (mean aggregation) papered over by misusing CAGR, which then hits a silent-zero guard.

**Cross-cutting architectural note:** #1 and #3 share a shape — the *engine has the right primitive*
(`LocaleFormatter` with `scale`; the metric/kpi registry) but the *plugin/config layer routed around
it* with a lossy local hack. That is the pattern to watch: the render tail re-implementing, and
degrading, what the core already owns (SSOT erosion, Law 4/6). Fix each at the seam, not the symptom.
