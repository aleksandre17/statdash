// ── Cartesian axes (the orientation-mirrored value/category pair) ──────
//
//  ChartOutput axes are SEMANTIC (axes.y = VALUE, axes.x = CATEGORY). ApexCharts
//  swaps them visually for a horizontal bar, so each function reads `horizontal`
//  to place the numeric formatter on the right physical axis:
//
//    vbar/line/area/waterfall/combo → yaxis = value, xaxis = category
//    hbar                            → yaxis = category, xaxis = value
//
//  Both consume ctx.apexX/YHidden (the SSOT hidden-axis mapping) so scale/ticks/
//  border/label drops never drift from the gridline drop in grid.ts.
//

import type { ChartOutput } from '@statdash/charts'
import type { CartesianContext } from './context'
import { cssVar } from '@statdash/styles'

/** Value axis (+ opposite y2 when present). hbar's left axis is categorical. */
export function buildValueAxis(output: ChartOutput, ctx: CartesianContext): ApexYAxis | ApexYAxis[] {
  const { axes, horizontal } = output
  const { apexYHidden, FS_SM, yFmt, y2Fmt, hasY2, isStackedArea, yMax, yMinFloor, zeroBaselineAxis } = ctx

  const yAxisBase: ApexYAxis = apexYHidden
      ? { show: false }
      : horizontal
      ? {
        labels: { style: { fontSize: FS_SM, colors: cssVar('--color-text-muted', '#6B7B8D') }, maxWidth: 220 },
      }
      : {
        labels: {
          style:     { fontSize: FS_SM, colors: cssVar('--color-text-muted', '#6B7B8D') },
          formatter: yFmt,
        },
        min:            zeroBaselineAxis ? 0 : (axes.y.min ?? yMinFloor),
        max:            isStackedArea ? yMax : axes.y.max,
        forceNiceScale: isStackedArea ? false : (zeroBaselineAxis ? true : undefined),
      }

  return hasY2
      ? [
        yAxisBase,
        {
          opposite: true,
          labels: {
            style:     { fontSize: FS_SM, colors: cssVar('--color-text-muted', '#6B7B8D') },
            formatter: y2Fmt,
          },
          min: axes.y2?.min,
          max: axes.y2?.max,
        },
      ]
      : yAxisBase
}

/** Category axis. hbar's bottom axis carries the numeric value scale instead. */
export function buildCategoryAxis(output: ChartOutput, ctx: CartesianContext): ApexXAxis {
  const { axes, categories, horizontal } = output
  const { apexXHidden, FS_SM, yFmt, hbarValueMax, yMinFloor } = ctx

  return {
    // hbar: xaxis is the value axis (bottom) — numeric formatter + no categories.
    // vbar: xaxis is the category axis (bottom) — string categories + no formatter.
    ...(horizontal ? {} : { categories: [...categories] }),
    ...(horizontal ? { min: axes.y.min ?? yMinFloor, max: hbarValueMax } : {}),
    labels: apexXHidden
        ? { show: false }
        : horizontal
        ? {
          style:     { fontSize: FS_SM, colors: cssVar('--color-text-muted', '#6B7B8D') },
          // xaxis.labels.formatter receives a string — parse back to number first
          formatter: (val: string) => yFmt(Number(val)),
          hideOverlappingLabels: true,
        }
        : {
          style:        { fontSize: FS_SM, colors: cssVar('--color-text-muted', '#6B7B8D') },
          rotate:       -45,
          rotateAlways: false,
          trim:         true,
          // Hard cap on the vertical space reserved for rotated labels —
          // combined with trim:true, overflowing labels get ellipsised
          // rather than pushing the plot area out of the container.
          maxHeight: 100,
          hideOverlappingLabels: true,
        },
    axisBorder: apexXHidden ? { show: false } : { color: cssVar('--color-chart-frame', '#E0EBE8') },
    axisTicks:  apexXHidden ? { show: false } : { color: cssVar('--color-chart-frame', '#E0EBE8') },
  }
}
