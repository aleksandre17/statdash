// @vitest-environment node
//
// ── FF-RANGE-NO-SECTOR — the sector selector is absent + cleared in range mode ──
//
//  Owner defect: at /ka/regional?region=R5&mode=range a SECTOR selector still showed,
//  and a stale `sector` param survived the switch into range (broken permalink). Range
//  ("Dynamics") is a time-window perspective where a single-sector pin is meaningless.
//
//  The declarative fix (Law 1/2, no positional-mode literal in code):
//    1. VISIBILITY — the `sector` filter reads `visibleWhen: {op:'perspective-not',
//       perspective:'range'}` (the perspective-state gate other controls use), so it
//       renders in every non-range perspective and is HIDDEN in range.
//    2. PARAM CLEANUP — the `range` perspective's `onEnter.set` clears `sector` (→ null),
//       so switching INTO range drops the param from state + the URL permalink (the
//       perspective-effects seam applies it through the one write point).
//
//  This gate asserts BOTH against the real provisioning SSOT, driving the SAME pure
//  evaluators the runtime uses (evalVisibility + applyPerspectiveEffects).
//

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve as resolvePath } from 'node:path'
import { describe, it, expect } from 'vitest'
import { evalVisibility, applyPerspectiveEffects } from '@statdash/engine'
import type { PerspectiveAxis, VisibilityExpr } from '@statdash/engine'

/* eslint-disable @typescript-eslint/no-explicit-any */
const here     = dirname(fileURLToPath(import.meta.url))
const provPath = resolvePath(here, '../../../apps/api/provisioning/geostat.provisioning.json')
const prov: any = JSON.parse(readFileSync(provPath, 'utf8'))

// The regional page is the one carrying a `sector` filter + a mode perspective axis.
const regional: any = prov.pages.find(
  (p: any) => p.config?.filterSchema?.bars?.bar?.filters?.sector && p.config?.perspectives?.mode,
)

describe('FF-RANGE-NO-SECTOR — visibility gate', () => {
  const sector = regional.config.filterSchema.bars.bar.filters.sector
  const gate   = sector.visibleWhen as VisibilityExpr

  it('the sector filter declares a perspective-state gate excluding range', () => {
    expect(gate).toEqual({ op: 'perspective-not', perspective: 'range' })
  })

  it('is HIDDEN in range mode and VISIBLE in year mode', () => {
    expect(evalVisibility(gate, {}, { mode: 'range' })).toBe(false)
    expect(evalVisibility(gate, {}, { mode: 'year' })).toBe(true)
  })
})

describe('FF-RANGE-NO-SECTOR — param cleanup on switch', () => {
  const axis: PerspectiveAxis = regional.config.perspectives.mode

  it('switching year→range clears the stale sector param (→ empty, drops from URL)', () => {
    const out = applyPerspectiveEffects(axis, 'mode', 'year', 'range', { sector: 'R5-sector', region: 'R5' })
    expect(out.sector).toBe('')          // cleared → setMany deletes → absent from permalink
  })

  it('does NOT touch sector when staying in year (no spurious clear)', () => {
    const out = applyPerspectiveEffects(axis, 'mode', 'year', 'year', { sector: 'A' })
    expect(out).toEqual({})              // no transition → identity
  })

  it('leaving range (range→year) does not resurrect a sector value', () => {
    const out = applyPerspectiveEffects(axis, 'mode', 'range', 'year', { region: 'R5' })
    expect('sector' in out).toBe(false)  // onExit only clears the span, never sets sector
  })
})
