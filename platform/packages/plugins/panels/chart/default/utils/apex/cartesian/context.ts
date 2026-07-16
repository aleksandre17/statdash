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
import { yFormatter, collectFormatted, scaledPx, verticalBarFillPct, horizontalBarFillPct, hbarValueAxisMax, niceFloor } from '../base'
import { FAMILY_TRAITS, familyOf } from './families'
import type { CartesianFamily, FillMode, StrokeMode, SeriesMode } from './families'

export interface CartesianContext {
  /** Resolved cartesian family (bar/hbar/line/area/waterfall/combo). */
  readonly family:        CartesianFamily
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
  /** Data-fitted nice floor for a NEGATIVE-extent value axis (undefined ⇒ no
   *  authored min needed / no negatives / an explicit min was authored). */
  readonly yMinFloor:     number | undefined
  /** Bar fill percent (with `%`) — absolute-thickness cap resolved in base.ts. */
  readonly barFill:       string
  /** ApexCharts host chart type (combo→line, bar-family→bar, else passthrough). */
  readonly apexType:      ApexChart['type']
  /** Effective data-label visibility (override or bar/hbar/waterfall default). */
  readonly showDataLabels: boolean
  /** hbar value-axis headroom max for out-of-bar end-labels (undefined ⇒ auto). */
  readonly hbarValueMax:  number | undefined
  // ── Resolved render discriminants (trait × runtime `stacked`) ──────────
  //  Slices switch on THESE, never on `type === 'waterfall'`.
  readonly seriesMode:    SeriesMode
  readonly fillMode:      FillMode
  readonly strokeMode:    StrokeMode
  /** Whether point markers draw (line always; area only while unstacked). */
  readonly showMarkers:   boolean
  /** Family that is always stacked regardless of authored `stacked` (waterfall). */
  readonly forcesStacked: boolean
  /** Continuous value axis pinned to a zero baseline + nice-scale (line/area). */
  readonly zeroBaselineAxis: boolean
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

  const family = familyOf(type)
  const traits = FAMILY_TRAITS[family]

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

  // Data-driven negative-axis floor (portal notes item 9). When the value axis
  // carries negatives and NO explicit min was authored, fit the floor to the
  // actual negative extent (nice-rounded), instead of letting ApexCharts pick a
  // far-too-generous auto floor. Orientation-neutral: for a horizontal bar the
  // value extent still lives in the (numeric) series data. For a STACKED chart the
  // floor is the most-negative CUMULATIVE stack (negatives sum downward), else the
  // most-negative single value. Zero-baseline axes (line/area) are pinned to 0 and
  // never take a floor.
  const negFloorRaw = !traits.zeroBaselineAxis && axes.y.min == null
    ? (stacked
        ? Math.min(0, ...categories.map((_, i) =>
            series.reduce((sum, s) => { const v = s.data[i]?.value ?? 0; return v < 0 ? sum + v : sum }, 0)))
        : Math.min(0, ...series.flatMap((s) => s.data.map((p) => p.value ?? 0))))
    : 0
  const yMinFloor = negFloorRaw < 0 ? niceFloor(negFloorRaw) : undefined

  // Bar sizing — % of per-category slot, derived from an ABSOLUTE thickness cap
  // (base.ts). Horizontal caps against the exact owned height; vertical against
  // the estimated plot width (Law 1/4).
  const barFill = `${horizontal ? horizontalBarFillPct(output) : verticalBarFillPct(categories.length)}%`

  // Chart type is a pure family trait (combo→line host, bar-family→bar, else passthrough).
  const apexType = traits.apexType

  // Data labels: family default (bar/hbar/waterfall) AND not stacked. Override wins.
  const showDataLabels = output.dataLabels !== undefined
    ? output.dataLabels
    : traits.dataLabelsByDefault && !stacked

  // hbar value-axis headroom for out-of-bar end-labels (hidden OR visible scale) —
  // root cause + rule live in hbarValueAxisMax (base.ts).
  const hbarValueMax = hbarValueAxisMax(horizontal, showDataLabels, axes.y.max, series)

  // Resolve the render discriminants: fill/stroke baselines upgrade to their
  // stacked-area variant at runtime; markers gate on the `unstacked` rule.
  const fillMode: FillMode     = isStackedArea ? 'stacked-area' : traits.baseFill
  const strokeMode: StrokeMode = isStackedArea ? 'stacked-area' : traits.baseStroke
  const showMarkers = traits.marks === 'always' || (traits.marks === 'unstacked' && !stacked)

  return {
    family,
    formatted: collectFormatted(series),
    // Font floors raised for a readable axis/legend baseline (portal notes item 5).
    FS_XS: scaledPx(0.62, 10, 12),
    FS_SM: scaledPx(0.72, 11, 13),
    FS_MD: scaledPx(0.82, 12, 14),
    isWaterfall, isCombo, hasY2, isStackedArea,
    apexXHidden, apexYHidden,
    yFmt, y2Fmt,
    yMax, yMinFloor, barFill, apexType, showDataLabels, hbarValueMax,
    seriesMode: traits.seriesMode, fillMode, strokeMode, showMarkers,
    forcesStacked: traits.forcesStacked,
    zeroBaselineAxis: traits.zeroBaselineAxis,
  }
}
