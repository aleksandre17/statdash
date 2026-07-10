// ── Placement Law · resolveSurface (AR-49 SL-0) ───────────────────────────────
//
//  HALF TWO of the Placement Law. Given a subject's SCOPE (its relationship to the
//  current focus) and its WEIGHT (magnitude — from `weight.ts`), this returns the
//  ONE container that must hold it. It is the SSOT for "where does X go?": no
//  surface hand-places its own editor, and the owner's "crammed right dock" becomes
//  a state the code cannot express — an oversize subject *escalates out* of the
//  dock by construction, it can never overflow inside it.
//
//  ── Why a table, not per-editor branches (FF-PLACEMENT-DERIVED) ──────────────
//  Placement is a pure function of two ABSTRACT axes — scope × weight — encoded as
//  DATA (`PLACEMENT_TABLE`), never as `if (nodeType === 'chart') …`. There is no
//  per-editor / per-type placement literal anywhere; a new editor kind places
//  itself for free by declaring only its scope and shape (OCP). That is the whole
//  law: the arrangement is derived, so it is uniform and cannot drift editor by
//  editor into a crammed dock.
//
//  Pure + framework-free: no React, no store, no DOM, no side effects.
//
import type { WeightBand } from './weight'
import { deriveWeight, type SubjectShape } from './weight'

// ── Container — the CLOSED surface set (SSOT) ──────────────────────────────────
//
//  Every place a subject can be authored. String literals so the whole model is
//  JSON-serializable (config-is-data spirit). Ordered lightest → heaviest below.
//    inline            — rendered in place inside its parent surface (no container).
//    popover           — a light, trigger-anchored floating editor (quick edit).
//    dock-panel        — the right dock's element panel (the default element home).
//    dock-drill        — progressive drill-in *within* the dock (the D7.1b editor).
//    focus-view        — a SEPARATE Studio route/screen (realized later, SL-2) for
//                        subjects too heavy for the dock — emitted here, not rendered.
//    relocated-surface — a dedicated left-dock surface (Data / Style / Model …) for
//                        document-scope subjects; off the weight-escalation ladder.
//
export type Container =
  | 'inline'
  | 'popover'
  | 'dock-panel'
  | 'dock-drill'
  | 'focus-view'
  | 'relocated-surface'

// ── PlacementScope — the CLOSED scope set (SSOT) ───────────────────────────────
//
//  A subject's relationship to the current focus — the axis orthogonal to weight.
//    selection    — the active canvas element's own inspector (dock element context).
//    nested-field — a field nested inside an already-open editor (D7.1b sub-field).
//    quick-edit   — a transient edit anchored to a trigger (rename/toggle on canvas).
//    document     — page / site / global authoring; belongs to a dedicated surface.
//
export type PlacementScope = 'selection' | 'nested-field' | 'quick-edit' | 'document'

// ── The escalation ladder — capacity order for the invariant ───────────────────
//
//  The weight-escalation containers, lightest → heaviest. `relocated-surface` is
//  deliberately NOT here: document scope is weight-independent, so it never
//  escalates. A container's capacity rank is its index; the invariant is that for
//  any weight-laddered scope, heavier weight never resolves to a lighter container.
//
export const ESCALATION_LADDER: readonly Container[] = [
  'inline', 'popover', 'dock-panel', 'dock-drill', 'focus-view',
] as const

/** Capacity rank of a ladder container (higher = holds more). `-1` if off-ladder. */
export function capacityRank(container: Container): number {
  return ESCALATION_LADDER.indexOf(container)
}

// ── PLACEMENT_TABLE — the SSOT arrangement (scope × weight → container) ─────────
//
//  Read this as the law itself. Each row is a scope; each cell escalates left→right
//  as weight grows, and every weight-laddered row terminates at `focus-view` for an
//  oversize subject (FF-NO-CRAMMED-DOCK: nothing oversize stays in the dock).
//
//    scope \ band  | flat        | grouped     | nested      | oversize
//    ------------- | ----------- | ----------- | ----------- | ----------
//    selection     | dock-panel  | dock-panel  | dock-drill  | focus-view
//    nested-field  | inline      | dock-drill  | dock-drill  | focus-view
//    quick-edit    | popover     | popover     | dock-drill  | focus-view
//    document      | relocated   | relocated   | relocated   | relocated   (weight-independent)
//
export const PLACEMENT_TABLE: Readonly<Record<PlacementScope, Readonly<Record<WeightBand, Container>>>> = {
  // The active element fills the dock; nested structure drills in the dock; only a
  // subject past the drill budget escapes to its own screen.
  selection: {
    flat: 'dock-panel', grouped: 'dock-panel', nested: 'dock-drill', oversize: 'focus-view',
  },
  // The D7.1b column: a scalar sub-field renders inline; anything with structure is
  // a drill row; over-depth escapes. (A fat flat object is still a drill, not inline.)
  'nested-field': {
    flat: 'inline', grouped: 'dock-drill', nested: 'dock-drill', oversize: 'focus-view',
  },
  // A trigger-anchored quick edit: a light one pops over; a structured one earns the
  // dock's drill; an oversize one takes a screen. This IS the §3.3 escalation ladder.
  'quick-edit': {
    flat: 'popover', grouped: 'popover', nested: 'dock-drill', oversize: 'focus-view',
  },
  // Document scope is a HOME, not a weight escalation: it always lands on its own
  // dedicated surface, which manages its internal weight itself.
  document: {
    flat: 'relocated-surface', grouped: 'relocated-surface',
    nested: 'relocated-surface', oversize: 'relocated-surface',
  },
} as const

// ── resolveSurface — (scope, weight) → container (pure, TOTAL) ──────────────────
//
//  A total lookup into the SSOT table: every (scope, band) pair resolves to exactly
//  one container in the closed set. This is the function every surface calls; none
//  decides its own placement.
//
export function resolveSurface(scope: PlacementScope, weight: WeightBand): Container {
  return PLACEMENT_TABLE[scope][weight]
}

// ── placeSubject — the one-call composition (shape → weight → container) ────────
//
//  Convenience over the two halves: weigh the subject, then resolve. This is the
//  primitive most consumers will use directly.
//
export function placeSubject(scope: PlacementScope, shape: SubjectShape): Container {
  return resolveSurface(scope, deriveWeight(shape))
}
