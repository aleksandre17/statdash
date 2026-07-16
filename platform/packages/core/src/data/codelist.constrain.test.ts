// ── constrainClassifier — SDMX CubeRegion scoping of a codelist ──────────
//
//  Contract under test (the seam the per-dataset store builder scopes wire-dim
//  classifiers through — see plugins/datasources/stats-registrations.ts):
//    • keeps ONLY the given members … plus every ANCESTOR on their parent
//      chains (hierarchy integrity: no dangling parent edges),
//    • preserves the classifier FORM (array↔record) and the member ORDER,
//    • is pure and cycle-safe.
//
//  The motivating defect: a dim code is a SHARED vocabulary axis, so the
//  dim-global codelist can carry TWO datasets' vocabularies at once; the
//  regional sector filter then listed every category twice. The constraint is
//  the generic fix: a store exposes only the members of ITS cube region.

import { describe, it, expect } from 'vitest'
import { constrainClassifier, childrenOf } from './codelist'
import type { Classifier, ClassifierEntry } from '../sdmx'

// Two vocabularies under one dim — the live-defect shape (short + foreign).
const arrayForm: ClassifierEntry[] = [
  { code: '_T',    parent: undefined },
  { code: 'AGRI',  parent: '_T' },
  { code: 'MANUF', parent: '_T' },
  { code: '1',     parent: '_T' },   // foreign vocabulary
  { code: '3',     parent: '_T' },   // foreign vocabulary
]

describe('constrainClassifier', () => {
  it('keeps only the given members (plus ancestors) — the foreign vocabulary drops', () => {
    const out = constrainClassifier(arrayForm, new Set(['AGRI', 'MANUF'])) as ClassifierEntry[]
    expect(out.map((e) => e.code)).toEqual(['_T', 'AGRI', 'MANUF'])
  })

  it('preserves member order and returns the same (array) form', () => {
    const out = constrainClassifier(arrayForm, new Set(['MANUF', 'AGRI', '_T']))
    expect(Array.isArray(out)).toBe(true)
    expect((out as ClassifierEntry[]).map((e) => e.code)).toEqual(['_T', 'AGRI', 'MANUF'])
  })

  it('keeps the full ancestor CHAIN of a deep member (no dangling parent edge)', () => {
    const deep: ClassifierEntry[] = [
      { code: 'ROOT' },
      { code: 'MID',  parent: 'ROOT' },
      { code: 'LEAF', parent: 'MID' },
      { code: 'OTHER' },
    ]
    const out = constrainClassifier(deep, new Set(['LEAF'])) as ClassifierEntry[]
    expect(out.map((e) => e.code)).toEqual(['ROOT', 'MID', 'LEAF'])
    // roll-up reads stay coherent on the constrained classifier
    expect(childrenOf(out, 'ROOT')).toEqual(['MID'])
  })

  it('record form in → record form out (surrogate-id parents resolve)', () => {
    const record: Classifier = {
      '10': { code: '_T' },
      '11': { code: 'AGRI', parent: '10' },   // parent = surrogate id
      '12': { code: '1',    parent: '10' },
    }
    const out = constrainClassifier(record, new Set(['AGRI'])) as Record<string, ClassifierEntry>
    expect(Object.values(out).map((e) => e.code).sort()).toEqual(['AGRI', '_T'])
  })

  it('is cycle-safe (malformed parent loop terminates)', () => {
    const cyclic: ClassifierEntry[] = [
      { code: 'A', parent: 'B' },
      { code: 'B', parent: 'A' },
      { code: 'C' },
    ]
    const out = constrainClassifier(cyclic, new Set(['A'])) as ClassifierEntry[]
    expect(out.map((e) => e.code)).toEqual(['A', 'B'])
  })

  it('empty member set yields an empty classifier (caller owns the fail-open guard)', () => {
    expect(constrainClassifier(arrayForm, new Set())).toEqual([])
  })
})
