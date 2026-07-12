// ── ChartEmitter — ChartOutput → self-contained SVG string ─────────────
//
//  The pure, server-usable realizer of the neutral ChartOutput. Closes the
//  export / SSR / thumbnail hole (SPEC-rendering-architecture backbone 2): the
//  live chart renders ONLY through the client React/Apex path, so there was no
//  DOM-free way to turn a chart into SVG. `emit()` is that way — no React, no
//  Apex, no `window`, deterministic.
//
//  Dispatch mirrors the live `toApexOptions` switch:
//    cartesian (bar/hbar/line/area/combo/waterfall/contribution) → emitCartesian
//    every other shape                                            → labelled gap
//  Gaps are EXPLICIT (coverage.ts), never a silently-wrong drawing.
//

import type { ChartOutput } from '../types'
import { emitCartesian } from './cartesian'
import type { EmitOptions } from './cartesian'
import { isEmittable, EMIT_GAPS } from './coverage'
import { svgDoc, el, text, elC, esc } from './svg'
import { cssVar } from './cssVar'

export type { EmitOptions } from './cartesian'

/** Accessible title + description (WCAG 2.1 / Law 9) for the SVG document. */
function a11y(output: ChartOutput): string {
  const seriesNames = output.series.map((s) => s.name).filter((nm) => nm !== '__spacer__')
  const desc = `${output.type} chart, ${output.categories.length} categories`
    + (seriesNames.length ? `, series: ${seriesNames.join(', ')}` : '')
  return elC('title', {}, esc(desc)) + elC('desc', {}, esc(desc))
}

/** A valid, self-describing placeholder for an empty or not-yet-emittable output. */
function placeholder(output: ChartOutput, opts: EmitOptions, note: string): string {
  const width  = opts.width ?? 760
  const height = opts.height ?? (output.height ?? 300)
  // Chrome colours resolve via the charts-local cssVar (var() is invalid in SVG
  // attrs): theme-aware in a browser cascade, light-mode SSOT fallback on server.
  const surface = cssVar('--color-surface',     '#ffffff')
  const frame   = cssVar('--color-chart-frame', '#E0EBE8')
  const muted   = cssVar('--color-text-muted',  '#5A6B7D')
  const body =
    a11y(output)
    + el('rect', { x: 0.5, y: 0.5, width: width - 1, height: height - 1, fill: surface, stroke: frame, 'stroke-width': 1, rx: 4 })
    + text(note, { x: width / 2, y: height / 2, 'text-anchor': 'middle', 'font-size': 13, fill: muted, 'font-family': opts.fontFamily ?? 'system-ui, sans-serif' })
  return svgDoc(width, height, {
    'data-chart-type': output.type,
    'data-chart-gap':  isEmittable(output.type) ? undefined : output.type,
    role:              'img',
  }, body)
}

/**
 * Emit a ChartOutput as a self-contained SVG string.
 *
 * Pure + deterministic: the same ChartOutput always yields byte-identical SVG.
 * No DOM, no React, no ApexCharts — runnable on a server with no browser.
 *
 * @param output the neutral chart output (the SAME type the Apex adapter consumes)
 * @param opts   optional canvas sizing / locale / font
 * @returns a complete `<svg>…</svg>` document string
 */
export function emit(output: ChartOutput, opts: EmitOptions = {}): string {
  // Empty output (placeholderOutput / no series) → explicit empty-state SVG.
  if (output.series.length === 0 || output.categories.length === 0) {
    return placeholder(output, opts, 'No data')
  }
  // Not-yet-emittable shape → explicit, enumerated gap (never a wrong drawing).
  if (!isEmittable(output.type)) {
    const reason = EMIT_GAPS[output.type] ?? `${output.type} not yet emittable`
    return placeholder(output, opts, `${output.type}: not exported (${reason})`)
  }
  // Cartesian realizer — inject the a11y title/desc as the first children.
  const svg = emitCartesian(output, opts)
  return svg.replace('>', `>${a11y(output)}`)
}
