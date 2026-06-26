// ── Fitness — canonical route version-aware DSD input builders (pure, no DB) ───
//
// ADR-0031 §4 improvement 5. These builders are PURE, so the precedence + shaping
// invariants are locked with zero database:
//   · resolveDeclaredVersion — query param WINS over header WINS over STRUCTURE row;
//     blank/whitespace is absent (Postel); none ⇒ undefined (the gate holds).
//   · declaredSnapshot — carries the resolved version so compat.ts flips the DSD gate.
//   · buildMintPlan — the FULL ordered series key (Law-1 STRUCTURE order), time flagged.

import { describe, expect, it } from 'vitest'
import type { CanonicalDsd } from '../../ingest/canonical/types.js'
import type { RawClassifierRow } from '../../ingest/index.js'
import {
  resolveDeclaredVersion, declaredSnapshot, buildMintPlan,
} from './canonical-dsd-inputs.js'

const baseDsd = (meta: Record<string, string> = {}): CanonicalDsd => ({
  datasetCode: 'GDP_ANNUAL',
  name: { en: 'GDP' },
  dimensions: ['time', 'approach', 'measure', 'geo'],
  measureConcept: 'OBS_VALUE',
  meta,
  codelistRefs: {},
})

const classifier = (dimCode: string, code: string, label: Record<string, string> = { en: code }): RawClassifierRow => ({
  dimCode, code, label, ord: 0, metadata: {}, rowIndex: 0,
})

describe('resolveDeclaredVersion — precedence (query wins)', () => {
  it('query param wins over header and STRUCTURE row', () => {
    expect(resolveDeclaredVersion(baseDsd({ dataset_version: 's' }), 'q', 'h')).toBe('q')
  })
  it('header wins over STRUCTURE row when no query param', () => {
    expect(resolveDeclaredVersion(baseDsd({ dataset_version: 's' }), undefined, 'h')).toBe('h')
  })
  it('falls back to the STRUCTURE dataset_version row', () => {
    expect(resolveDeclaredVersion(baseDsd({ dataset_version: 's' }), undefined, undefined)).toBe('s')
  })
  it('none declared ⇒ undefined (the unversioned gate holds)', () => {
    expect(resolveDeclaredVersion(baseDsd(), undefined, undefined)).toBeUndefined()
  })
  it('blank/whitespace is treated as absent (Postel)', () => {
    expect(resolveDeclaredVersion(baseDsd({ dataset_version: '  ' }), '   ', '')).toBeUndefined()
  })
})

describe('declaredSnapshot — carries dims/measure/members + version', () => {
  it('threads the resolved version so compat flips the DSD gate', () => {
    const snap = declaredSnapshot(baseDsd(), [classifier('geo', 'GE'), classifier('geo', 'AB')], 'v2')
    expect(snap.datasetVersion).toBe('v2')
    expect(snap.dimensions).toEqual(['time', 'approach', 'measure', 'geo'])
    expect(snap.measureConcept).toBe('OBS_VALUE')
    expect(snap.members.geo).toEqual(['GE', 'AB'])
  })
  it('no version ⇒ undefined datasetVersion (unversioned path)', () => {
    expect(declaredSnapshot(baseDsd(), [], undefined).datasetVersion).toBeUndefined()
  })
})

describe('buildMintPlan — the full ordered series key', () => {
  it('emits dims in STRUCTURE order with time flagged + ord set', () => {
    const plan = buildMintPlan(baseDsd(), [classifier('approach', 'B1GQ_P', { ka: 'მ', en: 'Approach' })], 'v2')
    expect(plan.datasetCode).toBe('GDP_ANNUAL')
    expect(plan.datasetVersion).toBe('v2')
    expect(plan.dimensions).toEqual([
      { dimCode: 'time', ord: 0, isTimeDim: true },
      { dimCode: 'approach', ord: 1, isTimeDim: false },
      { dimCode: 'measure', ord: 2, isTimeDim: false },
      { dimCode: 'geo', ord: 3, isTimeDim: false },
    ])
    // The axis fallback label is harvested from the first classifier row per dim.
    expect(plan.dimLabels?.approach).toEqual({ ka: 'მ', en: 'Approach' })
  })
})
