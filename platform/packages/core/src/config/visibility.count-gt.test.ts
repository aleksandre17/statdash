// ── count-gt — selection-cardinality visibility leaf ──────────────────────────
//
//  The op that lets config say "this node hides when MORE than n members are
//  picked in a param's OR-set" (e.g. the regional-comparison section vanishing
//  when >1 region AND a sector are selected — pure declaration, no renderer if).
//  Proves: both OR-set encodings count identically (CSV ctx string / decoded
//  string[]), unset ⇒ 0, boundary is STRICTLY greater-than, composition with
//  and/isset works, and extractDeps registers the param for exact invalidation.
//
import { describe, it, expect } from 'vitest'
import { evalVisibility, type VisibilityExpr } from './visibility'
import { extractDeps } from '../graph/extractDeps'

const moreThanOneGeo: VisibilityExpr = { op: 'count-gt', param: 'geo', n: 1 }

describe('count-gt — evalVisibility semantics', () => {
  it('counts a CSV OR-set string (the ctx convention, splitMultiValue SSOT)', () => {
    expect(evalVisibility(moreThanOneGeo, { geo: 'R2,R3' })).toBe(true)
    expect(evalVisibility(moreThanOneGeo, { geo: 'R2' })).toBe(false)
    // Whitespace/empty members never inflate the count (SSOT decode, not naive split).
    expect(evalVisibility(moreThanOneGeo, { geo: 'R2, ,' })).toBe(false)
  })

  it('counts an already-decoded string[] (the typed filter-eval shape) identically', () => {
    expect(evalVisibility(moreThanOneGeo, { geo: ['R2', 'R3'] })).toBe(true)
    expect(evalVisibility(moreThanOneGeo, { geo: ['R2'] })).toBe(false)
    expect(evalVisibility(moreThanOneGeo, { geo: [] })).toBe(false)
  })

  it('unset / empty selection counts as 0', () => {
    expect(evalVisibility(moreThanOneGeo, {})).toBe(false)
    expect(evalVisibility(moreThanOneGeo, { geo: '' })).toBe(false)
    expect(evalVisibility(moreThanOneGeo, { geo: null })).toBe(false)
  })

  it('is STRICTLY greater-than (n=2: three members pass, two do not)', () => {
    const gt2: VisibilityExpr = { op: 'count-gt', param: 'geo', n: 2 }
    expect(evalVisibility(gt2, { geo: 'R1,R2,R3' })).toBe(true)
    expect(evalVisibility(gt2, { geo: 'R1,R2' })).toBe(false)
  })

  it('composes: NOT(multi-region AND sector set) — the section-hiding gate', () => {
    const gate: VisibilityExpr = {
      op: 'not',
      expr: { op: 'and', exprs: [moreThanOneGeo, { op: 'isset', param: 'sector' }] },
    }
    // >1 region + a sector picked ⇒ hidden
    expect(evalVisibility(gate, { geo: 'R2,R3', sector: 'C' })).toBe(false)
    // one region + a sector ⇒ visible
    expect(evalVisibility(gate, { geo: 'R2', sector: 'C' })).toBe(true)
    // >1 region, NO sector ⇒ visible
    expect(evalVisibility(gate, { geo: 'R2,R3' })).toBe(true)
  })
})

describe('count-gt — extractDeps registers the param (exact invalidation)', () => {
  it('a visibleWhen count-gt param lands in the params deps', () => {
    const deps = extractDeps({
      type: 'section',
      view: { visibleWhen: { op: 'count-gt', param: 'geo', n: 1 } },
    })
    expect(deps.params.has('geo')).toBe(true)
  })
})
