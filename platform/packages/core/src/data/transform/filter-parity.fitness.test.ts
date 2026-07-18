// ── FF-FILTER-PARITY (core half) — the transform `filter` step resolves every
//  declared FilterValue shape, byte-identically to the store `matchesFilter` predicate.
//
//  Card 0087 FILTER FULL-POWER PARITY. The workbench filter step (authored via the
//  P-OFFER MemberPicker modes: specific · follow «$ctx» · except «$ne» · combined
//  «$ne+$ctx») emits a `{op:'filter', where}` whose values are the SAME FilterValue
//  shapes a legacy query filter carries. The two resolution paths — the pure transform
//  `applyFilter` (pipeline tail) and the store `matchesFilter` (query head) — MUST agree
//  on those shapes, or the "unification" lies (a mode that narrows in one surface and not
//  the other). This fitness pins that agreement.
//
//  The bug it guards: `applyFilter` matched `isCtxRef` (keyed on `$ctx`) BEFORE `$ne`, so
//  a NeCtxRef `{$ne,$ctx}` resolved as a plain equality and DROPPED the exclusion — the
//  transform path silently disagreed with the store predicate. Fixed by matching `$ne`
//  first (mirroring matchesFilter).
//
import { describe, it, expect } from 'vitest'
import { applyFilter } from './steps'
import { matchesFilter } from '../store-filter'
import type { FilterValue } from '../../sdmx'
import type { SectionContext } from '../../core/context'
import type { RawRow, TransformStep } from './types'

type FilterStep = Extract<TransformStep, { op: 'filter' }>

const rows: RawRow[] = [
  { geo: 'GE', sector: 'S1', value: 10 },
  { geo: 'AB', sector: 'S1', value: 20 },
  { geo: '_T', sector: 'S1', value: 30 },
  { geo: 'GE', sector: 'S2', value: 40 },
]

const ctxOf = (dims: Record<string, string>): SectionContext => ({ dims } as SectionContext)

/** Filter `rows` through BOTH paths and assert byte-identical output — the parity invariant. */
function bothPaths(field: string, value: FilterValue, dims: Record<string, string>): RawRow[] {
  const section = ctxOf(dims)
  const step: FilterStep = { op: 'filter', where: { [field]: value } }
  const viaTransform = applyFilter(rows, step, { section })
  const viaStore = rows.filter((r) => matchesFilter(r as Record<string, string | number>, { [field]: value }, section))
  expect(viaTransform).toEqual(viaStore) // the two paths resolve the shape identically
  return viaTransform
}

describe('FF-FILTER-PARITY — filter step ≡ store predicate across every FilterValue shape', () => {
  it('specific — a scalar keeps only exact matches', () => {
    expect(bothPaths('geo', 'GE', {}).map((r) => r.value)).toEqual([10, 40])
  })

  it('specific — an IN-array keeps the union', () => {
    expect(bothPaths('geo', ['GE', 'AB'], {}).map((r) => r.value)).toEqual([10, 20, 40])
  })

  it('follow «$ctx» — resolves the page selection; empty selection = wildcard (all pass)', () => {
    expect(bothPaths('geo', { $ctx: 'geo' }, { geo: 'AB' }).map((r) => r.value)).toEqual([20])
    expect(bothPaths('geo', { $ctx: 'geo' }, { geo: '' }).length).toBe(rows.length) // wildcard
  })

  it('except «$ne» — excludes one member, keeps everything else (incl. tomorrow’s new members)', () => {
    expect(bothPaths('geo', { $ne: '_T' }, {}).map((r) => r.value)).toEqual([10, 20, 40])
  })

  it('combined «$ne + $ctx» (NeCtxRef) — excludes AND restricts to the page selection', () => {
    // exclude _T AND restrict to the page's geo=GE → only the GE rows survive
    expect(bothPaths('geo', { $ne: '_T', $ctx: 'geo' }, { geo: 'GE' }).map((r) => r.value)).toEqual([10, 40])
    // empty page selection → the exclusion still applies (the gap this fix closes)
    expect(bothPaths('geo', { $ne: '_T', $ctx: 'geo' }, { geo: '' }).map((r) => r.value)).toEqual([10, 20, 40])
  })

  it('combined «$ne + $ctx» — the $ctx scope narrows even when it differs from the excluded dim member', () => {
    // exclude AB, restrict geo to the multi-select {GE,_T}: AB dropped by $ne; GE + _T in scope
    expect(bothPaths('geo', { $ne: 'AB', $ctx: 'geo' }, { geo: 'GE,_T' }).map((r) => r.value)).toEqual([10, 30, 40])
  })
})
