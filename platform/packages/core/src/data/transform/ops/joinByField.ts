// ── joinByField op — Hash join of two EngineRow sets [N39] ───────────
//
//  Standard hash join on a shared key field.
//
//  source: EngineRow[] — caller must resolve any DataSpec to rows before
//  constructing this step. The transform layer must not know about DataSpec.
//
//  mode:
//    'inner' — only rows where both sides have the key
//    'left'  — all left rows; B fields absent when no match
//    'outer' — all rows from both sides
//
//  Field conflict: A (left) wins — right rows add new fields only.
//

import type { RawRow, TransformStep } from '../types'

export function applyJoinByField(
  rows: RawRow[],
  step: Extract<TransformStep, { op: 'joinByField' }>,
): RawRow[] {
  const { by, mode, source } = step

  // Build index over right (B) source keyed by the join field
  const bIndex = new Map<string, RawRow>()
  for (const bRow of source) {
    const k = String(bRow[by] ?? '')
    // First occurrence wins (stable, no clobber)
    if (!bIndex.has(k)) bIndex.set(k, bRow)
  }

  const result: RawRow[] = []
  const matchedBKeys = new Set<string>()

  for (const aRow of rows) {
    const k     = String(aRow[by] ?? '')
    const bRow  = bIndex.get(k)

    if (bRow) {
      // Merge: A wins on conflict — spread B first, then A overwrites
      const merged: RawRow = { ...bRow, ...aRow }
      result.push(merged)
      matchedBKeys.add(k)
    } else {
      // No B match
      if (mode === 'inner') continue          // inner: skip unmatched A rows
      result.push({ ...aRow })               // left/outer: emit A as-is
    }
  }

  // outer: emit remaining B rows that were not matched by any A row
  if (mode === 'outer') {
    for (const bRow of source) {
      const k = String(bRow[by] ?? '')
      if (!matchedBKeys.has(k)) {
        result.push({ ...bRow })
      }
    }
  }

  return result
}
