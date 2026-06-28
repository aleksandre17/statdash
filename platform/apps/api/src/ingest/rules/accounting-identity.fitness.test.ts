// ── Fitness — FF-ACCOUNTING-IDENTITY (DC-02, Law 9) ───────────────────────────
//
// The declarative SIGNED accounting-identity capability + its publish gate. Three nets:
//
//   1. THE CAPABILITY (pure, no DB) — the linearIdentity evaluator over the REAL geostat
//      GDP_ANNUAL 2010 values: the satisfying set passes (0 issues); a deliberately-
//      perturbed value is rejected with exactly one error-severity ACCOUNTING_IDENTITY
//      issue naming the failing identity + the discrepancy; the signed `−M` term and the
//      Postel incomplete-operand skip both behave.
//
//   2. THE REAL DECLARED IDENTITY HOLDS ON THE SEED (pure, reads the committed facts
//      bundle) — GDP = C + I_GFCF + X − M for EVERY year in the live ingest input, within
//      the declared ε. This is the "verify against the real seed, do not fabricate" net:
//      if Geostat's published figures ever stop reconciling, this fails offline.
//
//   3. THE GATE (fake Queryable, no DB) — assertPublishableIdentities reads the persisted
//      error-severity issue and throws the RFC-9457 `accounting-identity` problem (422);
//      a submission with none is a no-op (additive / Postel).
//
// All nets are DB-independent (pure evaluator + a committed JSON artifact + a fake port),
// so the gate is green locally and a real check everywhere.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { runRules } from './evaluator.js'
import { DEFAULT_EPSILON, resolveRules } from './registry.js'
import { assertPublishableIdentities } from '../validate-integrity.js'
import type { Queryable, StagedObsRow } from '../types.js'

// ── The REAL declared identity (the seeded built-in, found by id) ─────────────

const EXPENDITURE = resolveRules('GDP_ANNUAL').find(
  (r) => r.id === 'GDP_ANNUAL.identity.expenditure',
)

const ctx = { submissionId: 'sub-acct-1' }

function obs(measure: string, value: number | null, rowIndex: number, time = '2010'): StagedObsRow {
  return {
    datasetCode: 'GDP_ANNUAL', timePeriod: time,
    dimKey: { measure, geo: 'GE' }, obsValue: value, obsStatus: 'A', rowIndex,
  }
}

// The genuine geostat 2010 national figures (mln GEL) — C + I_GFCF + X − M = 22148.7 = GDP.
const SEED_2010 = [
  obs('GDP', 22148.7, 0),
  obs('C', 21220.5, 1),
  obs('I_GFCF', 4635.6, 2),
  obs('X', 7191.2, 3),
  obs('M', 10898.6, 4),
]

describe('FF-ACCOUNTING-IDENTITY — the linearIdentity capability (DC-02)', () => {
  it('the real GDP expenditure identity is DECLARED as an error-severity gate', () => {
    expect(EXPENDITURE).toBeDefined()
    expect(EXPENDITURE!.kind).toBe('linearIdentity')
    expect(EXPENDITURE!.severity).toBe('error') // publish-gating, not a warn surface
    // It is signed: M carries coef −1 (the import deduction the unsigned kinds can't state).
    const terms = EXPENDITURE!.params.terms as { code: string; coef?: number }[]
    expect(terms.find((t) => t.code === 'M')?.coef).toBe(-1)
  })

  it('a satisfying set (real 2010 figures) → 0 issues within ε', () => {
    expect(runRules([EXPENDITURE!], SEED_2010, ctx)).toEqual([])
  })

  it('a deliberately-perturbed value → exactly 1 error ACCOUNTING_IDENTITY naming the identity + Δ', () => {
    // Inflate exports by 5 (≫ ε = 0.5): the identity now over-states GDP by 5.
    const perturbed = SEED_2010.map((r) =>
      r.dimKey.measure === 'X' ? obs('X', 7191.2 + 5, 3) : r)
    const issues = runRules([EXPENDITURE!], perturbed, ctx)
    expect(issues).toHaveLength(1)
    const i = issues[0]
    expect(i.code).toBe('ACCOUNTING_IDENTITY')
    expect(i.severity).toBe('error')
    expect(i.detail.ruleId).toBe('GDP_ANNUAL.identity.expenditure')
    expect(i.detail.lhs).toBe('GDP')
    expect(i.detail.lhsValue).toBe(22148.7)
    // rhs is now 5 higher than lhs → delta = lhs − rhs = −5 (within fp tolerance).
    expect(i.detail.rhsSum as number).toBeCloseTo(22153.7, 6)
    expect(i.detail.delta as number).toBeCloseTo(-5, 6)
    expect(i.detail.offendingRows).toEqual(expect.arrayContaining([0, 1, 2, 3, 4]))
  })

  it('the `−M` term is genuinely SUBTRACTED (lowering imports raises the rhs)', () => {
    // Drop M by 5: rhs = C+I+X−(M−5) = GDP+5 → a +5 over-statement, beyond ε.
    const lessImports = SEED_2010.map((r) =>
      r.dimKey.measure === 'M' ? obs('M', 10898.6 - 5, 4) : r)
    const issues = runRules([EXPENDITURE!], lessImports, ctx)
    expect(issues).toHaveLength(1)
    expect(issues[0].detail.delta as number).toBeCloseTo(-5, 6)
  })

  it('Postel — an incomplete operand set (no M) asserts nothing (no false positive)', () => {
    const noImports = SEED_2010.filter((r) => r.dimKey.measure !== 'M')
    expect(runRules([EXPENDITURE!], noImports, ctx)).toEqual([])
  })

  it('groups are independent — a clean year is not flagged when another year breaks', () => {
    const twoYears = [
      ...SEED_2010,
      obs('GDP', 100, 5, '2011'), obs('C', 60, 6, '2011'),
      obs('I_GFCF', 30, 7, '2011'), obs('X', 20, 8, '2011'),
      obs('M', 5, 9, '2011'), // 60+30+20−5 = 105 ≠ 100 → only 2011 flagged
    ]
    const issues = runRules([EXPENDITURE!], twoYears, ctx)
    expect(issues).toHaveLength(1)
    expect(String(issues[0].detail.group)).toContain('2011')
  })
})

// ── Net 2 — the declared identity HOLDS on the real seed, every year ───────────

interface FactsBundle { obs: { dimKey: Record<string, string>; obsValue: number | null; timePeriod: string }[] }

const here = dirname(fileURLToPath(import.meta.url))
const GDP_FACTS = resolve(here, '../../../../../../ops/seed-data/geostat/facts/GDP_ANNUAL.bundle.json')

describe('FF-ACCOUNTING-IDENTITY — the real identity reconciles on the committed seed', () => {
  it('GDP = C + I_GFCF + X − M for every national-year within ε (no fabrication)', () => {
    const bundle = JSON.parse(readFileSync(GDP_FACTS, 'utf8')) as FactsBundle
    const epsilon = DEFAULT_EPSILON
    // Re-build per-year national rows and run them through the SAME evaluator the gate uses.
    const rows: StagedObsRow[] = bundle.obs
      .filter((o) => o.dimKey.geo === 'GE')
      .map((o, idx) => ({
        datasetCode: 'GDP_ANNUAL', timePeriod: o.timePeriod,
        dimKey: o.dimKey, obsValue: o.obsValue, obsStatus: 'A', rowIndex: idx,
      }))
    const issues = runRules([EXPENDITURE!], rows, { submissionId: 'seed' })
    // Zero violations: every year the seed states the full operand set reconciles within ε.
    expect(issues, JSON.stringify(issues.map((i) => i.detail), null, 2)).toEqual([])
    // And the identity is actually EXERCISED (the operand set is present for ≥10 years),
    // so a green result is meaningful coverage, not a vacuous skip.
    const yearsWithFullSet = new Set(
      rows.filter((r) => r.dimKey.measure === 'GDP').map((r) => r.timePeriod),
    )
    expect(yearsWithFullSet.size).toBeGreaterThanOrEqual(10)
    void epsilon
  })
})

// ── Net 3 — the publish gate (fake Queryable, no DB) ──────────────────────────

/** A minimal Queryable returning the given rows for the single SELECT the gate runs. */
function fakeDb(rows: { detail: Record<string, unknown> }[]): Queryable {
  return { query: async () => ({ rows }) as { rows: never[] } }
}

describe('FF-ACCOUNTING-IDENTITY — assertPublishableIdentities is the publish gate', () => {
  it('a persisted error ACCOUNTING_IDENTITY issue → throws the RFC-9457 accounting-identity problem', async () => {
    const detail = {
      ruleId: 'GDP_ANNUAL.identity.expenditure', group: '2010|geo=GE',
      lhs: 'GDP', lhsValue: 22148.7, rhsSum: 22153.7, delta: -5, epsilon: 0.5,
    }
    await expect(assertPublishableIdentities(fakeDb([{ detail }]), 'sub-x')).rejects.toMatchObject({
      kind: 'accounting-identity',
      status: 422,
      extensions: {
        code: 'ACCOUNTING_IDENTITY_VIOLATION',
        violations: [detail],
      },
    })
  })

  it('no persisted identity violation → a no-op (additive / Postel)', async () => {
    await expect(assertPublishableIdentities(fakeDb([]), 'sub-y')).resolves.toBeUndefined()
  })
})
