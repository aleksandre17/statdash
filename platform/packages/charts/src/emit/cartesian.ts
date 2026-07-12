// ── Cartesian ChartOutput → SVG ────────────────────────────────────────
//
//  The second realizer of ChartOutput (the first is the ApexCharts adapter).
//  It emits the SAME neutral output the live chart shows, so the structure
//  matches: same marks (bars/lines/areas), same orientation mapping, same
//  value scale, same colours, same data labels, same legend. It is NOT a new
//  chart style — it is Apex's twin for the shapes the pipeline supports.
//
//  Fidelity anchors (each mirrors a named site in the live render layer):
//    • orientation     — axes.ts: vbar → y=value/x=category; hbar → mirrored
//    • value scale     — context.ts: zero baseline for bars, stacked running max
//    • colours         — colors.ts buildColors (see palette.ts)
//    • data labels     — context.ts showDataLabels (bar-like & !stacked, override)
//    • axis formatting  — base.ts yFormatter (see format.ts, reuses engine SSOT)
//    • hidden axes     — context.ts apex{X,Y}Hidden (semantic: axes.y=value)
//
//  Pure + deterministic: no window, no DOM, fixed font metrics, rounded coords.
//

import type { ChartOutput, ChartSeries } from '../types'
import { svgDoc, group, el, text, num, elC } from './svg'
import { niceScale, linear } from './scale'
import { axisFormatter } from './format'
import { resolveSeriesColors, markColor } from './palette'
import { cssVar } from './cssVar'

export interface EmitOptions {
  /** Canvas width in px (default 760). The client sizes to a live container we
   *  don't have server-side, so a deterministic default is used. */
  width?:      number
  /** Canvas height in px (default: output.height ?? 300; horizontal grows with n). */
  height?:     number
  /** Locale for the compact axis-tick glyph (mirrors ApexRenderer's useLocale). */
  locale?:     string
  /** Font family for text (default system stack, matching the live foreColor font). */
  fontFamily?: string
}

const FS         = 12    // FS_SM analogue — fixed (no window.innerWidth server-side)
const CHAR_W     = 0.6   // rough advance width factor for label-gutter sizing
const BAR_FILL   = 0.72  // share of a category band the bars occupy
const MARKER_R   = 4
const DEFAULT_W  = 760
const DEFAULT_H  = 300

type Kind = 'bar' | 'line' | 'area'

function seriesKind(output: ChartOutput, s: ChartSeries): Kind {
  if (output.type === 'line') return 'line'
  if (output.type === 'area') return 'area'
  if (output.type === 'combo') return (s.seriesType ?? 'bar') === 'line' ? 'line' : 'bar'
  return 'bar' // bar · hbar · waterfall · contribution
}

function estWidth(s: string): number {
  return s.length * FS * CHAR_W
}

/** Value-axis domain (stacked-aware, zero-baselined for bars). */
function valueDomain(output: ChartOutput, indices: number[], stacked: boolean): [number, number] {
  const { series, categories } = output
  let dataMin = 0
  let dataMax = 0
  if (stacked) {
    categories.forEach((_, i) => {
      let pos = 0
      let neg = 0
      for (const si of indices) {
        const v = series[si]?.data[i]?.value ?? 0
        if (v >= 0) pos += v
        else neg += v
      }
      dataMax = Math.max(dataMax, pos)
      dataMin = Math.min(dataMin, neg)
    })
  } else {
    for (const si of indices) {
      for (const pt of series[si]?.data ?? []) {
        dataMax = Math.max(dataMax, pt.value)
        dataMin = Math.min(dataMin, pt.value)
      }
    }
  }
  // Bars/areas grow from a 0 baseline → the value axis must include 0.
  return [Math.min(0, dataMin), Math.max(0, dataMax)]
}

/**
 * Emit a cartesian ChartOutput (bar/hbar/line/area/combo/waterfall/contribution)
 * as a self-contained SVG string.
 */
export function emitCartesian(output: ChartOutput, opts: EmitOptions = {}): string {
  const { categories, series, axes, legend } = output
  const horizontal = output.horizontal
  const locale     = opts.locale
  const fontFamily = opts.fontFamily ?? 'system-ui, sans-serif'
  const n          = categories.length

  // ── Chrome colours — semantic tokens resolved to SVG-attr literals ──────
  //  var() is invalid in an SVG presentation attr, so each token routes through
  //  the charts-local cssVar: theme-aware where a cascade exists (browser
  //  export), the canonical light-mode SSOT fallback under server/SSR emit —
  //  keeping the pure export deterministic + DOM-free (Law 3: no styles import).
  const FRAME   = cssVar('--color-chart-frame',    '#E0EBE8') // axis border + ticks
  const GRID    = cssVar('--color-chart-grid',     '#F0F5F3') // gridlines
  const MUTED   = cssVar('--color-text-muted',     '#5A6B7D') // axis labels
  const INK     = cssVar('--color-text-secondary', '#4A5568') // data labels + legend
  const SURFACE = cssVar('--color-surface',        '#ffffff') // marker halo

  const width  = opts.width ?? DEFAULT_W
  const height = opts.height
    ?? (horizontal ? Math.min(920, Math.max(output.height ?? 320, n * 32)) : (output.height ?? DEFAULT_H))

  // ── Semantic axis hide flags (axes.y = VALUE, axes.x = CATEGORY) ────────
  const valueAxisHidden = axes.y.hidden === true
  const catAxisHidden   = axes.x.hidden === true

  // ── Series classification + colours ─────────────────────────────────────
  const seriesColors = resolveSeriesColors(output)
  const barIdx:  number[] = []
  const lineIdx: number[] = []
  const areaIdx: number[] = []
  series.forEach((s, i) => {
    const k = seriesKind(output, s)
    if (k === 'bar') barIdx.push(i)
    else if (k === 'line') lineIdx.push(i)
    else areaIdx.push(i)
  })

  const stacked        = output.stacked === true
  const hasY2          = !!axes.y2
  const primaryIdx     = series.map((_, i) => i).filter((i) => !(hasY2 && series[i]?.yAxis === 'y2'))
  const secondaryIdx   = hasY2 ? series.map((_, i) => i).filter((i) => series[i]?.yAxis === 'y2') : []

  // ── Value scales (primary + optional secondary for combo dual-axis) ─────
  const [pMin, pMax] = valueDomain(output, primaryIdx.length ? primaryIdx : series.map((_, i) => i), stacked)
  const primary   = niceScale(pMin, pMax, 5, axes.y.min, axes.y.max)
  const secondary = hasY2
    ? (() => {
        const [sMin, sMax] = valueDomain(output, secondaryIdx, false)
        return niceScale(sMin, sMax, 5, axes.y2?.min, axes.y2?.max)
      })()
    : undefined

  const fmtPrimary   = axisFormatter(axes.y.unit,  axes.y.decimals,  locale)
  const fmtSecondary = axisFormatter(axes.y2?.unit, axes.y2?.decimals, locale)

  // ── Margins — sized from the actual tick/category label widths ──────────
  const tickStrings = primary.ticks.map(fmtPrimary)
  const valueLabelW = catAxisHidden ? 0 : Math.min(90, Math.max(...tickStrings.map(estWidth), 0)) + 8
  const catLabelW   = Math.min(180, Math.max(...categories.map(estWidth), 0)) + 8

  const legPos  = legend.show ? (legend.position ?? 'bottom') : undefined
  const LEG_BAND = 26
  const LEG_SIDE = 130

  const marginTop = 14
    + (legPos === 'top' ? LEG_BAND : 0)
  const marginBottom = (legPos === 'bottom' ? LEG_BAND : 0)
    + (horizontal ? (valueAxisHidden ? 12 : 26) : (catAxisHidden ? 12 : 60))
  const marginLeft = (legPos === 'left' ? LEG_SIDE : 0)
    + (horizontal ? (catAxisHidden ? 12 : catLabelW) : (valueAxisHidden ? 12 : valueLabelW))
  const marginRight = 16
    + (legPos === 'right' ? LEG_SIDE : 0)
    + (hasY2 && !valueAxisHidden ? Math.min(90, Math.max(...secondary!.ticks.map(fmtSecondary).map(estWidth), 0)) + 8 : 0)

  const plotL = marginLeft
  const plotR = width - marginRight
  const plotT = marginTop
  const plotB = height - marginBottom
  const plotW = Math.max(1, plotR - plotL)
  const plotH = Math.max(1, plotB - plotT)

  // ── Scale helpers ───────────────────────────────────────────────────────
  //  Value axis is vertical (y) for vbar, horizontal (x) for hbar.
  const valPix = (v: number, useY2: boolean): number => {
    const sc = useY2 && secondary ? secondary : primary
    return horizontal
      ? linear(v, sc.niceMin, sc.niceMax, plotL, plotR)   // min→left, max→right
      : linear(v, sc.niceMin, sc.niceMax, plotB, plotT)   // min→bottom, max→top
  }
  const useY2For = (si: number): boolean => hasY2 && series[si]?.yAxis === 'y2'

  // Category band along the category axis (x for vbar, y for hbar).
  const catExtent = horizontal ? plotH : plotW
  const band      = n > 0 ? catExtent / n : catExtent
  const catStart  = (i: number): number => (horizontal ? plotT : plotL) + i * band
  const catCenter = (i: number): number => catStart(i) + band / 2

  const zeroPix = valPix(0, false)

  // ── Assemble body ───────────────────────────────────────────────────────
  const parts: string[] = []

  // Gridlines + value-axis ticks/labels (skip if value axis hidden).
  if (!valueAxisHidden) {
    const tickParts: string[] = []
    primary.ticks.forEach((tv, ti) => {
      const p = valPix(tv, false)
      // gridline perpendicular to the value axis
      tickParts.push(el('line', horizontal
        ? { x1: p, y1: plotT, x2: p, y2: plotB, stroke: GRID, 'stroke-width': 1 }
        : { x1: plotL, y1: p, x2: plotR, y2: p, stroke: GRID, 'stroke-width': 1 }))
      // tick label
      const label = tickStrings[ti]!
      tickParts.push(text(label, horizontal
        ? { x: p, y: plotB + 16, 'text-anchor': 'middle', 'font-size': FS, fill: MUTED, 'font-family': fontFamily }
        : { x: plotL - 6, y: p + FS / 3, 'text-anchor': 'end', 'font-size': FS, fill: MUTED, 'font-family': fontFamily }))
    })
    parts.push(group({ 'data-layer': 'value-axis' }, tickParts.join('')))

    // Secondary (y2) axis labels on the right (combo dual axis).
    if (hasY2 && secondary) {
      const y2Parts: string[] = []
      secondary.ticks.forEach((tv) => {
        const p = valPix(tv, true)
        y2Parts.push(text(fmtSecondary(tv), { x: plotR + 6, y: p + FS / 3, 'text-anchor': 'start', 'font-size': FS, fill: MUTED, 'font-family': fontFamily }))
      })
      parts.push(group({ 'data-layer': 'value-axis-2' }, y2Parts.join('')))
    }
  }

  // Zero baseline / axis frame line.
  parts.push(el('line', horizontal
    ? { x1: zeroPix, y1: plotT, x2: zeroPix, y2: plotB, stroke: FRAME, 'stroke-width': 1 }
    : { x1: plotL, y1: zeroPix, x2: plotR, y2: zeroPix, stroke: FRAME, 'stroke-width': 1 }))

  // Category-axis labels.
  if (!catAxisHidden && n > 0) {
    const catParts: string[] = []
    categories.forEach((c, i) => {
      const center = catCenter(i)
      if (horizontal) {
        catParts.push(text(c, { x: plotL - 6, y: center + FS / 3, 'text-anchor': 'end', 'font-size': FS, fill: MUTED, 'font-family': fontFamily }))
      } else {
        // Rotated -45° (mirrors axes.ts xaxis.labels.rotate: -45) anchored at end.
        const x = center
        const y = plotB + 14
        catParts.push(elC('text', { 'text-anchor': 'end', 'font-size': FS, fill: MUTED, 'font-family': fontFamily, transform: `rotate(-45 ${num(x)} ${num(y)})`, x, y }, c.replace(/&/g, '&amp;').replace(/</g, '&lt;')))
      }
    })
    parts.push(group({ 'data-layer': 'category-axis' }, catParts.join('')))
  }

  // ── Marks: areas (bottom) → bars → lines (top) ──────────────────────────
  const markParts: string[] = []

  // Areas (with optional stacked-area accumulation).
  if (areaIdx.length > 0) {
    const areaBase = new Array<number>(n).fill(0)
    const stackAreas = output.type === 'area' && stacked
    for (const si of areaIdx) {
      const color = seriesColors[si] ?? INK
      const tops: number[] = categories.map((_, ci) => {
        const v = series[si]?.data[ci]?.value ?? 0
        return (stackAreas ? areaBase[ci]! : 0) + v
      })
      const topPts  = categories.map((_, ci) => `${num(horizontal ? valPix(tops[ci]!, useY2For(si)) : catCenter(ci))},${num(horizontal ? catCenter(ci) : valPix(tops[ci]!, useY2For(si)))}`)
      const basePts = categories.map((_, ci) => {
        const bv = stackAreas ? areaBase[ci]! : 0
        return `${num(horizontal ? valPix(bv, useY2For(si)) : catCenter(ci))},${num(horizontal ? catCenter(ci) : valPix(bv, useY2For(si)))}`
      }).reverse()
      markParts.push(el('polygon', { points: [...topPts, ...basePts].join(' '), fill: color, 'fill-opacity': 0.65, stroke: 'none', 'data-series': series[si]?.name }))
      // stroke the top edge (line over area)
      markParts.push(el('polyline', { points: topPts.join(' '), fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round' }))
      if (stackAreas) categories.forEach((_, ci) => { areaBase[ci] = tops[ci]! })
    }
  }

  // Bars (grouped or stacked).
  if (barIdx.length > 0) {
    const groupCount = stacked ? 1 : Math.max(1, barIdx.length)
    const usable     = band * BAR_FILL
    const subW       = usable / groupCount
    const groupPad   = (band - usable) / 2
    const cumPos = new Array<number>(n).fill(0)
    const cumNeg = new Array<number>(n).fill(0)
    let g = 0
    for (const si of barIdx) {
      categories.forEach((_, ci) => {
        const v = series[si]?.data[ci]?.value ?? 0
        let base: number
        let top: number
        if (stacked) {
          base = v >= 0 ? cumPos[ci]! : cumNeg[ci]!
          top  = base + v
          if (v >= 0) cumPos[ci] = top
          else cumNeg[ci] = top
        } else {
          base = 0
          top  = v
        }
        const color = markColor(output, seriesColors, si, ci)
        if (color === 'transparent' || v === 0) return
        const offset = groupPad + (stacked ? 0 : g * subW)
        const pBase  = valPix(base, useY2For(si))
        const pTop   = valPix(top, useY2For(si))
        const rect = horizontal
          ? { x: Math.min(pBase, pTop), y: catStart(ci) + offset, width: Math.abs(pTop - pBase), height: subW, fill: color }
          : { x: catStart(ci) + offset, y: Math.min(pBase, pTop), width: subW, height: Math.abs(pTop - pBase), fill: color }
        markParts.push(el('rect', { ...rect, rx: 2, 'data-series': series[si]?.name }))
      })
      if (!stacked) g++
    }
  }

  // Lines (+ markers).
  for (const si of lineIdx) {
    const color = seriesColors[si] ?? INK
    const pts = categories.map((_, ci) => {
      const v = series[si]?.data[ci]?.value ?? 0
      const vp = valPix(v, useY2For(si))
      return horizontal ? `${num(vp)},${num(catCenter(ci))}` : `${num(catCenter(ci))},${num(vp)}`
    })
    markParts.push(el('polyline', { points: pts.join(' '), fill: 'none', stroke: color, 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'data-series': series[si]?.name }))
    categories.forEach((_, ci) => {
      const v = series[si]?.data[ci]?.value ?? 0
      const vp = valPix(v, useY2For(si))
      const cx = horizontal ? vp : catCenter(ci)
      const cy = horizontal ? catCenter(ci) : vp
      markParts.push(el('circle', { cx, cy, r: MARKER_R, fill: color, stroke: SURFACE, 'stroke-width': 1.5 }))
    })
  }

  parts.push(group({ 'data-layer': 'marks' }, markParts.join('')))

  // ── Data labels ─────────────────────────────────────────────────────────
  const barLike = ['bar', 'hbar', 'waterfall', 'contribution'].includes(output.type)
  const showDataLabels = output.dataLabels !== undefined ? output.dataLabels : (barLike && !stacked)
  if (showDataLabels) {
    const labelParts: string[] = []
    series.forEach((s, si) => {
      const kind = seriesKind(output, s)
      s.data.forEach((pt, ci) => {
        if (!pt.formatted) return
        const v  = pt.value
        const vp = valPix(v, useY2For(si))
        if (kind === 'bar') {
          if (v === 0) return
          const groupCount = stacked ? 1 : Math.max(1, barIdx.length)
          const usable = band * BAR_FILL
          const subW = usable / groupCount
          const gpos = barIdx.indexOf(si)
          const offset = (band - usable) / 2 + (stacked ? 0 : gpos * subW)
          if (horizontal) {
            labelParts.push(text(pt.formatted, { x: vp + 4, y: catStart(ci) + offset + subW / 2 + FS / 3, 'text-anchor': 'start', 'font-size': FS, fill: INK, 'font-family': fontFamily }))
          } else {
            labelParts.push(text(pt.formatted, { x: catStart(ci) + offset + subW / 2, y: Math.min(vp, zeroPix) - 4, 'text-anchor': 'middle', 'font-size': FS, fill: INK, 'font-family': fontFamily }))
          }
        } else {
          const cx = horizontal ? vp : catCenter(ci)
          const cy = horizontal ? catCenter(ci) : vp
          labelParts.push(text(pt.formatted, { x: cx, y: cy - 8, 'text-anchor': 'middle', 'font-size': FS, fill: INK, 'font-family': fontFamily }))
        }
      })
    })
    parts.push(group({ 'data-layer': 'data-labels' }, labelParts.join('')))
  }

  // ── Legend ──────────────────────────────────────────────────────────────
  if (legPos) {
    const items = series
      .map((s, si) => ({ name: s.name, color: seriesColors[si] ?? INK }))
      .filter((it) => it.name !== '__spacer__')
    const legParts: string[] = []
    const SW = 12
    const GAP = 6
    const ITEM_GAP = 16
    if (legPos === 'top' || legPos === 'bottom') {
      const widths = items.map((it) => SW + GAP + estWidth(it.name) + ITEM_GAP)
      const totalW = widths.reduce((a, b) => a + b, 0)
      let x = plotL + Math.max(0, (plotW - totalW) / 2)
      const y = legPos === 'top' ? 10 : height - 8
      items.forEach((it, i) => {
        legParts.push(el('rect', { x, y: y - SW + 2, width: SW, height: SW, rx: 2, fill: it.color }))
        legParts.push(text(it.name, { x: x + SW + GAP, y: y + FS / 3, 'text-anchor': 'start', 'font-size': FS, fill: INK, 'font-family': fontFamily }))
        x += widths[i]!
      })
    } else {
      const x = legPos === 'left' ? 8 : width - LEG_SIDE + 8
      let y = plotT + 4
      items.forEach((it) => {
        legParts.push(el('rect', { x, y: y - SW + 2, width: SW, height: SW, rx: 2, fill: it.color }))
        legParts.push(text(it.name, { x: x + SW + GAP, y: y + FS / 3, 'text-anchor': 'start', 'font-size': FS, fill: INK, 'font-family': fontFamily }))
        y += SW + GAP + 6
      })
    }
    parts.push(group({ 'data-layer': 'legend' }, legParts.join('')))
  }

  return svgDoc(width, height, {
    'data-chart-type': output.type,
    role:              'img',
    'font-family':     fontFamily,
  }, parts.join(''))
}
