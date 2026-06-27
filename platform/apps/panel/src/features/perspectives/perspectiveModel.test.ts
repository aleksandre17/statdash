// ── perspectiveModel — record⇄list round-trip + add/edit/reorder [P-final] ─────
//
//  FF-PERSPECTIVE-ROUNDTRIP (panel): the editor-boundary adapter for the
//  PerspectivesPane is LOSSLESS — a PerspectivesByParam authored through the pane
//  (record⇄ordered list⇄record) round-trips BYTE-IDENTICAL when unedited, order is
//  preserved on reorder (perspectives[0] = the default SSOT), and add/edit/remove
//  rebuild the Record without touching any OTHER axis. This is the panel half of the
//  §1 data-flow invariant (author = stored = served = rendered); the engine half is
//  the core FF-VIEW-ROUNDTRIP (JSON.parse(JSON.stringify) identity).
//
//  The fixture exercises EVERY authored facet so the round-trip proves the full
//  PerspectiveDef survives, not just the scalars: a single-period `pin` timeBinding,
//  a from/to window `targetKeys` timeBinding, a `scope.metric` ref, an explicit
//  `when` override, an `available` D-GUARD, and an `icon` — i.e. the whole authored
//  surface the pane writes.
//
import { describe, it, expect } from 'vitest'
import type { PerspectivesByParam, PerspectiveDef } from '@statdash/engine'
import {
  toAxisViews, setAxisPerspectives, toAxis, movePerspective,
} from './perspectiveModel'

// A realistic two-perspective axis: `year` (pin) + `range` (window + metric + guard).
const year: PerspectiveDef = {
  id:    'year',
  label: { ka: 'წლიური', en: 'Year' },
  icon:  'calendar',
  scope: { timeBinding: { dim: 'time', pin: { $ctx: 'year' } } },
}
const range: PerspectiveDef = {
  id:    'range',
  label: { ka: 'დინამიკა', en: 'Range' },
  icon:  'trending-up',
  scope: {
    timeBinding: { dim: 'time', targetKeys: { from: 'fromYear', to: 'toYear' } },
    metric:      'b1g-cagr',
  },
  when:      { op: 'perspective-is', perspective: 'range' },
  available: { op: 'isset', param: 'toYear' },
}

const by: PerspectivesByParam = {
  perspective: { perspectives: [year, range] },
  // A SECOND axis (D-MULTIAXIS) — must survive untouched when the first is edited.
  navMode: { perspectives: [{ id: 'overview', label: { ka: 'მიმოხილვა', en: 'Overview' } }] },
}

describe('perspectiveModel — record⇄list adapters (P-final)', () => {
  it('projects a PerspectivesByParam to ordered axis views (param carried, order kept)', () => {
    const views = toAxisViews(by)
    expect(views.map((v) => v.param)).toEqual(['perspective', 'navMode'])
    expect(views[0].perspectives.map((p) => p.id)).toEqual(['year', 'range'])
  })

  it('FF-PERSPECTIVE-ROUNDTRIP: unedited axis round-trips byte-identical (lossless)', () => {
    const views = toAxisViews(by)
    let rebuilt = by
    for (const v of views) rebuilt = setAxisPerspectives(rebuilt, v.param, v.perspectives)
    expect(rebuilt).toEqual(by)
    // The whole authored surface survives (pin / targetKeys / metric / when / available / icon).
    expect(rebuilt.perspective.perspectives[1]).toEqual(range)
  })

  it('the JSON is declarative — survives JSON.parse(JSON.stringify) identity (Law 2)', () => {
    // No functions anywhere: the authored axis is pure JSON (Constructor-ready).
    expect(JSON.parse(JSON.stringify(by))).toEqual(by)
  })

  it('toAxis wraps an ordered list into a PerspectiveAxis', () => {
    expect(toAxis([year])).toEqual({ perspectives: [year] })
  })

  it('add appends a perspective to one axis and leaves other axes untouched', () => {
    const extra: PerspectiveDef = { id: 'compare', label: { ka: 'შედარება', en: 'Compare' } }
    const next = setAxisPerspectives(by, 'perspective', [year, range, extra])
    expect(next.perspective.perspectives.map((p) => p.id)).toEqual(['year', 'range', 'compare'])
    expect(next.navMode).toEqual(by.navMode)   // the other axis is untouched
  })

  it('reorder changes the default (perspectives[0]) and is preserved in the rebuild', () => {
    const reordered = movePerspective([year, range], 1, 0) // range first → range is default
    expect(reordered.map((p) => p.id)).toEqual(['range', 'year'])
    const next = setAxisPerspectives(by, 'perspective', reordered)
    expect(next.perspective.perspectives[0].id).toBe('range')
  })

  it('movePerspective is bounds-safe (no-op out of range)', () => {
    expect(movePerspective([year], 0, -1)).toEqual([year])
    expect(movePerspective([year], 0, 5)).toEqual([year])
  })

  it('edit replaces one perspective without disturbing siblings or other axes', () => {
    const edited = [{ ...year, icon: 'clock' }, range]
    const next = setAxisPerspectives(by, 'perspective', edited)
    expect(next.perspective.perspectives[0].icon).toBe('clock')
    expect(next.perspective.perspectives[1]).toEqual(range)
    expect(next.navMode).toEqual(by.navMode)
  })

  it('remove drops one perspective and preserves the rest', () => {
    const next = setAxisPerspectives(by, 'perspective', [year])
    expect(next.perspective.perspectives.map((p) => p.id)).toEqual(['year'])
  })

  it('tolerates an undefined record (no axes yet)', () => {
    expect(toAxisViews(undefined)).toEqual([])
  })
})
