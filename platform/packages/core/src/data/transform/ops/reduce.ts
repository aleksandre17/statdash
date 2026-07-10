// ── reduce op — Aggregate series to one row per group [N39] ──────────
//
//  GROUP BY + collapse. Unlike `aggregate` (which is kept for backward
//  compat), `reduce` has a cleaner API and extended fn vocabulary
//  (mean, first, last — genuinely new). Implemented independently with
//  its own applyReduce function; does not alias or wrap `aggregate`.
//
//  fns: sum | mean | min | max | count | first | last
//  Output: one row per group containing group-by keys + `as` field.
//

import type { RawRow, TransformStep } from '../types'
import type { DimVal }                from '../../../sdmx'
import { reduceValues }              from '../reducers'

export function applyReduce(rows: RawRow[], step: Extract<TransformStep, { op: 'reduce' }>): RawRow[] {
  const { fn, field } = step
  const outputField   = step.as ?? `${field}_${fn}`
  const byFields: string[] = step.by === undefined
    ? []
    : Array.isArray(step.by) ? step.by : [step.by]

  // Group rows — key is the composite group-by value string
  const order:  string[]                                        = []
  const groups: Map<string, { key: RawRow; values: DimVal[] }> = new Map()

  for (const row of rows) {
    const keyStr = byFields.length === 0
      ? '__all__'
      : byFields.map((k) => `${k}=${String(row[k] ?? '')}`).join('|')

    if (!groups.has(keyStr)) {
      const key: RawRow = {}
      for (const k of byFields) key[k] = row[k]
      groups.set(keyStr, { key, values: [] })
      order.push(keyStr)
    }

    groups.get(keyStr)!.values.push(row[field] ?? 0)
  }

  return order.map((keyStr) => {
    const { key, values } = groups.get(keyStr)!
    // values are pushed in row order (row[field] ?? 0), so reduceValues' positional
    // first/last read the same cells the legacy inline switch did — byte-identical.
    const result = reduceValues(fn, values.map(Number))
    return { ...key, [outputField]: result }
  })
}
