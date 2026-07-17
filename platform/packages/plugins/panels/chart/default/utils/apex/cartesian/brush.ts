// ── Range-slider brush companion (ChartDef.rangeSlider realization) ────────
//
//  The reviewer asked for a dataZoom/navigator strip under the long time-dynamics
//  charts (a real range slider, not just toolbar zoom). ApexCharts realizes this
//  as a BRUSH chart: a slim second instance whose drag-selection drives the main
//  chart's visible x-window (chart.brush.target + chart.selection). This module
//  owns that realization — the ONLY place that knows a "range slider" is an Apex
//  brush; the neutral ChartOutput carries just the boolean intent (Law 1/4).
//
//  Why a companion and not native chart.zoom: native x-zoom is a drag-on-the-plot
//  + toolbar gesture with no PERSISTENT strip — the reviewer's screenshot is a
//  standing navigator rail. The brush companion is that rail.
//
//  Honest degrade (the canvas never lies): the strip renders ONLY for a vertical
//  cartesian series long enough to warrant windowing (shouldRenderSlider). A
//  horizontal bar (categories run down the fixed height) and a short series get
//  NO strip — an affordance that could not navigate is never drawn.
//

import ApexCharts from 'apexcharts'
import type { ApexOptions } from 'apexcharts'
import type { ChartOutput } from '@statdash/charts'
import { cssVar } from '@statdash/styles'
import { BASE } from '../base'

// ── ESM global-seam bootstrap (module side-effect, ONCE for the bundle) ────
//
//  Two apexcharts@3.54.1 defects surface the moment a brush pairing renders in
//  a Vite ESM bundle (live-verified on the geostat prod bundle, 2026-07-16 —
//  the three blank rangeSlider cards). Both are neutralized HERE, at the one
//  module that owns the brush realization — never per chart:
//
//  (1) `ReferenceError: ApexCharts is not defined` — the brush link is written
//      against the UMD global, not the ESM export: `setupBrushHandler` resolves
//      `chart.brush.target` via the BARE identifier `ApexCharts.getChartByID`
//      (src/modules/Core.js:571,586). No such global exists in an ESM bundle,
//      so the brush chart's render() rejects. Publishing the imported class is
//      sound because it is the SAME module instance react-apexcharts renders
//      with — the registry getChartByID reads is the one our charts fill.
//
//  (2) `RangeError: Maximum call stack size exceeded` on every chart mounted
//      AFTER an id-carrying chart — the id-registration poison. `render()`
//      registers any chart declaring `chart.id` into `Apex._chartInstances`
//      (apexcharts.js:53-62), where `Apex` is `window.Apex` — the SAME object
//      apex treats as the user's global-options cascade and deep-merges into
//      every subsequent chart's config (settings/Config.js:105
//      `Utils.extend(newDefaults, window.Apex)`). The registry rides into that
//      merged config, and the new chart's `initialConfig` deep-clone then walks
//      a live chart INSTANCE (cyclic `ctx`) until the stack dies. Pre-creating
//      the registry NON-ENUMERABLE keeps it fully functional (registration
//      pushes to it, getChartByID reads it directly) while the Object.keys/
//      Object.assign-based merge+clone no longer see it — the poisoning
//      mechanism itself is disarmed, not its symptoms. (Strategic fix: an
//      apexcharts upgrade that moves the registry off `window.Apex`.)
declare global {
  interface Window {
    ApexCharts?: typeof ApexCharts
    Apex?: Record<string, unknown>
  }
}
if (typeof window !== 'undefined') {
  const apexGlobal = (window.Apex ??= {})
  if (!Object.getOwnPropertyDescriptor(apexGlobal, '_chartInstances')) {
    Object.defineProperty(apexGlobal, '_chartInstances', {
      value: [], writable: true, enumerable: false, configurable: true,
    })
  }
  window.ApexCharts ??= ApexCharts
}

const SPACER = '__spacer__'

/** Height (px) of the slim brush rail under the main plot. 64 = a ~34px
 *  grabbable strip + the year-label row (Highcharts navigator norm). Only
 *  possible in SPARKLINE mode: apex otherwise reserves a ~20-30px top offset
 *  (gridPadFortitleSubtitle) + a hard "-15" in gridHeight, which at 96 left a
 *  tall dead band above the strip and below 96 collapsed the plot to nothing
 *  (the selection window + grips never drew — e2e-proven at 64/68/72). The
 *  MAIN plot reclaims the freed height via its flex:1 sibling (owner,
 *  2026-07-17: „სლაიდერის გამო სივრცე რჩება სიმაღლეში"). */
export const SLIDER_HEIGHT = 64

/**
 * Minimum category count before a range slider earns its chrome. A slider under
 * a handful of bars adds a rail with nothing to window — honest floor: only a
 * genuinely long series (≈ a decade of years) gets the navigator.
 */
export const SLIDER_MIN_CATEGORIES = 8

/**
 * Whether a range-slider brush strip should render for this output.
 *
 * Gate (all required): the intent is declared (`rangeSlider`), the mark is a
 * VERTICAL cartesian (a bottom x-slider is meaningless under a horizontal bar,
 * whose categories run down the height), and there are enough categories to
 * window. Absent any of these → no strip, main chart renders unchanged.
 */
export function shouldRenderSlider(output: ChartOutput): boolean {
  return output.rangeSlider === true
    && !output.horizontal
    && output.categories.length >= SLIDER_MIN_CATEGORIES
}

/**
 * Sanitize a React `useId()` value (contains `:`) into an ApexCharts-safe chart
 * id. Apex keys its global instance registry AND some DOM nodes by this id, so a
 * bare `:r0:` risks a broken selector — strip to alphanumerics.
 */
export function sliderChartId(uid: string, role: 'main' | 'brush'): string {
  return `chart-${role}-${uid.replace(/[^a-zA-Z0-9]/g, '')}`
}

/**
 * One representative navigator shape: the per-category SUM of the (non-spacer)
 * series. A single-series chart reflects itself; a stacked/multi-series chart
 * shows its overall trend as one muted area, so the rail reads as "the shape of
 * the whole series" rather than a cramped mini-stack.
 */
export function navSeriesData(output: ChartOutput): number[] {
  const { categories, series } = output
  return categories.map((_, ci) =>
    series.reduce((sum, s) => sum + (s.name === SPACER ? 0 : (s.data[ci]?.value ?? 0)), 0))
}

/**
 * Build the slim brush companion's ApexOptions. Its selection drives the main
 * chart (`brush.target = mainId`); the default selection is the FULL range, so
 * first paint hides nothing (the handles sit at both ends — Least Astonishment)
 * and the viewer narrows from there. Category x-axis → numeric index domain.
 */
export function buildBrushOptions(
  output: ChartOutput,
  opts: { mainId: string; brushId: string; fontFamily?: string },
): ApexOptions {
  const { categories } = output
  const n      = categories.length
  // Match the sequential ramp anchor the main dynamics charts paint (--chart-seq-5),
  // so the navigator reads as a muted echo of the same series, not a foreign hue.
  const accent = cssVar('--chart-seq-5', '#0080be')
  const muted  = cssVar('--color-text-muted', '#6B7B8D')

  return {
    ...BASE,
    chart: {
      ...BASE.chart,
      id:         opts.brushId,
      type:       'area',
      height:     SLIDER_HEIGHT,
      fontFamily: opts.fontFamily ?? 'system-ui, sans-serif',
      toolbar:    { show: false },
      // The navigator link: this rail's drag-selection sets the target's x-window.
      // NOTE: apex's own brush() defaults drive the nav (toolbar.autoSelected
      // 'selection' + zoom disabled) — never override zoom here; an explicit
      // value beats the brush defaults and kills the selection mode.
      brush:      { enabled: true, target: opts.mainId, autoScaleYaxis: true },
      // SPARKLINE mode = apex's own navigator-strip geometry: kills the
      // title/subtitle top offset and the -15 gridHeight constant, so the
      // strip fills the band edge-to-edge. It only writes DEFAULTS — the
      // explicit xaxis.labels/grid overrides below still win (years stay).
      sparkline:  { enabled: true },
      // Full range on first paint. DOMAIN: apex brush officially supports only
      // numeric/datetime x-axes — a category axis participates by apex's OWN
      // conversion (Config.checkForCatToNumericXAxis → convertCatToNumericXaxis,
      // which runs for zoomable marks with tickPlacement 'on'), indexing the
      // categories ONE-BASED: x = 1..n, labels via `labels[floor(val) - 1]`.
      // Brush selection and the target's x-window both speak that domain, so
      // full range is [1, n] — a 0-based [0, n-1] is off-domain on both ends.
      //
      // The selection window is the draggable navigator handle — a tinted accent
      // fill inside an accent border, so the window (and its grabbable edges) read
      // clearly against the muted area shape (Highcharts / ONS navigator reference).
      selection:  {
        enabled: true,
        fill:    { color: accent, opacity: 0.10 },
        stroke:  { width: 1, color: accent, opacity: 0.6, dashArray: 0 },
        xaxis:   { min: 1, max: Math.max(1, n) },
      },
      // A navigator is chrome, not a data surface — no animation churn on redraw.
      animations: { enabled: false },
    },
    series:     [{ name: '__nav__', data: navSeriesData(output) }],
    colors:     [accent],
    fill:       { type: 'gradient', gradient: { opacityFrom: 0.5, opacityTo: 0.12 } },
    stroke:     { width: 1.5, curve: 'smooth' },
    dataLabels: { enabled: false },
    legend:     { show: false },
    tooltip:    { enabled: false },
    grid:       { show: false, padding: { left: 8, right: 8, top: 0, bottom: 0 } },
    xaxis: {
      type:       'category',
      categories: [...categories],
      labels:     { show: true, style: { fontSize: '11px', colors: muted }, hideOverlappingLabels: true },
      axisTicks:  { show: false },
      axisBorder: { show: false },
      tooltip:    { enabled: false },
    },
    yaxis: { show: false },
  }
}
