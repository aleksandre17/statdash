// ── Cartesian context — cross-cutting scalars/flags resolved ONCE ──────
//
//  Information-expert: every derived scalar/flag the cartesian slices share is
//  computed here a single time, so no slice re-derives (and none can drift). In
//  particular the axis-hidden mapping (apexXHidden/Y) and the stacked-area yMax
//  each have ONE source here, consumed by both the axis + grid + annotation
//  slices — the SSOT the spec's risk table calls for.
//
//  INVARIANT: per-series arrays this context feeds downstream (yFmt/y2Fmt drive
//  formatters; yMax drives the annotation + axis max) never re-sort `series`.
//

import type { ChartOutput } from '@statdash/charts'
import { yFormatter, collectFormatted, scaledPx, verticalBarFillPct, horizontalBarFillPct, hbarValueAxisMax } from '../base'

export interface CartesianContext {
  /** Per-series pre-formatted label strings, keyed [seriesIndex][pointIndex]. */
  readonly formatted:     string[][]
  /** Responsive font-size clamps (px strings) for the XS / SM / MD tiers. */
  readonly FS_XS:         string
  readonly FS_SM:         string
  readonly FS_MD:         string
  readonly isWaterfall:   boolean
  readonly isCombo:       boolean
  readonly hasY2:         boolean
  readonly isStackedArea: boolean
  /** Semantic→visual axis-hidden mapping (orientation-aware), SSOT for axes+grid. */
  readonly apexXHidden:   boolean
  readonly apexYHidden:   boolean
  /** Value-axis label formatters (primary + secondary), re-carried by responsive. */
  readonly yFmt:          (val: number) => string
  readonly y2Fmt:         (val: number) => string
  /** Stacked-area running max — drives BOTH yaxis.max and the annotation line. */
  readonly yMax:          number | undefined
  /** Bar fill percent (with `%`) — absolute-thickness cap resolved in base.ts. */
  readonly barFill:       string
  /** ApexCharts host chart type (combo→line, bar-family→bar, else passthrough). */
  readonly apexType:      ApexChart['type']
  /** Effective data-label visibility (override or bar/hbar/waterfall default). */
  readonly showDataLabels: boolean
  /** hbar value-axis headroom max for out-of-bar end-labels (undefined ⇒ auto). */
  readonly hbarValueMax:  number | undefined
}

/**
 * Resolve every cross-cutting cartesian scalar/flag from the neutral output.
 *
 * `fontFamily` is intentionally NOT an input here — it is a pass-through chrome
 * value threaded straight to the chart/legend assembly (build.ts) + buildLegend,
 * not a derived context scalar.
 */
export function deriveContext(output: ChartOutput, locale?: string): CartesianContext {
  const { type, series, categories, axes, stacked, horizontal } = output

  const isWaterfall   = type === 'waterfall'
  const isCombo       = type === 'combo'
  const hasY2         = !!axes.y2
  const isStackedArea = type === 'area' && stacked

  // Axis hiding (declarative axes.{x,y}.hidden). ChartOutput axes are SEMANTIC:
  // axes.y = VALUE axis, axes.x = CATEGORY axis. ApexCharts swaps them visually for
  // a horizontal bar, so map each semantic-hidden flag to the right APEX axis by
  // orientation. A hidden axis drops scale/ticks/border/labels + gridlines; per-bar
  // data labels are independent (AR-2 R6: hide the value scale, keep the labels).
  const apexXHidden = horizontal ? axes.y.hidden === true : axes.x.hidden === true
  const apexYHidden = horizontal ? axes.x.hidden === true : axes.y.hidden === true

  // Value-axis formatters — hoisted so the responsive overrides can re-carry them
  // (ApexCharts rebuilds yaxis from defaults on responsive merge, dropping any
  // formatter not re-supplied — see responsiveYAxis).
  const yFmt  = yFormatter(axes.y.unit,  axes.y.decimals,  locale)
  const y2Fmt = yFormatter(axes.y2?.unit, axes.y2?.decimals, locale)

  const stackedMax = isStackedArea && categories.length > 0
      ? Math.max(...categories.map((_, i) =>
          series.reduce((sum, s) => sum + (s.data[i]?.value ?? 0), 0)
      ))
      : null
  const yMax = stackedMax ?? undefined

  // Bar sizing — % of per-category slot, derived from an ABSOLUTE thickness cap
  // (base.ts). Horizontal caps against the exact owned height; vertical against
  // the estimated plot width (Law 1/4).
  const barFill = `${horizontal ? horizontalBarFillPct(output) : verticalBarFillPct(categories.length)}%`

  // Chart type: combo → 'line' host (Apex mixes via per-series type); waterfall /
  // bar / hbar / hbar-diverging → 'bar'; else passthrough.
  const apexType = isCombo
      ? 'line'
      : (type === 'bar' || type === 'hbar' || type === 'hbar-diverging' || type === 'waterfall') ? 'bar' : type as ApexChart['type']

  // Data labels: enabled for bar/hbar/waterfall (non-stacked). Disabled for
  // line/combo and hbar-diverging. Explicit override wins.
  const showDataLabels = output.dataLabels !== undefined
    ? output.dataLabels
    : (type === 'bar' || type === 'hbar' || type === 'waterfall') && !stacked

  // hbar value-axis headroom for out-of-bar end-labels when the value SCALE is
  // hidden (R6) — root cause + rule live in hbarValueAxisMax (base.ts).
  const hbarValueMax = hbarValueAxisMax(horizontal, apexXHidden, showDataLabels, axes.y.max, series)

  return {
    formatted: collectFormatted(series),
    FS_XS: scaledPx(0.60, 9,  11),
    FS_SM: scaledPx(0.70, 10, 12),
    FS_MD: scaledPx(0.80, 11, 12),
    isWaterfall, isCombo, hasY2, isStackedArea,
    apexXHidden, apexYHidden,
    yFmt, y2Fmt,
    yMax, barFill, apexType, showDataLabels, hbarValueMax,
  }
}
