// ── @statdash/charts — ChartEmitter (ChartOutput → SVG) ────────────────
//
//  Pure, DOM-free, server-usable emission of the neutral ChartOutput to a
//  self-contained SVG string. The export / SSR / thumbnail realizer — the twin
//  of the client ApexCharts adapter, over the SAME ChartOutput.
//

export { emit } from './emitter'
export type { EmitOptions } from './emitter'
export { isEmittable, EMITTABLE_TYPES, EMIT_GAPS } from './coverage'
export { EMIT_PALETTE, paletteAt } from './palette'
export { niceScale } from './scale'
export type { NiceScale } from './scale'
