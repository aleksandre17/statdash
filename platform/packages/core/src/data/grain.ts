// ── grain — GENERIC grain-rollup reducer (Law 1: no privileged dimension) ─────
//
//  The reducer behind a `valAt` point read: a coordinate that pins a COARSE grain
//  over finer observations matches many cells, which this collapses to one value.
//  Default 'sum' is the OLAP cell (byte-identical to the legacy `_val` running sum).
//  Generic over the op AND the dimension — the time lattice is just one caller, never
//  special-cased here (FF-GRAIN-GENERIC). The grain LATTICE (StoreCaps.grains,
//  finer→coarser materialized-view routing + raw-fallback) layers ONTO this seam in a
//  later phase; this module is the additive door's reducer.
//

import type { RollupOp } from './store'

/** Aggregate the observation values matching one coordinate. Empty ⇒ 0 (the OLAP zero cell). */
export function rollupValues(values: number[], op: RollupOp = 'sum'): number {
  if (values.length === 0) return 0
  switch (op) {
    case 'sum':   return values.reduce((a, b) => a + b, 0)
    case 'avg':   return values.reduce((a, b) => a + b, 0) / values.length
    case 'min':   return Math.min(...values)
    case 'max':   return Math.max(...values)
    case 'first': return values[0]!
    case 'last':  return values[values.length - 1]!
  }
}
