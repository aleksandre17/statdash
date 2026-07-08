# SPEC — Cartesian ApexOptions builder decomposition (AR-45)

> Status: **DESIGNED** (2026-07-07, architect). Analysis + plan only — no source touched.
> Scope: `packages/plugins/panels/chart/default/utils/apex/cartesian.ts` (397 lines, at the 400-line hard ceiling).
> Trigger: post-edit bloat gate now blocks routine edits (a 3-line change had to trim comments). Owner approved the highest-standard structural fix.
> Constraint: **pure structural refactor, Strangler-Fig, tests green after every step. No behavior change.**

---

## 1. What is fused into `cartesian.ts` today (the God-function)

`buildCartesian(output, fontFamily?, locale?): ApexOptions` builds ApexCharts options for **six chart families** — `bar · hbar · line · area · waterfall · combo` — plus every option slice, all in one 397-line function. Responsibilities currently fused:

| # | Concern | Lines (approx) | Family-conditional inside it? |
|---|---------|----------------|-------------------------------|
| 1 | Orientation + semantic→visual axis-hidden mapping (`apexXHidden/apexYHidden`) | 19–25 | horizontal |
| 2 | Value-axis formatters (`yFmt/y2Fmt`) | 27–31 | hasY2 |
| 3 | Responsive y-axis font closure (`yaxisFont`, re-carries formatter) | 33–45 | horizontal/hasY2/hidden |
| 4 | Stacked-area max (`stackedMax/yMax`) | 47–52 | isStackedArea |
| 5 | Series assembly (extended points, combo `yAxisIndex`, waterfall spacer) | 54–86 | isCombo/isWaterfall |
| 6 | Colors (distributed / seriesColorByIndex / explicit + spacer) | 88–108 | spacer |
| 7 | Value axis build (`yAxisBase` + y2) | 110–149 | horizontal/type/hasY2 |
| 8 | Bar sizing (`barFill`) | 151–158 | horizontal |
| 9 | Chart-type mapping (`apexType`) | 160–166 | combo/waterfall/hbar |
| 10 | Data-labels enable rule (`showDataLabels`) | 168–172 | type/stacked |
| 11 | hbar value-axis headroom (`hbarValueMax`) | 174–176 | horizontal |
| 12 | Options assembly: chart · grid · series · colors · xaxis · yaxis · plotOptions · dataLabels · fill · stroke · markers · legend · tooltip · annotations | 178–314 | ~every slice |
| 13 | Responsive[] breakpoint array (BP_MD/SM/XS) | 315–395 | ~every slice |

**The real smell is divergent change + shotgun surgery:** the six families are NOT independent — they share ONE cartesian skeleton and differ by small per-family encodings scattered as `isWaterfall / isCombo / isStackedArea / type === 'area'||'line'` checks sprinkled through series, colors, fill, stroke, dataLabels, tooltip and every responsive breakpoint. Adding a family today means touching ~8 places. That is exactly the anti-OCP shape the owner named.

`base.ts` (349 lines, healthy) is already the correct shared-helper home (BASE, `yFormatter`, `responsiveYAxis`, bar-fill cap math, `hbarValueAxisMax`, breakpoints). It is NOT part of this split — the new modules consume it unchanged. Siblings `pie.ts / contribution.ts / hbar-diverging.ts / treemap.ts` are separate builders, out of scope.

---

## 2. Pattern selection (with the trade-off named)

Three tenable designs were weighed:

- **(A) Pure per-family Strategy** — one `buildBar/buildLine/buildArea/buildWaterfall/buildCombo` each returning full options. **REJECTED:** the families share ~70% skeleton (grid, category axis, legend, markers, tooltip, responsive frame); pure-strategy duplicates it 6× → DRY violation + divergent change simply moves, not dies.
- **(B) Pure slice pipeline, family-conditionals inline** — extract `buildSeries/buildAxes/buildGrid/...` as pure units but leave `type===` checks inside each. Kills the 400-line bloat and makes each slice testable, but adding a family is STILL shotgun surgery across slice files → doesn't win OCP.
- **(C) Slice pipeline + resolved family descriptor (chosen).** A **Pipe-and-Filter / Builder** of pure slice-builders, each `(output, ctx) → <ApexSubObject>`, composed by a thin assembler; the per-family variation is **lifted out of the slices into a `FAMILY_TRAITS` descriptor** and **resolved once into discriminated enums on a `CartesianContext`** (`fillMode / strokeMode / seriesMode / apexType`). Slice-builders then `switch(ctx.fillMode)` — never `type === 'waterfall'`. This is *replace-scattered-conditional-with-a-resolved-discriminant*.

**Trade-off (ISO 25010):** buy **modifiability + testability + analysability** (a family becomes data; a slice becomes a pure unit) at the cost of a small **indirection** (one descriptor + one context hop) and more files. For a 6-family, 397-line God-function this is squarely worth it, and it matches this codebase's registry culture.

**Why a static `Record<CartesianFamily, FamilyTraits>`, not a runtime `register()` registry:** the cartesian sub-families are a **closed, engine-owned set** (defined in `@statdash/charts`); the OCP unit is "an engine dev adds a family," which a compiler-exhaustive `Record` enforces at build time. A runtime registry (the `registerSpec`/plugin-registry idiom) is for **open, plugin-extensible** sets (DataSpec kinds, panel types) — using it here would be speculative generality / Golden-Hammer (YAGNI). The top-level family switch (`toApexOptions`) stays the one dispatch point.

---

## 3. Target module layout (`.../utils/apex/cartesian/`)

Promote `cartesian.ts` → a directory. `index.ts` keeps the public import path byte-identical (`./apex/cartesian` and `./cartesian` both resolve to the directory index — the seam does not move).

| Module | One-concern responsibility | Public seam |
|--------|----------------------------|-------------|
| `index.ts` | Barrel — preserves the `./cartesian` seam. | `export { buildCartesian } from './build'` |
| `build.ts` | **Assembler** — derive context once, compose the slice-builders into the final `ApexOptions` literal. The only file that assembles. (~60 lines) | `buildCartesian(output, fontFamily?, locale?): ApexOptions` |
| `context.ts` | **Information expert** — pre-resolve all cross-cutting scalars/flags ONCE: orientation, `apexXHidden/Y`, `yFmt/y2Fmt`, `showDataLabels`, `stackedMax/yMax`, `barFill`, `hbarValueMax`, and the resolved discriminants `apexType/fillMode/strokeMode/seriesMode/showMarkers`. | `interface CartesianContext`; `deriveContext(output, fontFamily?, locale?): CartesianContext` |
| `families.ts` | **OCP seam** — `CartesianFamily` union + `FAMILY_TRAITS: Record<CartesianFamily, FamilyTraits>` (pure type-facts: `apexType`, `forcesStacked`, `dataLabelsByDefault`, `seriesMode`, base `fill/stroke` mode). `familyOf(type)`. Also owns the `SPACER` sentinel const + `isSpacer(s)` (kills the repeated `'__spacer__'` magic-string, ~5 sites). | `type CartesianFamily`; `interface FamilyTraits`; `FAMILY_TRAITS`; `familyOf`; `SPACER`, `isSpacer` |
| `series.ts` | Series assembly — extended `{x,y,fillColor?}` points; `ctx.seriesMode` arms combo (`type`+`yAxisIndex`) / waterfall (spacer) / plain. | `buildSeries(output, ctx): ApexAxisChartSeries` |
| `colors.ts` | Color resolution — distributed / seriesColorByIndex / explicit; spacer→transparent. Reads `output` flags (not a family trait). | `buildColors(output): string[]` |
| `axes.ts` | Value axis + category axis (the orientation-mirrored pair): `yaxis` (hbar categorical vs vbar numeric, y2 opposite, stacked-area max/forceNiceScale) and `xaxis` (hbar value-scale vs vbar category, rotate/trim/maxHeight, border/ticks, hidden). | `buildValueAxis(output, ctx): ApexYAxis \| ApexYAxis[]`; `buildCategoryAxis(output, ctx): ApexXAxis` |
| `marks.ts` | How the mark draws — `plotOptions.bar` + `fill` + `stroke` + `markers`, all switched on `ctx.fillMode/strokeMode/showMarkers` (tightly coupled by the same family logic → one cohesive slice). | `buildBarPlotOptions(output, ctx)`; `buildMarks(output, ctx): { fill; stroke; markers }` |
| `data-labels.ts` | `dataLabels` — enabled, formatter, offsets, per-series waterfall colors. | `buildDataLabels(output, ctx): ApexDataLabels` |
| `grid.ts` | `grid` — axis-hidden gridline drop + `padding` (owns the `gridPadding(ctx, bp)` helper reused by `responsive.ts`, so padding math lives once — SSOT). | `buildGrid(output, ctx): ApexGrid`; `gridPadding(ctx, tier): object` |
| `chrome.ts` | Small chrome slices — `legend` + `tooltip` + `annotations`. | `buildLegend(output, fontFamily?)`; `buildTooltip(output, ctx, formatted)`; `buildAnnotations(ctx): ApexAnnotations` |
| `responsive.ts` | The full `responsive[]` breakpoint array + the `yaxisFont` formatter-re-carry closure (consumes `ctx`, reuses `grid.gridPadding`). | `buildResponsive(output, ctx): ApexResponsive[]` |

**Slice-builder contract (standard):** each returns its OWN precisely-typed sub-object (not a `Partial<ApexOptions>` blob) — `buildColors → string[]`, `buildValueAxis → ApexYAxis|ApexYAxis[]`, etc. `build.ts` assembles them into the options literal. This keeps types tight (make-illegal-states-unrepresentable) and the assembler flat.

Result: 12 modules, each < ~90 lines (most < 40), `build.ts` a flat assembler. All comfortably under the 200-line soft / 400-line hard ceiling, with real headroom for future edits.

> **Judgment flag:** 12 files is proportionate to a 397-line, 6-family God-function and matches the folder's existing one-builder-per-file convention. If the owner prefers fewer files, `chrome.ts`+`grid.ts` can merge, and `families.ts` can fold into `context.ts` — but the descriptor-as-its-own-module is recommended for the OCP clarity the owner asked for.

---

## 4. Migration order (Strangler-Fig — full suite green after EACH step)

Test net is strong: **5 test files call `buildCartesian`** end-to-end (`axis-hidden`, `axis-formatter`, `low-cardinality`, `chart-fill`, `theme-chrome.fitness`, `redraw-parent-resize.fitness`) plus `base.ts` unit tests. Every extraction is a behavior-preserving *extract-function* on a green bar. Gate per step: `cd platform/apps/geostat && tsc -b` (baseline ~293 pre-existing errors, no NEW errors) + `vitest` (571/571) + `check-laws` + `lint`.

| Step | Action | Green net |
|------|--------|-----------|
| 0 | Record baseline green (apex tests + full plugins vitest). | snapshot |
| 1 | Create `cartesian/` dir; move the function verbatim into `cartesian/build.ts`; add `index.ts` barrel; delete flat `cartesian.ts`. Import paths resolve unchanged. | all |
| 2 | Extract `context.ts` (`deriveContext` — all derived scalars/flags). `build.ts` destructures `ctx`. | all |
| 3 | Extract `families.ts` (`CartesianFamily` + `FAMILY_TRAITS` + `SPACER/isSpacer`); route `apexType/seriesMode/forcesStacked/dataLabelsByDefault` + resolved `fillMode/strokeMode` through `context.ts` reading traits. Replace inline `'__spacer__'` with `isSpacer`. | all |
| 4 | Extract `series.ts` + `colors.ts`. | low-cardinality asserts `opts.colors` |
| 5 | Extract `axes.ts` (value + category). | axis-hidden + axis-formatter |
| 6 | Extract `marks.ts` (plotOptions + fill/stroke/markers) + `data-labels.ts`. | chart-fill |
| 7 | Extract `grid.ts` + `chrome.ts` (legend/tooltip/annotations). | all |
| 8 | Extract `responsive.ts` (breakpoint array + `yaxisFont`, reusing `gridPadding`). Biggest line win. | axis-formatter (responsive re-carry) |
| 9 | `build.ts` is now a thin assembler. Confirm every module < 200 lines; add the fitness function (§6). Final green. | all |

Steps are independently landable/commit-able (one behavior-preserving step per commit). If interrupted, the tree is green at any boundary.

---

## 5. The OCP win — how a future chart family plugs in

To add e.g. `scatter` / `lollipop` / `range-bar`:
1. Add the member to the `CartesianFamily` union.
2. Add ONE `FAMILY_TRAITS.<family> = { apexType, seriesMode, fillMode, strokeMode, ... }` entry — the compiler **forces** the entry (exhaustive `Record`), so you cannot forget it.
3. Only if it needs a genuinely new render behavior, add ONE new enum arm in the single relevant slice (`marks.ts` / `series.ts`).

The assembler, every other slice, the context, and the `toApexOptions` dispatcher stay **untouched**. No switch grows anywhere. That is the OCP mandate satisfied: *new family = new descriptor entry (data), interface unchanged.*

---

## 6. Risks / edges + how the design handles each

1. **Theme-version rebuild (cssVar read at build time).** ApexCharts chrome reads tokens via `cssVar` at build time and re-renders on `useThemeVersion` remount (AR-14). Every slice must call `cssVar(...)` **inside** its function body — never hoist a color to module scope (that would freeze the theme). Regression net: `theme-chrome.fitness.test.ts` (both-modes-differ) runs each step. **Flag: no color literals at module scope in any new file.**
2. **Responsive formatter re-carry.** ApexCharts rebuilds `yaxis` from defaults on responsive merge, dropping any formatter not re-supplied (`responsiveYAxis` in base). `responsive.ts` must keep the `yaxisFont` closure over `ctx.yFmt/ctx.y2Fmt` + `apexYHidden/horizontal/hasY2` — identical logic, relocated. Locked by `axis-formatter.test.ts`.
3. **Combo per-series arrays.** `stroke.width`, series `type`, and `colors` are per-series arrays whose order must match `output.series`. `buildSeries`, `buildColors`, `buildMarks` each map `output.series` **directly, in order, never re-sorted** → lengths/indices stay aligned. Stated as an invariant in each file header.
4. **Waterfall spacer sentinel.** `'__spacer__'` is a cross-slice magic-string (series, colors, dataLabels colors, fill opacity, stroke — ~5 sites). Centralized as `SPACER` const + `isSpacer(s)` in `families.ts` (SSOT; magic-string smell removed). Behavior-identical.
5. **Axis-hidden mapping SSOT.** `apexXHidden/apexYHidden` computed ONCE in `context.ts`, consumed by `axes.ts` + `grid.ts` → no drift between the hidden-axis label/border/tick drop and the gridline drop. Locked by `axis-hidden.test.ts`.
6. **Stacked-area `yMax` coupling.** The annotation dashed line and `yaxis.max` both read `ctx.yMax` (one source in context). `chart-fill` + `low-cardinality` cover it.
7. **`fillMode/strokeMode` are runtime-resolved, not pure family facts.** `area` vs `stacked-area` differ by `output.stacked` — so `context.ts` resolves the *effective* enum (family baseline × `stacked`), and `families.ts` holds only the purely type-determined facts. Slices switch on the resolved enum only.

**New fitness function (Step 9):** `cartesian-decomposition.fitness.test.ts` — asserts (a) `FAMILY_TRAITS` is exhaustive over `CartesianFamily` (compile-time already, plus a runtime key-count guard), (b) no `type ===` / `isWaterfall`-style family literal appears in any slice file except `families.ts`/`context.ts` (structural scan — keeps the resolved-discriminant discipline from eroding), (c) no `cssVar` call at module scope (theme-freeze guard), (d) each `cartesian/*.ts` < 200 lines.

---

## 7. Scope honesty

- **Size:** as big as it looks (~397 lines → 12 modules) but **low-risk** — the whole surface is covered by 6 test files that drive `buildCartesian` end-to-end, every step is mechanical, and the public seam never moves.
- **Consumer coupling:** none complicates the seam. The ONLY production consumer is `toApexOptions.ts`; the 6 test files import `buildCartesian` from `./cartesian` — all preserved by the directory `index.ts`. Verified: `packages/charts/src/interpreters/cartesian` is a *different* (engine-side) module and is unaffected.
- **Not in scope (YAGNI, flagged for later):** `contribution.ts` and `hbar-diverging.ts` are near-cartesian bar builders that duplicate the extracted `colors/chrome/responsive` skeleton. Once these slices exist, a follow-on DRY pass could have them consume the shared slices — a real second-consumer win, but a **separate** initiative, not this refactor.
