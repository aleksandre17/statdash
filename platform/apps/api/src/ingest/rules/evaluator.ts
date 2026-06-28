// ── Ingest — RuleSpec evaluator (the minimal built-in DQAF interpreter) ───────
//
// ADR-0031 §4 (improvement 3). A minimal, built-in evaluator for the 3 closed rule
// kinds (balance / identity / totalReconcile). It is the FIRST interpreter behind the
// `runRules` port; a VTL-2.1 engine can later register as the interpreter for richer
// kinds WITHOUT changing this port's signature (SEAM-DEFER the engine — §7).
//
// Each kind is a pure function over the staged rows + the rule's pure-data `params`,
// emitting warn-severity ValidationIssue[] (DQAF = surface, never silently drop). ε is
// `params.epsilon` (declared, default 0.5 — never hardcoded in the comparison).
//
// No DB, no IO — like conform.ts/region.ts, this is a deterministic, unit-testable
// filter. The caller (validate.ts) supplies the rules; the worker wires the call after
// validateObs for kind='facts'.

import type { StagedObsRow, ValidationIssue } from '../types.js'
import { makeIssue } from '../util.js'
import {
  type RuleSpec, RULE_ISSUE_CODE, ruleEpsilon, ruleSpecRejection,
} from './registry.js'

/** Context for a rule run (reserved for future locale/ctx needs — kept minimal now). */
export interface RuleContext {
  submissionId: string
}

// ── Numeric helpers ───────────────────────────────────────────────────────────

/** True when |a − b| ≤ ε (the declared tolerance). Both finite-checked by callers. */
function within(a: number, b: number, epsilon: number): boolean {
  return Math.abs(a - b) <= epsilon
}

/** A row's numeric obs_value, or null when it is not a finite number (skipped). */
function numericValue(r: StagedObsRow): number | null {
  return typeof r.obsValue === 'number' && Number.isFinite(r.obsValue) ? r.obsValue : null
}

/**
 * The grouping key for a row over the given dims (order-stable). Rows that share a
 * group key are compared together (a balance/total is evaluated PER group — e.g. per
 * time period, per region). An absent group dim yields '∅' so the row still groups.
 */
function groupKey(r: StagedObsRow, groupDims: string[]): string {
  const parts: string[] = [r.timePeriod]
  for (const d of groupDims) parts.push(`${d}=${r.dimKey[d] ?? '∅'}`)
  return parts.join('|')
}

/** All rows whose `dim` value is in `values`, summed; returns {sum, rows} for detail. */
function sumWhere(
  rows: StagedObsRow[], dim: string, values: Set<string>,
): { sum: number; rowIndexes: number[] } {
  let sum = 0
  const rowIndexes: number[] = []
  for (const r of rows) {
    if (!values.has(r.dimKey[dim])) continue
    const v = numericValue(r)
    if (v === null) continue
    sum += v
    rowIndexes.push(r.rowIndex)
  }
  return { sum, rowIndexes }
}

// ── Param coercion (pure-data params → typed locals, tolerant) ────────────────

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}
function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

/** A signed identity term — a code with an optional coefficient (default +1). */
interface IdentityTerm { code: string; coef: number }

/**
 * Coerce `params.terms` (pure data) into typed {code, coef} terms, tolerantly:
 * a plain string code is coef +1; an object {code, coef?} carries an explicit
 * coefficient (a non-finite coef falls back to +1). Malformed entries are dropped.
 */
function asTerms(v: unknown): IdentityTerm[] {
  if (!Array.isArray(v)) return []
  const out: IdentityTerm[] = []
  for (const t of v) {
    if (typeof t === 'string' && t.length > 0) { out.push({ code: t, coef: 1 }); continue }
    if (t && typeof t === 'object') {
      const code = (t as { code?: unknown }).code
      const rawCoef = (t as { coef?: unknown }).coef
      if (typeof code === 'string' && code.length > 0) {
        const coef = typeof rawCoef === 'number' && Number.isFinite(rawCoef) ? rawCoef : 1
        out.push({ code, coef })
      }
    }
  }
  return out
}

// ── The 3 rule kinds ───────────────────────────────────────────────────────────

/**
 * BALANCE — within each group, Σ(values of `dim` ∈ `lhs`) ≈ Σ(values of `dim` ∈ `rhs`).
 *   params: { dim, lhs:string[], rhs:string[], group?:string[], epsilon? }
 * Use: a national-accounts balancing item where one side must equal the other (uses ⇄
 * resources) per time period. One issue per group whose two sides diverge beyond ε.
 */
function evalBalance(spec: RuleSpec, rows: StagedObsRow[], ctx: RuleContext): ValidationIssue[] {
  const dim = asString(spec.params.dim)
  const lhs = new Set(asStringArray(spec.params.lhs))
  const rhs = new Set(asStringArray(spec.params.rhs))
  if (!dim || lhs.size === 0 || rhs.size === 0) return []
  const epsilon = ruleEpsilon(spec)
  const groupDims = asStringArray(spec.params.group)
  const code = RULE_ISSUE_CODE.balance

  const groups = new Map<string, StagedObsRow[]>()
  for (const r of rows) {
    const k = groupKey(r, groupDims)
    const g = groups.get(k); if (g) g.push(r); else groups.set(k, [r])
  }

  const issues: ValidationIssue[] = []
  for (const [key, groupRows] of groups) {
    const left = sumWhere(groupRows, dim, lhs)
    const right = sumWhere(groupRows, dim, rhs)
    // Skip groups where neither side has any row (nothing to balance).
    if (left.rowIndexes.length === 0 && right.rowIndexes.length === 0) continue
    if (!within(left.sum, right.sum, epsilon)) {
      issues.push(makeIssue(ctx.submissionId, 'validate', spec.severity, code, {
        ruleId: spec.id, group: key, dim, epsilon,
        lhs: [...lhs], rhs: [...rhs],
        lhsSum: left.sum, rhsSum: right.sum, delta: left.sum - right.sum,
        offendingRows: [...left.rowIndexes, ...right.rowIndexes],
      }))
    }
  }
  return issues
}

/**
 * IDENTITY — within each group, two approaches to the same aggregate agree.
 *   params: { dim, approaches:string[], group?:string[], epsilon? }
 * Each value in `approaches` selects a subset of rows by `dim`; the SUM of each subset
 * must agree within ε (e.g. GDP by production vs expenditure vs income). One issue per
 * group where the spread (max−min across approaches) exceeds ε.
 */
function evalIdentity(spec: RuleSpec, rows: StagedObsRow[], ctx: RuleContext): ValidationIssue[] {
  const dim = asString(spec.params.dim)
  const approaches = asStringArray(spec.params.approaches)
  if (!dim || approaches.length < 2) return []
  const epsilon = ruleEpsilon(spec)
  const groupDims = asStringArray(spec.params.group)
  const code = RULE_ISSUE_CODE.identity

  const groups = new Map<string, StagedObsRow[]>()
  for (const r of rows) {
    const k = groupKey(r, groupDims)
    const g = groups.get(k); if (g) g.push(r); else groups.set(k, [r])
  }

  const issues: ValidationIssue[] = []
  for (const [key, groupRows] of groups) {
    const sums: { approach: string; sum: number; rowIndexes: number[] }[] = []
    for (const a of approaches) {
      const s = sumWhere(groupRows, dim, new Set([a]))
      if (s.rowIndexes.length > 0) sums.push({ approach: a, sum: s.sum, rowIndexes: s.rowIndexes })
    }
    // Need at least two approaches PRESENT in this group to assert agreement.
    if (sums.length < 2) continue
    const values = sums.map((s) => s.sum)
    const min = Math.min(...values)
    const max = Math.max(...values)
    if (!within(min, max, epsilon)) {
      issues.push(makeIssue(ctx.submissionId, 'validate', spec.severity, code, {
        ruleId: spec.id, group: key, dim, epsilon,
        approaches: sums.map((s) => ({ approach: s.approach, sum: s.sum })),
        spread: max - min,
        offendingRows: sums.flatMap((s) => s.rowIndexes),
      }))
    }
  }
  return issues
}

/**
 * TOTAL_RECONCILE — within each group, Σ(parts) ≈ the declared total.
 *   params: { dim, total:string, parts?:string[], group?:string[], epsilon? }
 * `total` selects the total row(s) by `dim`; `parts` selects the component rows (when
 * omitted, every OTHER value of `dim` in the group is a part). Σ(parts) must match the
 * total within ε (e.g. sector breakdown summing to _T). One issue per group that fails.
 */
function evalTotalReconcile(spec: RuleSpec, rows: StagedObsRow[], ctx: RuleContext): ValidationIssue[] {
  const dim = asString(spec.params.dim)
  const total = asString(spec.params.total)
  if (!dim || !total) return []
  const epsilon = ruleEpsilon(spec)
  const groupDims = asStringArray(spec.params.group)
  const declaredParts = asStringArray(spec.params.parts)
  const code = RULE_ISSUE_CODE.totalReconcile

  const groups = new Map<string, StagedObsRow[]>()
  for (const r of rows) {
    const k = groupKey(r, groupDims)
    const g = groups.get(k); if (g) g.push(r); else groups.set(k, [r])
  }

  const issues: ValidationIssue[] = []
  for (const [key, groupRows] of groups) {
    const totalSel = sumWhere(groupRows, dim, new Set([total]))
    if (totalSel.rowIndexes.length === 0) continue   // no total in this group → nothing to reconcile
    // Parts: declared set, or every non-total value of `dim` present in the group.
    const partValues = declaredParts.length > 0
      ? new Set(declaredParts)
      : new Set(groupRows.map((r) => r.dimKey[dim]).filter((v) => v !== total && v !== undefined))
    const parts = sumWhere(groupRows, dim, partValues)
    if (parts.rowIndexes.length === 0) continue       // no parts → cannot reconcile
    if (!within(parts.sum, totalSel.sum, epsilon)) {
      issues.push(makeIssue(ctx.submissionId, 'validate', spec.severity, code, {
        ruleId: spec.id, group: key, dim, epsilon,
        total, totalSum: totalSel.sum,
        parts: [...partValues], partsSum: parts.sum, delta: parts.sum - totalSel.sum,
        offendingRows: [...parts.rowIndexes, ...totalSel.rowIndexes],
      }))
    }
  }
  return issues
}

/**
 * LINEAR_IDENTITY — within each group, lhs ≈ Σ(coefᵢ · termᵢ), the SIGNED accounting
 * identity (DC-02).
 *   params: { dim, lhs:string, terms:(string|{code,coef?})[], group?:string[], epsilon? }
 * `lhs` selects the total row(s) by `dim`; each term selects a component, with an
 * optional signed coefficient (default +1, e.g. `{code:'M', coef:-1}` for an import
 * deduction). The SNA value balance `GDP = C + I + X − M` / `B1G = P1 − P2`. ε is the
 * declared rounding tolerance. One ACCOUNTING_IDENTITY issue per group that fails.
 *
 * POSTEL — an identity is asserted ONLY over a COMPLETE operand set: a group is checked
 * iff the lhs AND EVERY term are present. A submission that lacks the lhs or any term in
 * a group states nothing about the identity there (an incremental/partial load is not a
 * violation) → the group is skipped. This is the VTL "operands must be defined" rule and
 * the additive contract the task requires (datasets/groups with no full identity are
 * unaffected). Cross-submission completion (pulling missing operands from gold) is the
 * deferred seam — the seeded GDP identity carries its full operand set in one submission.
 */
function evalLinearIdentity(spec: RuleSpec, rows: StagedObsRow[], ctx: RuleContext): ValidationIssue[] {
  const dim = asString(spec.params.dim)
  const lhs = asString(spec.params.lhs)
  const terms = asTerms(spec.params.terms)
  if (!dim || !lhs || terms.length === 0) return []
  const epsilon = ruleEpsilon(spec)
  const groupDims = asStringArray(spec.params.group)
  const code = RULE_ISSUE_CODE.linearIdentity

  const groups = new Map<string, StagedObsRow[]>()
  for (const r of rows) {
    const k = groupKey(r, groupDims)
    const g = groups.get(k); if (g) g.push(r); else groups.set(k, [r])
  }

  const issues: ValidationIssue[] = []
  for (const [key, groupRows] of groups) {
    const lhsSel = sumWhere(groupRows, dim, new Set([lhs]))
    if (lhsSel.rowIndexes.length === 0) continue   // no total stated in this group → skip

    // Resolve every term; a single MISSING term makes the identity unassertable here.
    let complete = true
    let rhsSum = 0
    const termRowIndexes: number[] = []
    const termDetail: { code: string; coef: number; value: number }[] = []
    for (const t of terms) {
      const sel = sumWhere(groupRows, dim, new Set([t.code]))
      if (sel.rowIndexes.length === 0) { complete = false; break }
      rhsSum += t.coef * sel.sum
      termRowIndexes.push(...sel.rowIndexes)
      termDetail.push({ code: t.code, coef: t.coef, value: sel.sum })
    }
    if (!complete) continue   // incomplete operand set (Postel) → nothing asserted

    if (!within(lhsSel.sum, rhsSum, epsilon)) {
      issues.push(makeIssue(ctx.submissionId, 'validate', spec.severity, code, {
        ruleId: spec.id, group: key, dim, epsilon,
        lhs, lhsValue: lhsSel.sum,
        terms: termDetail, rhsSum,
        delta: lhsSel.sum - rhsSum,
        offendingRows: [...lhsSel.rowIndexes, ...termRowIndexes],
      }))
    }
  }
  return issues
}

// ── The port: runRules(rules, rows, ctx) ───────────────────────────────────────

/** Dispatch table (Registry pattern) — kind → the built-in interpreter for it. */
const EVALUATORS: Record<RuleSpec['kind'],
  (spec: RuleSpec, rows: StagedObsRow[], ctx: RuleContext) => ValidationIssue[]> = {
  balance:        evalBalance,
  identity:       evalIdentity,
  totalReconcile: evalTotalReconcile,
  linearIdentity: evalLinearIdentity,
}

/**
 * Run a set of declarative RuleSpecs over the staged observation rows. The North-Star
 * silver `runRules` port — the ONE seam a future VTL-2.1 engine slots behind (it would
 * register additional kinds in EVALUATORS; this signature is unchanged: OCP).
 *
 * A malformed/impure rule (ruleSpecRejection) is NOT silently dropped — it surfaces as
 * a warn ValidationIssue against its own code, so a curator sees a rejected rule rather
 * than a quietly-skipped check (DQAF = surface; fail-fast at the boundary). Rules whose
 * `kind` is well-formed but whose params under-specify the check are a no-op (the
 * per-kind guards return []), because an incomplete rule asserts nothing.
 */
export function runRules(
  rules: RuleSpec[], rows: StagedObsRow[], ctx: RuleContext,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (const spec of rules) {
    const rejection = ruleSpecRejection(spec)
    if (rejection) {
      issues.push(makeIssue(ctx.submissionId, 'validate', 'warn', RULE_ISSUE_CODE[spec.kind] ?? 'IDENTITY_MISMATCH', {
        ruleId: spec.id, rejected: rejection,
      }))
      continue
    }
    issues.push(...EVALUATORS[spec.kind](spec, rows, ctx))
  }
  return issues
}
