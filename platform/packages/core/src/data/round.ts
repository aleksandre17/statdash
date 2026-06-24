// ── Aggregation precision — the one place the 2-decimal rule lives ────
//
//  Aggregated/summed values are rounded to AGG_DECIMALS places to absorb
//  IEEE-754 float drift (e.g. 0.1 + 0.2 = 0.30000000000000004). This is a
//  single business rule shared by every aggregation path — the OLAP sum
//  (ExternalStore), the transform `aggregate`/`rollup` ops, and groupAggregate.
//  Previously the magic `Math.round(x * 100) / 100` was copied across four
//  call sites in three files; this is its SSOT.
//

/** Decimal places aggregated values are rounded to. */
export const AGG_DECIMALS = 2

const AGG_FACTOR = 10 ** AGG_DECIMALS

/** Round an aggregated value to AGG_DECIMALS places (float-drift guard). */
export function roundAgg(value: number): number {
  return Math.round(value * AGG_FACTOR) / AGG_FACTOR
}
