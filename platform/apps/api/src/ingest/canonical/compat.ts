// ── Ingest — data-contract compatibility classifier (BACKWARD/FORWARD/FULL) ───
//
// ADR-0031 §4 (improvement 5). On ingest, compare the workbook's DECLARED DSD/codelists
// to the REGISTERED (gold) ones and classify the change, so the platform enforces the
// governance the user asked for: CODELIST is OPEN (members extend/deprecate freely,
// BACKWARD-auto), the DSD is GOVERNED (a structural change requires minting a version,
// FULL-required). This is the GATE — codelist open, DSD gated.
//
// This module is PURE (no DB, no Fastify, no xlsx — like region.ts/conform.ts). It owns
// a compat-LOCAL DsdSnapshot shape (NOT the parser's canonical/types.ts — file
// ownership boundary): the snapshot is the minimal projection both a parsed CanonicalDsd
// AND a gold read can be reduced to, so the classifier depends on neither concretely
// (Dependency Inversion — it talks to its own contract). The caller (validate.ts
// pre-pass) builds both snapshots and persists the resulting issues; SCD-2 retirement
// of a deprecated member is the publish path's job (this stage only CLASSIFIES + warns).
//
// SEAM-DEFER (ADR-0031 §7 improvement-5): the `compat_mode` column on stats.dataset for
// a non-default per-dataset policy. The default policy (codelist=BACKWARD-auto,
// DSD=FULL-required) is encoded here; a column would only override it per dataset.

import type { IssueCode } from '../types.js'

// ── The compat-local DSD snapshot (the contract both sides reduce to) ─────────

/**
 * The minimal DSD projection the compatibility check compares. Both the parsed
 * CanonicalDsd (declared) and a gold read (registered) reduce to this — keeping the
 * classifier independent of either concrete shape (it is the stable seam, GRASP
 * Protected Variations).
 *
 *  - dimensions    ORDERED dim codes (the series-key order — Law 1: read, never assumed).
 *  - measureConcept the measure concept ('OBS_VALUE').
 *  - members       per-dim codelist membership (current members only on the gold side).
 *                  ABSENT for a dim ⇒ "membership not asserted for this dim" (the check
 *                  compares members only where BOTH sides declare them — Postel).
 *  - datasetVersion when the DECLARED side carries a STRUCTURE `dataset_version` row, the
 *                  curator is explicitly minting a new structural version — a DSD change
 *                  is then GOVERNED-and-allowed rather than blocked.
 */
export interface DsdSnapshot {
  datasetCode: string
  dimensions: string[]
  measureConcept: string
  members: Record<string, string[]>
  datasetVersion?: string
}

// ── Compatibility modes (the Schema-Registry vocabulary) ──────────────────────

/** Schema-Registry compatibility modes (ADR-0031 §4): the formalized policy axes. */
export type CompatMode = 'BACKWARD' | 'FORWARD' | 'FULL'

/** The default governance policy: codelist evolves BACKWARD-auto; DSD requires FULL. */
export const COMPAT_POLICY = {
  codelist: 'BACKWARD' as CompatMode, // new structure reads old data → member additions auto-apply
  dsd:      'FULL' as CompatMode,     // both directions must hold → a breaking change mints a version
} as const

// ── The classification result ──────────────────────────────────────────────────

export type ContractChangeKind =
  | 'routine'             // data only — DSD + members unchanged → proceed silently
  | 'codelist-extend'     // new members, no removals → CODELIST_EXTENDED (warn, auto-apply)
  | 'codelist-deprecate'  // a previously-present member is absent → CODELIST_DEPRECATED (warn, SCD-2 retire)
  | 'dsd-change'          // dim set/order or measure differs → DSD_INCOMPATIBLE (error unless versioned)

/** One detected codelist delta (per dim), carried in the ContractChange detail. */
export interface CodelistDelta {
  dim: string
  added: string[]
  removed: string[]
}

/**
 * The outcome of classifyContractChange. `issues` are the ValidationIssue *details*
 * (code + severity + structured detail) the caller stamps with the submissionId; the
 * classifier is pure and does not know the submissionId (Dependency Inversion).
 */
export interface ContractChange {
  kind: ContractChangeKind
  /** The compat mode this classification falls under (the governance axis it tests). */
  mode: CompatMode
  /** Per-dim codelist deltas (extend/deprecate evidence). */
  codelistDeltas: CodelistDelta[]
  /** Structural deltas vs gold (populated for kind='dsd-change'). */
  dsdDelta?: {
    dimensionsBefore: string[]
    dimensionsAfter: string[]
    measureBefore: string
    measureAfter: string
    versioned: boolean
  }
  /** The issues to raise — code + severity + detail, WITHOUT a submissionId/rowIndex. */
  issues: { code: IssueCode; severity: 'warn' | 'error'; detail: Record<string, unknown> }[]
}

// ── The classifier (pure) ───────────────────────────────────────────────────────

function sameDimensions(a: string[], b: string[]): boolean {
  // Order matters (the series-key is ordered — a reorder is a DSD change, SDMX).
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

/**
 * Classify the change from the REGISTERED (gold) DSD to the DECLARED (workbook) DSD.
 *
 * Decision order (DSD gate first — a structural break dominates any member delta):
 *   1. DSD change (dimensions set/order OR measure concept differs):
 *        → 'dsd-change'. DSD_INCOMPATIBLE **error** UNLESS the declared side carries a
 *          dataset_version (an explicit structural version mint) → then warn-governed.
 *          (Policy: DSD = FULL-required.)
 *   2. Else compare codelist members per shared dim:
 *        - any member REMOVED (present in gold, absent in declared) → 'codelist-deprecate'
 *          → CODELIST_DEPRECATED **warn** (the publish path retires via SCD-2, never DELETE).
 *        - else any member ADDED → 'codelist-extend' → CODELIST_EXTENDED **warn** (auto-apply).
 *          (Policy: codelist = BACKWARD-auto.)
 *   3. Else 'routine' → no issue (proceed silently).
 *
 * A dim's members are compared ONLY when BOTH snapshots assert membership for it (Postel:
 * a gold dim resolved by `reference` rather than an inline CL declares no members on the
 * workbook side — that is not a deprecation, just an un-asserted dim).
 */
export function classifyContractChange(declared: DsdSnapshot, gold: DsdSnapshot): ContractChange {
  // ── 1. DSD gate (structural) ────────────────────────────────────────────────
  const dimsChanged = !sameDimensions(declared.dimensions, gold.dimensions)
  const measureChanged = declared.measureConcept !== gold.measureConcept
  if (dimsChanged || measureChanged) {
    const versioned = typeof declared.datasetVersion === 'string' && declared.datasetVersion.length > 0
    const detail: Record<string, unknown> = {
      dimensionsBefore: gold.dimensions, dimensionsAfter: declared.dimensions,
      measureBefore: gold.measureConcept, measureAfter: declared.measureConcept,
      versioned, declaredVersion: declared.datasetVersion ?? null,
      reason: dimsChanged ? 'dimensions differ' : 'measure concept differs',
      policy: 'DSD=FULL-required (mint a dataset_version for a breaking structural change)',
    }
    return {
      kind: 'dsd-change',
      mode: COMPAT_POLICY.dsd,
      codelistDeltas: [],
      dsdDelta: {
        dimensionsBefore: gold.dimensions, dimensionsAfter: declared.dimensions,
        measureBefore: gold.measureConcept, measureAfter: declared.measureConcept, versioned,
      },
      // GATE: an unversioned DSD change is an ERROR (blocks publish); a versioned one is
      // governed-and-allowed (warn — the curator explicitly minted the new structure).
      issues: [{ code: 'DSD_INCOMPATIBLE', severity: versioned ? 'warn' : 'error', detail }],
    }
  }

  // ── 2. Codelist deltas per shared dim (only where BOTH assert membership) ────
  const codelistDeltas: CodelistDelta[] = []
  let anyAdded = false
  let anyRemoved = false
  for (const dim of declared.dimensions) {
    const declaredMembers = declared.members[dim]
    const goldMembers = gold.members[dim]
    if (declaredMembers === undefined || goldMembers === undefined) continue // un-asserted dim
    const goldSet = new Set(goldMembers)
    const declaredSet = new Set(declaredMembers)
    const added = declaredMembers.filter((c) => !goldSet.has(c))
    const removed = goldMembers.filter((c) => !declaredSet.has(c))
    if (added.length > 0 || removed.length > 0) {
      codelistDeltas.push({ dim, added, removed })
      if (added.length > 0) anyAdded = true
      if (removed.length > 0) anyRemoved = true
    }
  }

  // Deprecation dominates extension (a removal is the governance-significant event:
  // it must retire via SCD-2, never hard-delete). A change may carry both.
  if (anyRemoved) {
    return {
      kind: 'codelist-deprecate',
      mode: COMPAT_POLICY.codelist,
      codelistDeltas,
      issues: [{
        code: 'CODELIST_DEPRECATED', severity: 'warn',
        detail: {
          deltas: codelistDeltas,
          policy: 'codelist=BACKWARD-auto; a dropped member is RETIRED via SCD-2 (is_current=false), never hard-deleted',
        },
      }],
    }
  }
  if (anyAdded) {
    return {
      kind: 'codelist-extend',
      mode: COMPAT_POLICY.codelist,
      codelistDeltas,
      issues: [{
        code: 'CODELIST_EXTENDED', severity: 'warn',
        detail: {
          deltas: codelistDeltas,
          policy: 'codelist=BACKWARD-auto; new members are auto-applied (the codelist stays OPEN)',
        },
      }],
    }
  }

  // ── 3. Routine ──────────────────────────────────────────────────────────────
  return { kind: 'routine', mode: COMPAT_POLICY.codelist, codelistDeltas: [], issues: [] }
}
