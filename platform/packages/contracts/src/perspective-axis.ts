// ── PerspectiveAxis wire contract (the OLAP query-perspective axis) ───────────
//
//  The structural envelope for a page's perspective axis — the generic, declarative
//  replacement for the privileged `timeMode` weave (VISION #3, the perspective-axis
//  refactor). A perspective is a NAMED QUERY-VIEW over the cube (OLAP "perspective":
//  SSAS named cube subset) — "year view" / "range view" over the same `time`
//  dimension — derived from URL state, never a captured snapshot.
//
//  WHY here (packages/contracts, the zero-dep boundary): this shape is shared by
//  THREE surfaces the dependency arrow keeps apart —
//    • apps/panel   AUTHORS  a PerspectiveAxis (the Constructor "Perspectives" pane),
//    • apps/api     VALIDATES + SERVES it (config↔cube fitness; GET /api/bootstrap),
//    • packages/core RENDERS it (perspectiveRegistry + ctx.perspectiveState).
//  The api MUST NOT import @statdash/react/@statdash/engine across the arrow, yet it
//  validates structure + ref-existence; the engine refines the opaque blobs to its
//  rich types. This is the SAME "structural envelope here, refined by the consumer"
//  pattern SiteManifestContract.pages / ManifestMode ⇄ ModeDef already use.
//
//  LAYERING (why `when`/`scope`/`available` are opaque here):
//    `PerspectiveDef.when` / `available` are VisibilityExpr trees and `scope.timeBinding`
//    is a TimeDimensionSpec — all CORE types this zero-dep layer cannot import. So the
//    contract carries the STRUCTURAL envelope (`when`/`available` as JsonRecord, `scope`
//    as a registry-keyed Record); `packages/core` REFINES `when`/`available` → VisibilityExpr
//    and `scope.timeBinding` → TimeDimensionSpec. The api validates structure + ref-existence
//    (it resolves dim/metric/filter names without the VisibilityExpr evaluator); the engine
//    validates semantics. No layer imports against the arrow. (FULLSTACK §1 contract-layering.)
//
//  LAW 1 (no privileged dimension): every name here is data — a perspective `id`, a
//  URL `param` (the Record key, see below), a `scope.timeBinding.dim` — the engine
//  never branches on a literal. LAW 2 (declarative): pure JSON, no functions.

import type { JsonRecord } from './json'
import type { ContractLocaleString } from './reference-metadata'

// ── PerspectiveScope — registry-keyed scope-key Record (the OCP move) ─────────
//
//  Every per-perspective EFFECT (what a perspective changes about the query) is a
//  KEY in this Record, each key registered with a PropSchema in the engine's
//  perspective-scope-key registry. `timeBinding` (year-pin vs [from,to] window) and
//  `metric` (a perspective-wide measurement swap, a MetricDef ref) are the TWO keys
//  registered TODAY. The DEFERRED keys — `store` (multi-store), `dims` (non-time pins),
//  `blend` (compare step), `facet` — are NOT a widening of THIS type but a future
//  `register()` call: a new scope door = a registration, never an interface change
//  (true OCP, Law 8). The Constructor pane is DRIVEN by the registry — a key appears
//  the moment it registers. (SYNTHESIS §1.4 — the agnosticism-critical re-shape: a
//  closed `{ timeBinding, metric }` interface would force every door to WIDEN it.)
//
//  `packages/core` REFINES this to the known keys: `{ timeBinding?: TimeDimensionSpec;
//  metric?: string }` — assignable to/from this generic Record (the ManifestMode ⇄
//  ModeDef widen/refine relationship).
export type PerspectiveScope = Record<string, unknown>

// ── PerspectiveDef — one named perspective (a state of the axis) ──────────────
//
//  A perspective is a named state carrying its declarative effect. `perspective = f(state)`:
//  switching is a URL-param write, never a mutation cascade — nothing captured.
export interface PerspectiveDef {
  /** Perspective id — 'year' | 'range' | … ; open (perspectiveRegistry-resolved, like ModeId). Referenced by `when: perspective-is(id)` and nav. */
  id:         string
  /** User-facing label. Multi-locale wire projection (ContractLocaleString); core refines to LocaleString. */
  label:      ContractLocaleString
  /**
   * OPTIONAL toggle icon — an agnostic icon-registry KEY (e.g. 'calendar'), never
   * inline SVG (Law 1). The perspective axis OWNS its toggle presentation: a switcher
   * that renders this axis (the `perspective-bar` node) reads label+icon from HERE, the
   * SSOT — not from a separate registry. Thin optional field; absent ⇒ no icon.
   */
  icon?:      string
  /**
   * OPTIONAL visibility override. Default = `perspective-is(id)` (the identity gate);
   * present ONLY for a non-identity membership rule (e.g. "show in year OR compare").
   * Structural envelope here (JsonRecord); core refines to VisibilityExpr. The
   * common path OMITS this field (FF-WHEN-IS-ESCAPE-ONLY forbids authoring the identity gate twice).
   */
  when?:      JsonRecord
  /**
   * The per-perspective effect bag — a registry-keyed scope-key Record (see PerspectiveScope).
   * OPTIONAL: a perspective that changes nothing about the query carries no scope.
   */
  scope?:     PerspectiveScope
  /**
   * OPTIONAL availability guard (D-GUARD, statechart guarded-transition) — "offer this
   * perspective only when <expr> holds" (e.g. range needs ≥2 time periods). Structural
   * envelope here (JsonRecord); core refines to VisibilityExpr. Absent ⇒ always available.
   * Read by the switcher/nav when building the OFFERED list (not yet wired — P1/P3+).
   */
  available?: JsonRecord
}

// ── PerspectiveAxis — one orthogonal axis (a Harel region) ────────────────────
//
//  An ordered list of perspectives. `perspectives[0]` IS the default (ONE SSOT — no
//  `default?` field, LOW-1) — mirroring the live `available[0]` fallback. Array order
//  is also the nav-sort order and the permalink default-elision basis.
//
//  NO `param` field: a page holds its axes as `Record<param, PerspectiveAxis>` (see the
//  page config), so the URL param IS the Record key — the SAME container shape as the
//  runtime active-id slot `ctx.perspectiveState: Record<param, id>`. Definition and
//  state share one shape, keyed by the same thing; multi-axis is a future KEY, never a
//  rename to a plural field. (SYNTHESIS §1.3.)
//
//  NO `snapshot` field: 'active' | 'all-perspectives' is HOW a caller renders (interactive
//  client vs PDF export), not WHAT the page is — a render-call option, not config.
//  (SYNTHESIS §1.1 cut.)
export interface PerspectiveAxis {
  perspectives: PerspectiveDef[]
}

/**
 * A page's perspective axes, keyed by URL param. One key today (`{ perspective: {…} }`);
 * a Record-of-one. Multi-axis (D-MULTIAXIS) = a second key, zero schema/field change.
 * The runtime active-id container mirrors this shape exactly: `Record<param, activeId>`.
 *
 * Declared as a standalone alias (not yet referenced by the page-config schema) — the
 * P0 envelope. The page-config schema gains `perspectives?: PerspectivesByParam` where
 * `modeOrder` is today, in a later phase (P4/P5); nothing reads it yet (additive).
 */
export type PerspectivesByParam = Record<string, PerspectiveAxis>
