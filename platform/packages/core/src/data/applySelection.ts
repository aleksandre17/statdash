// ── applySelection — the pure cross-filter selection reducer (SSOT) ─────────
//
//  Lifts the geograph's inline accumulate/cap logic (was GeographShell.handleSelect)
//  to ONE deterministic, React-free reducer, reused by EVERY selection surface
//  through the useNodeInteractions adapter. A selection IS a filter-param value
//  (no parallel selection store, Law 1); multi-select is a CSV OR-set the store
//  already reads as `= ANY` — `splitMultiValue` is the shared DECODE SSOT, and
//  this reducer is its ENCODE peer (same ',' separator, one round-trip contract).
//
//  Modes (declarative, from FilterAction.mode — default 'replace'):
//    replace  — set the param to `value` (single-select); re-clicking the sole
//               active value clears it (deselect-toggle for single selects).
//    toggle   — accumulate a CSV set: add if absent, remove if present, and
//               evict the OLDEST once `max` is exceeded (the geograph's cap).
//    interval — encode a `[lo,hi]` RANGE param (AR-42 P1, the `interval:brush`
//               peer of the CSV OR-set): `value` carries the brushed bounds
//               (comma-joined, any order), normalized to `${min},${max}` — the
//               ParamRange "from,to" URL serialization, decoded by splitRangeValue.
//    clear    — clear the param regardless of `value`.
//
//  Returns the next param string; '' means "cleared" (the caller dispatches an
//  empty filter:set, which is the platform's clear semantics).

import { splitMultiValue } from './store-filter'

export type SelectionMode = 'replace' | 'toggle' | 'interval' | 'clear'

/**
 * splitRangeValue — the DECODE peer of the `interval` ENCODE (the range sibling of
 * splitMultiValue). A range param string `"lo,hi"` → the normalized `[lo, hi]` number
 * tuple (min,max), or `null` when it is not a well-formed 2-bound range.
 */
export function splitRangeValue(val: string | undefined): [number, number] | null {
  const parts = (val ?? '')
    .split(',')
    .map((p) => Number(p.trim()))
    .filter((n) => !Number.isNaN(n))
  if (parts.length < 2) return null
  return [Math.min(parts[0]!, parts[1]!), Math.max(parts[0]!, parts[1]!)]
}

export function applySelection(
  mode:    SelectionMode,
  current: string | undefined,
  value:   string,
  max?:    number,
): string {
  const cur = splitMultiValue(current ?? '')

  if (mode === 'clear') return ''

  if (mode === 'interval') {
    // A brush emits a [lo,hi] range: normalize to `${min},${max}` (the ParamRange
    // "from,to" encode). An empty/degenerate brush clears (deselect).
    const range = splitRangeValue(value)
    return range ? `${range[0]},${range[1]}` : ''
  }

  if (mode === 'replace') {
    // Single-select: re-clicking the sole active value deselects it.
    return cur.length === 1 && cur[0] === value ? '' : value
  }

  // toggle — accumulate / evict-oldest once the cap is exceeded.
  const idx = cur.indexOf(value)
  let next: string[]
  if (idx >= 0) {
    next = cur.filter((v) => v !== value)                    // remove (deselect)
  } else if (max === undefined || cur.length < max) {
    next = [...cur, value]                                   // add (room left)
  } else {
    next = [...cur.slice(cur.length - max + 1), value]       // evict oldest, add
  }
  return next.join(',')
}
