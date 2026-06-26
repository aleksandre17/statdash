// ── Ingest — RuleSpec registry (validation-as-data, VTL-ready) ────────────────
//
// ADR-0031 §3 + §4 (improvement 3). The DQAF integrity checks are DECLARATIVE DATA,
// not hardcoded TS: a RuleSpec is a closed-vocabulary record dispatched on `kind`
// through this registry (Registry pattern — discriminant → handler). This is the
// North-Star silver `RuleSpec`/`runRules` seam, RESERVED so a VTL-2.1 engine can
// later be the interpreter behind the SAME port (SEAM-DEFER the engine — §7).
//
// Law 2 (config is declarative, logic lives in the renderer): `params` is PURE DATA
// — no functions, no `eval`, no imperative row-accessor callbacks in config. A rule
// that needs a function is REJECTED at the boundary (`ruleSpecRejection`), because a
// function in config forfeits the Constructor moat (not serializable, not authorable
// by a non-programmer).
// The evaluator dispatches on `kind` (the closed vocabulary), never interprets code.

import type { IssueCode } from '../types.js'

// ── The closed rule vocabulary (no eval — a new kind is a new registry entry) ─

/**
 * The DQAF integrity-rule kinds. CLOSED on purpose (Law 2): the silver evaluator
 * dispatches on this discriminant; a curator authors `params`, never code. A VTL
 * engine, when the trigger arrives, registers as additional kinds behind this union
 * — the interpreter interface is unchanged (OCP).
 */
export type RuleKind = 'balance' | 'identity' | 'totalReconcile'

/**
 * A declarative validation rule — pure data (Constructor-ready, VTL-ready).
 *
 *  - `kind`        the closed-vocabulary discriminant the evaluator dispatches on.
 *  - `datasetCode` the dataset this rule applies to (the caller filters by it).
 *  - `severity`    DQAF integrity = 'warn' (surface, never silently drop): a gap is
 *                  reported with offending rows but does NOT block publish; only a
 *                  schema 'error' blocks. A rule MAY be authored 'error' for a hard
 *                  accounting identity, but the 3 seeded DQAF rules are warn.
 *  - `params`      pure-data parameters (Record<string,unknown>) — NEVER a function.
 *                  Per-kind shape (see the evaluator); `epsilon` is the declared
 *                  tolerance (default 0.5 — ADR-0031 §4, never hardcoded in logic).
 */
export interface RuleSpec {
  id: string
  kind: RuleKind
  datasetCode: string
  severity: 'warn' | 'error'
  params: Record<string, unknown>
}

/** The default tolerance (ADR-0031 §4): 0.5 (mln GEL for the GeoStat datasets). */
export const DEFAULT_EPSILON = 0.5

/** The issue code each rule kind emits (the stable output contract — additive). */
export const RULE_ISSUE_CODE: Record<RuleKind, IssueCode> = {
  balance:        'BALANCE_MISMATCH',
  identity:       'IDENTITY_MISMATCH',
  totalReconcile: 'TOTAL_RECONCILE',
}

const RULE_KINDS = new Set<RuleKind>(['balance', 'identity', 'totalReconcile'])

/**
 * Fail-fast guard (Law 2 / §12 safe-expression): a RuleSpec must be pure data with a
 * known `kind`, and NO `params` value may be a function. Returns the reason a spec is
 * invalid, or null when it is well-formed. The caller surfaces a rejected spec rather
 * than silently dropping it (DQAF = surface).
 */
export function ruleSpecRejection(spec: RuleSpec): string | null {
  if (!RULE_KINDS.has(spec.kind)) return `unknown rule kind '${spec.kind}'`
  if (spec.severity !== 'warn' && spec.severity !== 'error') {
    return `invalid severity '${spec.severity}'`
  }
  if (spec.params == null || typeof spec.params !== 'object' || Array.isArray(spec.params)) {
    return 'params must be a plain object'
  }
  for (const [k, v] of Object.entries(spec.params)) {
    if (typeof v === 'function') return `params.${k} is a function — rules are pure data (Law 2)`
  }
  return null
}

/** Resolve the declared epsilon for a rule (params.epsilon), defaulting + validating. */
export function ruleEpsilon(spec: RuleSpec): number {
  const raw = spec.params.epsilon
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return raw
  return DEFAULT_EPSILON
}

// ── Rule resolution (built-in seed; the DB rule table is the deferred seam) ───
//
// BAKE-NOW: the 3 DQAF rules are resolvable as pure data keyed by datasetCode. There
// is no `stats.validation_rule` table yet (SEAM-DEFER — ADR-0031 §3: "a VTL-2.1
// compiled-rule kind … DO NOT adopt a VTL engine"; the curator-authored rule table is
// the same deferred door). `resolveRules` is the ONE seam the caller (validate.ts)
// depends on — when the table arrives it reads from gold here and the call site is
// unchanged (OCP / Dependency Inversion). Empty for a dataset with no declared rules.
//
// The GDP identity (production ⇄ expenditure ⇄ income agree within ε) is the seeded
// fitness net (ADR-0031 §4): a real GDP_ANNUAL rule lives here so the 2010 identity
// row produces zero IDENTITY_MISMATCH within ε, and a deliberately-broken fixture
// produces exactly one warn with the offending rows.

const BUILT_IN_RULES: RuleSpec[] = [
  {
    id: 'GDP_ANNUAL.identity.approaches',
    kind: 'identity',
    datasetCode: 'GDP_ANNUAL',
    severity: 'warn',
    // GDP measured by production / expenditure / income must agree per (geo, time).
    // `dim` selects the approach; `group` keeps each region+year independent. ε is
    // declared (DQAF default 0.5 mln GEL), never hardcoded in the evaluator.
    params: {
      dim: 'approach',
      approaches: ['B1GQ_P', 'B1GQ_E', 'B1GQ_I'],
      group: ['geo'],
      epsilon: DEFAULT_EPSILON,
    },
  },
]

/**
 * Resolve the RuleSpecs that apply to a dataset (BAKE-NOW: the built-in DQAF seed;
 * SEAM-DEFER: a gold `stats.validation_rule` read behind this SAME signature). Pure —
 * no DB today. A dataset with no rules yields [] (the runRules call is then a no-op).
 */
export function resolveRules(datasetCode: string): RuleSpec[] {
  return BUILT_IN_RULES.filter((r) => r.datasetCode === datasetCode)
}
