// ── reducers — the ONE aggregation vocabulary [AR-50 M5] ─────────────────────
//
//  A single canonical set of reduction functions shared by every group-and-reduce
//  transform op (`aggregate`, `rollup`, `reduce`). Before this convergence there
//  were three divergent vocabularies — `avg` (aggregate/rollup) vs `mean` (reduce)
//  named the SAME arithmetic-mean operation (Fable erosion E2). This module is the
//  SSOT: one `Reducer` union, one `reduceValues` implementation, one legacy alias
//  (`avg` → `mean`) so stored configs keep loading (Law 2).
//
//  The statistical canon (SDMX / Tidy-Data) names the arithmetic mean `mean`; the
//  SQL name `avg` is retained ONLY as a load-time alias, never offered for new
//  authoring.
//
//  `window` functions (movingAvg, cumSum, lag, diff) are a DISTINCT domain (running
//  functions over an ordered series, not group reducers) and keep their own
//  vocabulary — they are not part of this set.
//

// Canonical reduction functions. `first`/`last` read the ordered group values
// (positional), so callers pass values in row order.
export type Reducer = 'sum' | 'mean' | 'min' | 'max' | 'count' | 'first' | 'last'

// Legacy alias surface accepted at the config boundary (normalized by canonAgg).
export type ReducerAlias = Reducer | 'avg'

/**
 * Normalize a possibly-legacy reducer name to its canonical form. `avg` → `mean`;
 * every canonical name passes through unchanged. Stored configs authored with the
 * old `avg` name resolve identically (Law 2 round-trip).
 */
export function canonAgg(name: ReducerAlias): Reducer {
  return name === 'avg' ? 'mean' : name
}

/**
 * Reduce an ORDERED array of numeric values to a scalar. Empty input folds to 0 for
 * every function (byte-identical to the legacy per-op guards: `values.length === 0
 * → 0`, and the `nums.length ? … : 0` guards in reduce). Callers own their own NaN
 * filtering and any post-rounding (e.g. roundAgg) — this function does not round, so
 * each call site preserves its exact prior output.
 */
export function reduceValues(fn: Reducer, nums: readonly number[]): number {
  switch (fn) {
    case 'sum':   return nums.reduce((a, b) => a + b, 0)
    case 'mean':  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
    case 'min':   return nums.length ? Math.min(...nums) : 0
    case 'max':   return nums.length ? Math.max(...nums) : 0
    case 'count': return nums.length
    case 'first': return nums.length ? nums[0] : 0
    case 'last':  return nums.length ? nums[nums.length - 1] : 0
  }
}
