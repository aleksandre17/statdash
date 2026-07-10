// ── Axis value formatting — reuse the engine SSOT ──────────────────────
//
//  Fidelity lever: the live renderer formats value-axis ticks via
//  `yFormatter` (plugins/…/apex/base.ts), which is itself a thin wrapper over
//  the engine's `fmtNum` / `compact`. The emitter reuses those SAME engine
//  functions (charts already depends on @statdash/engine — the arrow permits
//  it), so a tick reads IDENTICALLY here and in the browser: `fmtNum(v, d)` for
//  a fixed-decimals axis, `compact(v, locale)` for the compact glyph
//  (`88.4K` / `88,4 ათ.`). This is Law 4 — reuse the standard's SSOT, never
//  reinvent a parallel formatter.
//

import { fmtNum, compact } from '@statdash/engine'

/**
 * Value-axis label formatter — a byte-for-byte mirror of the live renderer's
 * `yFormatter`: fixed `decimals` → `fmtNum(v, decimals)`; undefined → the
 * locale-aware `compact` SSOT; a `unit` is appended with a single space.
 */
export function axisFormatter(
  unit?: string,
  decimals?: number,
  locale?: string,
): (val: number) => string {
  return (val: number) => {
    if (val === undefined || val === null || Number.isNaN(val)) return ''
    const n = typeof decimals === 'number' ? fmtNum(val, decimals) : compact(val, locale)
    return unit ? `${n} ${unit}` : n
  }
}
