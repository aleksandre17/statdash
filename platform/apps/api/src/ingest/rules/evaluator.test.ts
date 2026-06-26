// ── Fitness — DQAF RuleSpec evaluator (pure, no DB) ───────────────────────────
//
// ADR-0031 §4 improvement 3 fitness nets. The evaluator is PURE, so these run with no
// database — green locally, a real gate everywhere. Asserts:
//   · GDP identity row within ε → 0 IDENTITY_MISMATCH.
//   · a deliberately-broken fixture → exactly 1 warn with the offending rows.
//   · balance + totalReconcile kinds.
//   · Law 2: a rule whose params carry a function is REJECTED (surfaced, not dropped).

import { describe, expect, it } from 'vitest'
import { runRules } from './evaluator.js'
import { type RuleSpec, DEFAULT_EPSILON } from './registry.js'
import type { StagedObsRow } from '../types.js'

function obs(
  dimKey: Record<string, string>, obsValue: number | null, rowIndex: number, time = '2010',
): StagedObsRow {
  return { datasetCode: 'GDP_ANNUAL', timePeriod: time, dimKey, obsValue, obsStatus: 'A', rowIndex }
}

const ctx = { submissionId: 'sub-1' }

describe('RuleSpec evaluator — identity (GDP approaches)', () => {
  const rule: RuleSpec = {
    id: 'gdp.identity', kind: 'identity', datasetCode: 'GDP_ANNUAL', severity: 'warn',
    params: { dim: 'approach', approaches: ['B1GQ_P', 'B1GQ_E', 'B1GQ_I'], group: ['geo'], epsilon: DEFAULT_EPSILON },
  }

  it('GDP 2010 identity within ε → 0 IDENTITY_MISMATCH', () => {
    const rows = [
      obs({ approach: 'B1GQ_P', geo: 'GE' }, 24343.0, 1),
      obs({ approach: 'B1GQ_E', geo: 'GE' }, 24343.3, 2), // within 0.5
      obs({ approach: 'B1GQ_I', geo: 'GE' }, 24342.8, 3), // within 0.5
    ]
    expect(runRules([rule], rows, ctx)).toEqual([])
  })

  it('a deliberately-broken identity → exactly 1 warn with the offending rows', () => {
    const rows = [
      obs({ approach: 'B1GQ_P', geo: 'GE' }, 24343.0, 1),
      obs({ approach: 'B1GQ_E', geo: 'GE' }, 24999.0, 2), // > ε off
      obs({ approach: 'B1GQ_I', geo: 'GE' }, 24342.8, 3),
    ]
    const issues = runRules([rule], rows, ctx)
    expect(issues).toHaveLength(1)
    expect(issues[0].code).toBe('IDENTITY_MISMATCH')
    expect(issues[0].severity).toBe('warn')
    expect(issues[0].detail.offendingRows).toEqual(expect.arrayContaining([1, 2, 3]))
  })

  it('groups independently — one region off does not flag a clean region', () => {
    const rows = [
      obs({ approach: 'B1GQ_P', geo: 'GE' }, 100, 1), obs({ approach: 'B1GQ_E', geo: 'GE' }, 100.2, 2),
      obs({ approach: 'B1GQ_P', geo: 'AB' }, 50, 3), obs({ approach: 'B1GQ_E', geo: 'AB' }, 99, 4),
    ]
    const issues = runRules([rule], rows, ctx)
    expect(issues).toHaveLength(1)
    expect(issues[0].detail.group).toContain('geo=AB')
  })
})

describe('RuleSpec evaluator — balance', () => {
  const rule: RuleSpec = {
    id: 'acct.balance', kind: 'balance', datasetCode: 'ACCOUNTS_SEQUENCE', severity: 'warn',
    params: { dim: 'side', lhs: ['U'], rhs: ['R'], group: ['account'], epsilon: 0.5 },
  }
  it('balanced sides within ε → no issue', () => {
    const rows = [obs({ side: 'U', account: 'B9' }, 10, 1), obs({ side: 'R', account: 'B9' }, 10.3, 2)]
    expect(runRules([rule], rows, ctx)).toEqual([])
  })
  it('unbalanced sides → BALANCE_MISMATCH with both rows', () => {
    const rows = [obs({ side: 'U', account: 'B9' }, 10, 1), obs({ side: 'R', account: 'B9' }, 25, 2)]
    const issues = runRules([rule], rows, ctx)
    expect(issues).toHaveLength(1)
    expect(issues[0].code).toBe('BALANCE_MISMATCH')
    expect(issues[0].detail.offendingRows).toEqual(expect.arrayContaining([1, 2]))
  })
})

describe('RuleSpec evaluator — totalReconcile', () => {
  const rule: RuleSpec = {
    id: 'gva.total', kind: 'totalReconcile', datasetCode: 'REGIONAL_GVA', severity: 'warn',
    params: { dim: 'sector', total: '_T', epsilon: 0.5 },
  }
  it('parts sum to the total within ε → no issue', () => {
    const rows = [
      obs({ sector: 'A' }, 10, 1), obs({ sector: 'B' }, 11.7, 2), obs({ sector: '_T' }, 21.5, 3),
    ]
    expect(runRules([rule], rows, ctx)).toEqual([])
  })
  it('parts do not reconcile → TOTAL_RECONCILE', () => {
    const rows = [
      obs({ sector: 'A' }, 10, 1), obs({ sector: 'B' }, 11.7, 2), obs({ sector: '_T' }, 50, 3),
    ]
    const issues = runRules([rule], rows, ctx)
    expect(issues).toHaveLength(1)
    expect(issues[0].code).toBe('TOTAL_RECONCILE')
  })
})

describe('RuleSpec evaluator — Law 2 (pure data only)', () => {
  it('a rule whose params carry a function is REJECTED (surfaced, not silently dropped)', () => {
    const bad = {
      id: 'evil', kind: 'identity', datasetCode: 'X', severity: 'warn',
      params: { dim: 'approach', approaches: ['a', 'b'], evil: () => 1 },
    } as unknown as RuleSpec
    const issues = runRules([bad], [], ctx)
    expect(issues).toHaveLength(1)
    expect(issues[0].detail.rejected).toMatch(/function/)
  })
})
