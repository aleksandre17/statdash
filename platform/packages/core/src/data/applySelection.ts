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
//    replace — set the param to `value` (single-select); re-clicking the sole
//              active value clears it (deselect-toggle for single selects).
//    toggle  — accumulate a CSV set: add if absent, remove if present, and
//              evict the OLDEST once `max` is exceeded (the geograph's cap).
//    clear   — clear the param regardless of `value`.
//
//  Returns the next param string; '' means "cleared" (the caller dispatches an
//  empty filter:set, which is the platform's clear semantics).

import { splitMultiValue } from './store-filter'

export type SelectionMode = 'replace' | 'toggle' | 'clear'

export function applySelection(
  mode:    SelectionMode,
  current: string | undefined,
  value:   string,
  max?:    number,
): string {
  const cur = splitMultiValue(current ?? '')

  if (mode === 'clear') return ''

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
