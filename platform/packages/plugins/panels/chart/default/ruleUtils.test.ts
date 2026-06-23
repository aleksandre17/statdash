// @vitest-environment node
//
// ruleUtils.test.ts — pure unit tests for evaluateRules.
// No React, no store, no SectionContext.
//

import { describe, it, expect } from 'vitest'
import { evaluateRules }        from './ruleUtils'
import type { ThresholdRule, RuleDiagnostic } from './ruleUtils'
import type { EngineRow } from '@statdash/engine'

// ── Helpers ────────────────────────────────────────────────────────────

function row(value: number, field = 'value'): EngineRow {
  return { [field]: value }
}

function rule(
  op: ThresholdRule['op'],
  value: number,
  field = 'value',
): ThresholdRule {
  return { field, op, value, severity: 'warning', label: `${field} ${op} ${value}` }
}

// ── No rows ────────────────────────────────────────────────────────────

describe('evaluateRules — no rows', () => {
  it('returns empty array when rows is empty', () => {
    const result = evaluateRules([rule('gt', 10)], [])
    expect(result).toEqual([])
  })

  it('returns empty array when both rules and rows are empty', () => {
    expect(evaluateRules([], [])).toEqual([])
  })
})

// ── No rules ──────────────────────────────────────────────────────────

describe('evaluateRules — no rules', () => {
  it('returns empty array when rules is empty', () => {
    expect(evaluateRules([], [row(100)])).toEqual([])
  })
})

// ── gt ────────────────────────────────────────────────────────────────

describe('gt operator', () => {
  it('fires when row value strictly greater than threshold', () => {
    expect(evaluateRules([rule('gt', 10)], [row(11)])).toHaveLength(1)
  })

  it('does NOT fire when row value equals threshold (strict)', () => {
    expect(evaluateRules([rule('gt', 10)], [row(10)])).toHaveLength(0)
  })

  it('does NOT fire when row value is less than threshold', () => {
    expect(evaluateRules([rule('gt', 10)], [row(9)])).toHaveLength(0)
  })

  it('fires when ANY row satisfies the condition', () => {
    expect(evaluateRules([rule('gt', 10)], [row(5), row(15)])).toHaveLength(1)
  })
})

// ── gte ───────────────────────────────────────────────────────────────

describe('gte operator', () => {
  it('fires when row value equals threshold', () => {
    expect(evaluateRules([rule('gte', 10)], [row(10)])).toHaveLength(1)
  })

  it('fires when row value exceeds threshold', () => {
    expect(evaluateRules([rule('gte', 10)], [row(11)])).toHaveLength(1)
  })

  it('does NOT fire when row value is below threshold', () => {
    expect(evaluateRules([rule('gte', 10)], [row(9)])).toHaveLength(0)
  })
})

// ── lt ────────────────────────────────────────────────────────────────

describe('lt operator', () => {
  it('fires when row value strictly less than threshold', () => {
    expect(evaluateRules([rule('lt', 10)], [row(9)])).toHaveLength(1)
  })

  it('does NOT fire when row value equals threshold (strict)', () => {
    expect(evaluateRules([rule('lt', 10)], [row(10)])).toHaveLength(0)
  })

  it('does NOT fire when row value exceeds threshold', () => {
    expect(evaluateRules([rule('lt', 10)], [row(11)])).toHaveLength(0)
  })
})

// ── lte ───────────────────────────────────────────────────────────────

describe('lte operator', () => {
  it('fires when row value equals threshold', () => {
    expect(evaluateRules([rule('lte', 10)], [row(10)])).toHaveLength(1)
  })

  it('fires when row value is below threshold', () => {
    expect(evaluateRules([rule('lte', 10)], [row(9)])).toHaveLength(1)
  })

  it('does NOT fire when row value exceeds threshold', () => {
    expect(evaluateRules([rule('lte', 10)], [row(11)])).toHaveLength(0)
  })
})

// ── eq ────────────────────────────────────────────────────────────────

describe('eq operator', () => {
  it('fires when row value equals threshold', () => {
    expect(evaluateRules([rule('eq', 42)], [row(42)])).toHaveLength(1)
  })

  it('does NOT fire when row value does not equal threshold', () => {
    expect(evaluateRules([rule('eq', 42)], [row(43)])).toHaveLength(0)
  })
})

// ── neq ───────────────────────────────────────────────────────────────

describe('neq operator', () => {
  it('fires when row value does not equal threshold', () => {
    expect(evaluateRules([rule('neq', 42)], [row(99)])).toHaveLength(1)
  })

  it('does NOT fire when row value equals threshold', () => {
    expect(evaluateRules([rule('neq', 42)], [row(42)])).toHaveLength(0)
  })
})

// ── Multiple rules ────────────────────────────────────────────────────

describe('multiple rules', () => {
  it('emits one diagnostic per fired rule', () => {
    const rules: ThresholdRule[] = [
      { field: 'value', op: 'gt',  value: 10, severity: 'error',   label: 'Too high' },
      { field: 'value', op: 'lt',  value: 5,  severity: 'warning', label: 'Too low'  },
    ]
    // value=15: gt 10 fires, lt 5 does not
    const result = evaluateRules(rules, [row(15)])
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('Too high')
    expect(result[0].severity).toBe('error')
  })

  it('emits multiple diagnostics when multiple rules fire', () => {
    const rules: ThresholdRule[] = [
      { field: 'value', op: 'gt',  value: 0, severity: 'warning', label: 'Positive' },
      { field: 'value', op: 'lt',  value: 5, severity: 'info',    label: 'Below 5'  },
    ]
    // value=3: both gt 0 and lt 5 fire
    const result = evaluateRules(rules, [row(3)])
    expect(result).toHaveLength(2)
  })

  it('emits no diagnostics when no rules fire', () => {
    const rules: ThresholdRule[] = [
      { field: 'value', op: 'gt', value: 100, severity: 'error', label: 'Very high' },
    ]
    expect(evaluateRules(rules, [row(50)])).toHaveLength(0)
  })
})

// ── Field targeting ───────────────────────────────────────────────────

describe('custom field', () => {
  it('evaluates the named field on the row', () => {
    const r: ThresholdRule = { field: 'pct', op: 'gt', value: 80, severity: 'warning', label: 'High share' }
    const rows: EngineRow[] = [{ pct: 90, value: 1000 }]
    expect(evaluateRules([r], rows)).toHaveLength(1)
  })

  it('ignores rows missing the target field', () => {
    const r: ThresholdRule = { field: 'pct', op: 'gt', value: 80, severity: 'warning', label: 'High share' }
    const rows: EngineRow[] = [{ value: 1000 }]
    expect(evaluateRules([r], rows)).toHaveLength(0)
  })
})

// ── Diagnostic shape ──────────────────────────────────────────────────

describe('diagnostic shape', () => {
  it('emitted diagnostic carries correct severity and label', () => {
    const r: ThresholdRule = { field: 'value', op: 'gt', value: 5, severity: 'info', label: 'Above target' }
    const result = evaluateRules([r], [row(10)])
    const d: RuleDiagnostic = result[0]
    expect(d.severity).toBe('info')
    expect(d.label).toBe('Above target')
  })
})
