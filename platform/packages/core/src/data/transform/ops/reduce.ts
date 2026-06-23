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

export function applyReduce(rows: RawRow[], step: Extract<TransformStep, { op: 'reduce' }>): RawRow[] {
  const { fn, field } = step
  const outputField   = step.as ?? `${field}_${fn}`
  const byFields: string[] = step.by === undefined
    ? []
    : Array.isArray(step.by) ? step.by : [step.by]

  // Group rows — key is the composite group-by value string
  const order:  string[]                                        = []
  const groups: Map<string, { key: RawRow; values: DimVal[]; rows: RawRow[] }> = new Map()

  for (const row of rows) {
    const keyStr = byFields.length === 0
      ? '__all__'
      : byFields.map((k) => `${k}=${String(row[k] ?? '')}`).join('|')

    if (!groups.has(keyStr)) {
      const key: RawRow = {}
      for (const k of byFields) key[k] = row[k]
      groups.set(keyStr, { key, values: [], rows: [] })
      order.push(keyStr)
    }

    const g = groups.get(keyStr)!
    g.values.push(row[field] ?? 0)
    g.rows.push(row)
  }

  return order.map((keyStr) => {
    const { key, values, rows: groupRows } = groups.get(keyStr)!
    const nums = values.map(Number)

    let result: number | string = 0
    switch (fn) {
      case 'sum':   result = nums.reduce((a, b) => a + b, 0); break
      case 'mean':  result = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0; break
      case 'min':   result = nums.length ? Math.min(...nums) : 0; break
      case 'max':   result = nums.length ? Math.max(...nums) : 0; break
      case 'count': result = values.length; break
      case 'first': result = groupRows.length ? Number(groupRows[0][field] ?? 0) : 0; break
      case 'last':  result = groupRows.length ? Number(groupRows[groupRows.length - 1][field] ?? 0) : 0; break
      default:      break
    }

    return { ...key, [outputField]: result }
  })
}
