// ── PerspectiveAxis — CORE refinement of the contracts envelope ───────────────
//
//  The renderer-side rich types for the perspective axis (VISION #3). The STRUCTURAL
//  envelope lives in @statdash/contracts (zero-dep, shared by panel/api/core); this
//  module REFINES the opaque blobs to their core types — the
//  SiteManifestContract-refined-by-runner relationship (FULLSTACK §1):
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

import type { TimeBound, TimeDimensionSpec, TimeGranularity } from './data-spec'
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
  /**
   * The dim binding the active perspective applies before resolution — a GENERIC
   * `DimBinding` with an EXPLICIT `selection` discriminant (point/window/all). This
   * is the orthogonal-axis form (DESIGN-time-mode-decision §3.1): `year`/`range` are
   * two `selection.kind` values of ONE binding, authored once — never a shape-inferred
   * `pin?` XOR `range?` (the illegal-state-permitting legacy form, retired).
   */
  binding?:     DimBinding
  /**
   * LEGACY — the time-period-SHAPED binding (pin XOR range), superseded by `binding`.
   * Kept as a Postel alias so mid-migration configs still resolve; the parser lowers
   * it to a `DimBinding` (bindingFromTimeBinding). Retired wholesale at P-final (the
   * config authors `binding`; grep-zero `timeBinding`). Do NOT author both on one scope.
   * @deprecated author `binding` with an explicit `selection` instead.
   */
  timeBinding?: PerspectiveTimeBinding
  /** Perspective-wide measurement swap — a MetricDef ref (raw measure code today; metric-id when registered). */
  metric?:      string
}

// ── Selection — the EXPLICIT point/window/all discriminant (DESIGN R2) ─────────
//
//  The load-bearing change of the orthogonal-axis law: `year`/`range` stop differing
//  by WHICH optional field is set (the legacy `pin?` XOR `range?` shape, a
//  representable-but-undefined illegal state — `pin` AND `window` both set). They
//  become two explicit values of ONE `kind` discriminant, making the illegal state
//  UNREPRESENTABLE at the type level and unauthorable in the Constructor (one `kind`
//  dropdown, sub-fields showWhen-gated).
//
//  OPEN discriminated union (OCP, Law 8): a new arm (`set`, `compare`) is a new member
//  + a fold branch, the interpreter unchanged — never a fused-mode enum. All bounds are
//  `TimeBound` (a literal or a `{$ctx}` ref), resolved through the SAME dispatcher the
//  legacy pin/range read (resolveTimePin / effectiveBounds) so a migrated binding folds
//  BYTE-IDENTICALLY to its legacy timeBinding twin (FF-BINDING-SELECTION-EQUIV).
export type Selection =
  /** A single-period PIN (the `year` view): resolve `at` → pin `dims[dim]`. Unset/NaN ⇒ writes nothing (all-periods). */
  | { kind: 'point';  at: TimeBound }
  /**
   * A [from,to] WINDOW (the `range` view): resolve the bounds → write them under
   * `targetKeys` (absent ⇒ the conventional `${dim}From`/`${dim}To`). Explicit
   * from+to — never a loose tuple whose shape must be sniffed.
   */
  | { kind: 'window'; from: TimeBound; to: TimeBound; targetKeys?: { from?: string; to?: string } }
  /** ALL periods — an unbounded selection: writes nothing (the every-period path). */
  | { kind: 'all' }

// ── DimBinding — the GENERIC, dim-agnostic perspective binding (DESIGN §3.1) ───
//
//  Supersedes `PerspectiveTimeBinding`. Carries a generic `selection` on ANY `dim`
//  (Law 1 — no time privilege at the binding) plus an OPTIONAL open `granularity`
//  (carried metadata, inert until D-GRAIN). Not time-shaped: a non-time dimension can
//  carry a point/window selection with zero new types.
export interface DimBinding {
  /** GENERIC dimension key the binding scopes (conventionally TIME_DIM). Law 1: data, never a literal branch. */
  dim:          string
  /** The explicit selection-type (point/window/all) applied to `dim`. */
  selection:    Selection
  /** OPTIONAL open grain (registry string, D3). Carried metadata — inert until D-GRAIN. */
  granularity?: TimeGranularity
}

// ── PerspectiveTimeBinding — the perspective-scoped REFINEMENT of TimeDimensionSpec ─
//
//  A `timeBinding` is a `TimeDimensionSpec` (dim/range/granularity — the canonical
//  time shape every data spec shares) PLUS two perspective-OWNED options that the
//  shared `TimeDimensionSpec` must NOT carry (they are meaningless to a data spec —
//  strict-SOLID: never bloat a shared type with one consumer's fields). Both are
//  OPTIONAL and ADDITIVE — absent ⇒ the binding behaves byte-identically to a bare
//  `TimeDimensionSpec` (FF-BINDING-ADDITIVE-IDENTITY):
//
//    pin        — a SINGLE-PERIOD pin (the `year` perspective): a literal year or a
//                 `{ $ctx:'<param>' }` ref to the user-tracked year param. Resolved
//                 through the SAME `resolveTimeBound` dispatcher the legacy `{$ctx}`
//                 read uses; an unset/NaN resolution writes NOTHING (the all-years
//                 path via the `isUnsetTime` SSOT). [FF-BINDING-PIN-CTX-REF]
//    targetKeys — the window's DESTINATION dim keys (the `range` perspective): a
//                 declared `{ from, to }` so the resolved [from,to] window writes the
//                 keys the existing resolvers read (geostat: `fromYear`/`toYear`),
//                 not the hardcoded `${dim}From`/`${dim}To`. Absent ⇒ `${dim}From`/
//                 `${dim}To` byte-for-byte. [FF-BINDING-TARGET-KEYS]
//
//  Stays ASSIGNABLE to `TimeDimensionSpec` (intersection, not a re-declared interface)
//  so the existing `effectiveBounds`/`resolveTimeDimension` seam consumes it unchanged.
export type PerspectiveTimeBinding = TimeDimensionSpec & {
  /** Single-period pin (literal year or `{$ctx:'<param>'}` ref). Unset/NaN ⇒ writes nothing. */
  pin?:        TimeBound
  /** Window destination dim keys. Absent ⇒ `${dim}From`/`${dim}To`. */
  targetKeys?: { from?: string; to?: string }
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
//  and the engine type interoperate without a cast (the refine ⇄ widen invariant).
//  These `satisfies`-style checks fail the BUILD if a refinement ever
//  diverges structurally from the envelope.
const _scopeWidens:  (s: PerspectiveScope) => ContractPerspectiveScope = (s) => s
const _axisWidens:   (a: PerspectiveAxis)  => ContractPerspectiveAxis  = (a) => a
void _scopeWidens
void _axisWidens
