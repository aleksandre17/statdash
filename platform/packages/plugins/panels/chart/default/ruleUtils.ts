// ── ThresholdRule evaluation — chart plugin local ─────────────────────
//
//  Evaluates ThresholdRule[] against EngineRow[] and emits RuleDiagnostic[].
//  A RuleDiagnostic is a UI-display concern (chart-local), distinct from the
//  engine's Diagnostic type (machine-readable error/warning/info for the
//  engine boundary).
//
//  Chart-plugin-local types: do NOT export from @statdash/engine.
//  Dep arrow: plugins → engine (correct; imports EngineRow from engine).
//

import type { EngineRow } from '@statdash/engine'

// ── Types ─────────────────────────────────────────────────────────────

export type ThresholdOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq'

export interface ThresholdRule {
  /** Which field to evaluate */
  field:    string
  /** Comparison operator */
  op:       ThresholdOperator
  /** Threshold value */
  value:    number
  /** Severity of the diagnostic when rule is triggered */
  severity: 'error' | 'warning' | 'info'
  /** Human-readable label shown in the badge */
  label:    string
}

/**
 * Chart-local rule diagnostic — UI display concern.
 * Distinct from @statdash/engine Diagnostic (machine-readable engine boundary type).
 */
export interface RuleDiagnostic {
  severity: 'error' | 'warning' | 'info'
  label:    string
}

// ── Operator evaluation ───────────────────────────────────────────────

function evalOp(rowVal: number, op: ThresholdOperator, threshold: number): boolean {
  switch (op) {
    case 'gt':  return rowVal >   threshold
    case 'gte': return rowVal >=  threshold
    case 'lt':  return rowVal <   threshold
    case 'lte': return rowVal <=  threshold
    case 'eq':  return rowVal === threshold
    case 'neq': return rowVal !== threshold
  }
}

// ── evaluateRules ─────────────────────────────────────────────────────

/**
 * Evaluate each ThresholdRule against all rows.
 * A rule fires if ANY row satisfies `row[rule.field] op rule.value`.
 * Returns one RuleDiagnostic per fired rule (order preserved).
 * No rows → no diagnostics.
 *
 * Pure function — safe to call inside useMemo.
 */
export function evaluateRules(
  rules: ThresholdRule[],
  rows:  EngineRow[],
): RuleDiagnostic[] {
  if (!rows.length) return []

  const diagnostics: RuleDiagnostic[] = []

  for (const rule of rules) {
    const fired = rows.some((row) => {
      const raw = row[rule.field]
      if (raw === undefined || raw === null) return false
      const n = Number(raw)
      if (!isFinite(n)) return false
      return evalOp(n, rule.op, rule.value)
    })

    if (fired) {
      diagnostics.push({ severity: rule.severity, label: rule.label })
    }
  }

  return diagnostics
}
