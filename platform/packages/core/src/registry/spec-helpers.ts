// ── spec-helpers — shared pure helpers for the built-in SpecResolvers ─────────
//
//  Tiny, store-free helpers shared by the resolver units (resolvers.ts) and the
//  store-aware point-series resolver (point-series-resolver.ts). Kept here so neither
//  resolver file owns the other (no import cycle), one concern per file.
//

import { resolveMeasureRef } from '../data/metric'

/**
 * Resolve a single measure reference used by the convenience specs
 * (timeseries/growth/ratio-list/point-series `code`). A registered metric-id expands
 * to its underlying code; a raw code passes through UNCHANGED (byte-identical).
 * Multi-code metrics resolve to their FIRST code here (the convenience specs are
 * single-measure-per-code by shape); author a `query` spec for multi-measure.
 */
export function resolveCode(code: string): string {
  return resolveMeasureRef(code).codes[0] ?? code
}
