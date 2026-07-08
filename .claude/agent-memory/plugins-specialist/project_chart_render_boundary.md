---
name: chart-render-boundary
description: Chart config text (locale bags + {token} interpolation) must resolve at the useChartOutput boundary before interpretChart — jsdom can't catch ApexCharts text leaks, and the resolver evolved from locale-only to the full template seam
metadata:
  type: project
---

`packages/plugins/panels/chart/default/useChartOutput.ts` is THE chart render
boundary — every chart display-text field must be resolved there, before
`interpretChart`, because nothing downstream can catch a leak.

**Why jsdom is structurally blind to text leaks:** (1) with an empty store every
`ChartShell` short-circuits to `<EmptyState/>`, so the chart body
(interpretChart→toApexOptions) is never built during a page render; (2) ApexCharts
draws SVG via imperative JS — jsdom never executes it, so axis-unit/tooltip/data-label/
legend/series-name text never reaches the DOM. A bilingual `fieldConfig.unit` bakes
`"123 [object Object]"` into every tooltip invisibly, and a `{token}` bakes the raw
`{fromYear}` into a series name, with zero DOM signal either way.

**The seam, in two layers:**
1. **Locale resolution** — `utils/localeChartDef.ts`:
   `resolveChartDefLocale(def, ctxFieldConfig, resolve)` folds the cascaded
   fieldConfig (`{...ctx.fieldConfig, ...def.fieldConfig}`) and resolves every
   bilingual `ChartNode` field (label, centerLabel, axes.*.unit, fieldConfig
   unit/noValue/threshold labels/overrides) to the active locale, producing an engine
   `ChartDef` (string units). `ChartNode.ts` re-types those fields as `LocaleString`
   (Omit off `ChartDef` + re-add) — passing an unresolved value where the engine wants
   `string` is now a compile error. Do NOT widen the shared engine
   `FieldConfig`/`ChartDef` (ISP — table/KPI consumers must not inherit a chart's
   resolve obligation).
2. **Template interpolation** — the `resolve` fn passed into
   `resolveChartDefLocale` is `resolveNodeTemplate(tpl, sectionCtx,
   {...filterParams, ...vars})` (canonical `resolveTemplate` seam: locale/perspective
   collapse AND `{key}` expansion over `{...ctx.filterParams, ...ctx.vars}` then
   `ctx.dims`) — the SAME seam every other display string uses (e.g. SectionShell's
   `useNodeTemplate`). It was previously `useResolveLocale()` (locale-ONLY), which left
   labels like `"…დინამიკა, {fromYear}–{toYear}"` un-expanded on the series-name/
   tooltip path (a bar chart's `def.label` becomes the ApexCharts series name) — fixed
   admin B1/B2 (2026-07-06). `resolveTemplate` is a no-op for strings with no `{`, so
   it's byte-identical for plain text; keep the resolve call INSIDE the `useMemo` (pure,
   deps stay on inputs not an unstable closure).

**How config leaks reach Apex text:** `def.label`→series-name fallback
(groupBySeries); `fieldConfig.unit`→`formatFieldValue` `${n} ${unit}`→
ChartDataPoint.formatted→tooltip; `axes.y.unit`→yFormatter axis text;
`centerLabel`→DonutChart. All 14 geostat chart nodes carried bilingual config; any new
chart text field that can carry a `{token}` (label, centerLabel, axis unit) is already
covered — `resolveChartDefLocale` runs `resolve()` over all of them.

**Durable guards:**
- `packages/plugins/__tests__/chartApexLocale.fitness.test.ts`
  (`// @vitest-environment jsdom` — builders touch `window.innerWidth` via
  `scaledPx`). Discovers every chart node from provisioning (cascading ancestor
  fieldConfig), runs resolve→interpret→toApex per locale, deep-scans BOTH
  ChartOutput and ApexOptions for raw locale bags / `[object Object]`. Has a RED
  capability companion that runs the UNRESOLVED pipeline and asserts the scanner
  finds leaks (guards the guard).
- `packages/plugins/__tests__/chartTemplateInterp.fitness.test.ts` — every shipped
  `{token}`-bearing chart × locale → no un-expanded `{token}` in ChartOutput, + RED
  companion.

Related: [[feedback_merged_vs_defview_label]], [[project_apex_chart_theme_seam]]
(same panel, different seam — theme color + responsive formatter, not text
resolution).
