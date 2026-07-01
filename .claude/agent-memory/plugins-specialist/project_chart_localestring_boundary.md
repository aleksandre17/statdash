---
name: chart-localestring-boundary
description: Chart config LocaleString must be resolved at the React boundary (useChartOutput) before interpretChart; jsdom can't catch ApexCharts text leaks
metadata:
  type: project
---

The LocaleString render-boundary bug CLASS extends into the chart path, and the jsdom render-guard is structurally blind to it.

**Why blind:** (1) with an empty store every `ChartShell` short-circuits to `<EmptyState/>`, so the chart body (interpretChart→toApexOptions) is never built during a page render; (2) ApexCharts draws SVG via imperative JS jsdom never executes, so axis-unit / tooltip / data-label / legend / series-name text never reaches the DOM. A bilingual `fieldConfig.unit` bakes `"123 [object Object]"` into every tooltip invisibly.

**The seam (in `packages/plugins/panels/chart/default`):**
- `utils/localeChartDef.ts` — `resolveChartDefLocale(def, ctxFieldConfig, resolve)` is THE chart render boundary. It folds the cascaded fieldConfig (`{...ctx.fieldConfig, ...def.fieldConfig}`) and resolves every bilingual ChartNode field (label, centerLabel, axes.*.unit, fieldConfig unit/noValue/threshold labels/overrides) to the active locale, producing an engine `ChartDef` (string units). `useChartOutput` calls it via `useResolveLocale()` before `interpretChart`.
- `ChartNode.ts` re-types those fields as `LocaleString` (Omit them off `ChartDef` + re-add) — the type-honesty half: passing an unresolved value where the engine wants `string` is now a compile error. Do NOT widen the shared engine `FieldConfig`/`ChartDef` (ISP — table/KPI consumers must not inherit a chart's resolve obligation).

**How config leaks reach Apex text:** `def.label`→series-name fallback (groupBySeries); `fieldConfig.unit`→`formatFieldValue` `${n} ${unit}`→ChartDataPoint.formatted→tooltip; `axes.y.unit`→yFormatter axis text; `centerLabel`→DonutChart. All 14 geostat chart nodes carried bilingual config.

**The durable guard:** `packages/plugins/__tests__/chartApexLocale.fitness.test.ts` (`// @vitest-environment jsdom` — builders touch `window.innerWidth` via `scaledPx`). Discovers every chart node from provisioning (cascading ancestor fieldConfig), runs resolve→interpret→toApex per locale, deep-scans BOTH ChartOutput (axis unit is a direct field there; in ApexOptions it hides inside a formatter closure) AND ApexOptions for raw locale bags / `[object Object]`. Has a RED-capability companion that runs the UNRESOLVED pipeline and asserts the scanner finds leaks (guards the guard). See also [[perspective-render-validation]] and the geostat `localeString-render-guard` whose page matrix is now `prov.pages[].slug`-derived.
