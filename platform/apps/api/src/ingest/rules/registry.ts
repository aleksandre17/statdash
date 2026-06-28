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
 *
 *  - `balance`        Σ(lhs side) ≈ Σ(rhs side) per group (a balancing item).
 *  - `identity`       N approaches to one aggregate AGREE per group (unsigned multiset).
 *  - `totalReconcile` Σ(parts) ≈ a declared total per group (unsigned hierarchy roll-up).
 *  - `linearIdentity` lhs ≈ Σ(coefᵢ · termᵢ) per group — the SIGNED accounting identity
 *                     (DC-02): the SNA value-balance form `B = Σ ± components` where signs
 *                     matter (GDP = C + I + X − M; B1G = P1 − P2). Generalizes
 *                     `totalReconcile` to arbitrary per-term coefficients, so a national-
 *                     accounts balance with a subtraction is expressible declaratively
 *                     (Law 1: dim/codes are DATA; Law 2: the expression is pure data).
 */
export type RuleKind = 'balance' | 'identity' | 'totalReconcile' | 'linearIdentity'

/**
 * A declarative validation rule — pure data (Constructor-ready, VTL-ready).
 *
 *  - `kind`        the closed-vocabulary discriminant the evaluator dispatches on.
 *  - `datasetCode` the dataset this rule applies to (the caller filters by it).
 *  - `severity`    'warn' = DQAF surface (reported with offending rows but does NOT
 *                  block publish — a rounding-level signal for human review).
 *                  'error' = a HARD accounting identity: a violation beyond tolerance
 *                  is persisted as an error-severity issue and BLOCKS the publish gate
 *                  (the curator route + publishSubmission reject it with an RFC-9457
 *                  `accounting-identity` problem naming the failing identity). Schema
 *                  errors reject at INGEST (the row cannot stage); an accounting-identity
 *                  error rejects at PUBLISH (the row is structurally valid but violates
 *                  a declared invariant). The seeded GDP expenditure identity is 'error';
 *                  the legacy DQAF balance/identity/total seeds remain 'warn'.
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
  linearIdentity: 'ACCOUNTING_IDENTITY',
}

const RULE_KINDS = new Set<RuleKind>(['balance', 'identity', 'totalReconcile', 'linearIdentity'])

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
//
// DC-02 — the REAL, publish-GATING accounting identity. The SNA expenditure-approach
// identity holds on the geostat GDP_ANNUAL seed and the live facts bundle for EVERY
// year (2010–2025) within rounding (verified max |Δ| = 0.1 mln GEL ≪ ε = 0.5):
//
//     GDP  =  C  +  I_GFCF  +  X  −  M
//   (output at market prices = final consumption + gross capital formation
//    + exports − imports)
//
// It is authored over the `measure` dimension (Law 1: the measure codes are DATA, not
// hardcoded in the evaluator), grouped per `geo` (and implicitly per time period), with
// the `−M` term carrying coef −1 — the SIGNED form the legacy unsigned kinds cannot
// express. severity:'error' makes a violation beyond ε REJECT the publish (the gold
// boundary), naming the failing identity + discrepancy in an RFC-9457 problem. A facts
// submission that does not carry the full {GDP, C, I_GFCF, X, M} operand set in a group
// is NOT asserted (Postel — an incomplete identity states nothing; the evaluator skips).

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
  {
    id: 'GDP_ANNUAL.identity.expenditure',
    kind: 'linearIdentity',
    datasetCode: 'GDP_ANNUAL',
    severity: 'error',
    // GDP ≡ C + I_GFCF + X − M, per (geo, time). lhs is the total measure; each term
    // selects a component by `dim`; coef −1 on M is the import deduction. ε declared.
    params: {
      dim: 'measure',
      lhs: 'GDP',
      terms: [
        { code: 'C' },
        { code: 'I_GFCF' },
        { code: 'X' },
        { code: 'M', coef: -1 },
      ],
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
