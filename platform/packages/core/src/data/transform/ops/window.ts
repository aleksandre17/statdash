// ── window op — Running aggregation over an ordered series [N39] ──────
//
//  Applies windowed aggregations (movingAvg, cumSum, lag, diff) within
//  optional partitions. Rows must be pre-sorted before this step.
//
//  First-row sentinel: lag/diff simply omit the output field for the
//  first row of each partition (consistent with how join omits B-side
//  fields on no-match). No null, no undefined key — key absent entirely.
//

import type { RawRow, TransformStep } from '../types'

export function applyWindow(rows: RawRow[], step: Extract<TransformStep, { op: 'window' }>): RawRow[] {
  const { fn, over, by, n = 3 } = step
  const outputField = step.as ?? `${over}_${fn}`

  // Partition rows by `by` field (preserving original index for reassembly)
  const partitions = new Map<string, number[]>()
  for (let i = 0; i < rows.length; i++) {
    const key = by !== undefined ? String(rows[i][by] ?? '') : '__all__'
    const existing = partitions.get(key)
    if (existing) existing.push(i)
    else partitions.set(key, [i])
  }

  // Build output: start with shallow copies of all rows
  const out: RawRow[] = rows.map((r) => ({ ...r }))

  for (const indices of partitions.values()) {
    const values = indices.map((i) => Number(rows[i][over] ?? 0))

    for (let pos = 0; pos < indices.length; pos++) {
      const rowIdx = indices[pos]

      switch (fn) {
        case 'movingAvg': {
          // Trailing n-row average; grow the window for early rows
          const start  = Math.max(0, pos - n + 1)
          const window = values.slice(start, pos + 1)
          const avg    = window.reduce((a, b) => a + b, 0) / window.length
          out[rowIdx][outputField] = Math.round(avg * 1e10) / 1e10
          break
        }
        case 'cumSum': {
          out[rowIdx][outputField] = values.slice(0, pos + 1).reduce((a, b) => a + b, 0)
          break
        }
        case 'lag': {
          // First row of partition: omit the key entirely
          if (pos === 0) {
            delete out[rowIdx][outputField]
          } else {
            out[rowIdx][outputField] = values[pos - 1]
          }
          break
        }
        case 'diff': {
          // First row of partition: omit the key entirely
          if (pos === 0) {
            delete out[rowIdx][outputField]
          } else {
            out[rowIdx][outputField] = values[pos] - values[pos - 1]
          }
          break
        }
      }
    }
  }

  return out
}
