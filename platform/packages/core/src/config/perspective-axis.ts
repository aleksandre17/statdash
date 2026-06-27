// ── PerspectiveAxis — CORE refinement of the contracts envelope ───────────────
//
//  The renderer-side rich types for the perspective axis (VISION #3). The STRUCTURAL
//  envelope lives in @statdash/contracts (zero-dep, shared by panel/api/core); this
//  module REFINES the opaque blobs to their core types — exactly the ManifestMode ⇄
//  ModeDef / SiteManifestContract-refined-by-runner relationship (FULLSTACK §1):
//
//    contracts.PerspectiveScope  (Record<string, unknown>)  → CORE { timeBinding?, metric? }
//    contracts.PerspectiveDef.when/available (JsonRecord)    → CORE VisibilityExpr
//
//  Each refined type stays ASSIGNABLE to its contract counterpart (widen ⇄ refine),
//  so the api type and the engine type interoperate without a cast. The contract
//  validates structure + ref-existence; the engine refines + validates semantics.
//
//  P0 is PURELY ADDITIVE: nothing reads these types yet (the ctx-scoping step, the
//  axis parser, and the permalink util land in P1/P4). A page with no `perspectives`
//  declared touches none of this — byte-identical render (FF-ONE-VIEW-NO-MACHINERY).
//
//  LAW 1: `timeBinding.dim` is a generic dimension key (the existing TIME_DIM SSOT
//  constant, not a branch); `metric` is a generic MetricDef ref. LAW 2: pure JSON,
//  no functions, Constructor-authorable.

import type { TimeDimensionSpec }  from './data-spec'
import type { VisibilityExpr }     from './visibility'
import type {
  PerspectiveScope as ContractPerspectiveScope,
  PerspectiveDef   as ContractPerspectiveDef,
  PerspectiveAxis  as ContractPerspectiveAxis,
} from '@statdash/contracts'

// ── PerspectiveScope (core) — the two REGISTERED scope-keys today ─────────────
//
//  `timeBinding` (year-pin vs [from,to] window) + `metric` (a perspective-wide
//  measurement swap — a MetricDef ref) are the keys registered NOW (see
//  perspective-scope-registry). `store`/`dims`/`blend`/`facet` are DOCUMENTED
//  DEFERRED keys — added later as a `register()` call + an optional field here,
//  NEVER a widening that breaks the interpreter (OCP, SYNTHESIS §1.4). Both keys
//  OPTIONAL: a perspective may bind only time, only a metric, or (rarely) neither.
//
//  Modelled as an INTERSECTION of the contract Record with the two known keys — NOT
//  a closed interface. This is deliberate and load-bearing: an `interface` lacks an
//  implicit index signature, so it would NOT be assignable to the contract's
//  `Record<string, unknown>` (the widen ⇄ refine invariant would break). The
//  intersection keeps the refined type assignable to the contract envelope AND
//  surfaces `timeBinding`/`metric` for authoring — and it is OPEN by construction:
//  a deferred scope-key (store/dims/blend) is already a valid member (the Record
//  half), so a future optional field is purely additive (OCP, SYNTHESIS §1.4).
export type PerspectiveScope = ContractPerspectiveScope & {
  /** Year-pin vs [from,to] window — the time-axis binding the active perspective applies before resolution. */
  timeBinding?: TimeDimensionSpec
  /** Perspective-wide measurement swap — a MetricDef ref (raw measure code today; metric-id when registered). */
  metric?:      string
}

// ── PerspectiveDef (core) — `when`/`available` refined to VisibilityExpr ───────
//
//  Re-declares the contract def with the two opaque blobs refined: `when`/`available`
//  → VisibilityExpr (the EXISTING evaluator, reused — no new machinery), `scope` →
//  the core PerspectiveScope. `id`/`label` carry through structurally.
export interface PerspectiveDef extends Omit<ContractPerspectiveDef, 'when' | 'scope' | 'available'> {
  /** OPTIONAL visibility override; default = perspective-is(id). Omitted on the common path (FF-WHEN-IS-ESCAPE-ONLY). */
  when?:      VisibilityExpr
  /** The per-perspective effect bag — the two registered scope-keys (timeBinding, metric). */
  scope?:     PerspectiveScope
  /** OPTIONAL availability guard (D-GUARD). Absent ⇒ always available. Read by the switcher/nav (P1/P3+). */
  available?: VisibilityExpr
}

// ── PerspectiveAxis (core) — refined perspectives[] ───────────────────────────
//
//  `perspectives[0]` IS the default (one SSOT — no `default?` field, LOW-1). No
//  `param` field (the URL param is the Record key in `PerspectivesByParam`); no
//  `snapshot` field (a render-call option, not config — SYNTHESIS §1.1).
export interface PerspectiveAxis extends Omit<ContractPerspectiveAxis, 'perspectives'> {
  perspectives: PerspectiveDef[]
}

/**
 * A page's perspective axes, keyed by URL param — the core-refined mirror of the
 * contract `PerspectivesByParam`. One key today (`{ perspective: {…} }`); multi-axis
 * (D-MULTIAXIS) = a second key. Mirrors the runtime active-id slot
 * `SectionContext.perspectiveState: Record<param, activeId>` exactly.
 */
export type PerspectivesByParam = Record<string, PerspectiveAxis>

// ── Static assignability proofs (refine ⇄ widen, compile-time) ────────────────
//  A core type must remain assignable to its contract counterpart so the api type
//  and the engine type interoperate without a cast (the ManifestMode ⇄ ModeDef
//  invariant). These `satisfies`-style checks fail the BUILD if a refinement ever
//  diverges structurally from the envelope.
const _scopeWidens:  (s: PerspectiveScope) => ContractPerspectiveScope = (s) => s
const _axisWidens:   (a: PerspectiveAxis)  => ContractPerspectiveAxis  = (a) => a
void _scopeWidens
void _axisWidens
