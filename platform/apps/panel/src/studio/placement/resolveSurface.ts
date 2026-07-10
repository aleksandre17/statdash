// ── Placement Law · resolveSurface (AR-49 SL-0 → reconciled SL-0b, SPEC §3.2) ──
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
//  ── Canonical alignment (SPEC §3.2) ──────────────────────────────────────────
//  The scope set is the canonical FIVE (`micro-target · element · nested-item ·
//  page · site`) and the escalation ladder is the canonical POPOVER (glance) →
//  DOCK-PANEL / DOCK-DRILL (form) → FOCUS-VIEW (workspace). `PLACEMENT_TABLE` is
//  keyed by the finer four `WeightBand`s (so the dock's inline-vs-drill refinement
//  survives — §4 / D7.1b); `CANONICAL_TABLE` below encodes §3.2's three-weight
//  cells verbatim, and the fitness proves the fine table PROJECTS onto it.
//
//  Pure + framework-free: no React, no store, no DOM, no side effects.
//
import type { CanonicalWeight, WeightBand } from './weight'
import { deriveWeight, toCanonicalWeight, type SubjectShape } from './weight'

// ── Container — the CLOSED surface set (SSOT) ──────────────────────────────────
//
//  Every place a subject can be authored. String literals so the whole model is
//  JSON-serializable (config-is-data spirit). Ordered lightest → heaviest below.
//    inline            — rendered in place inside the dock body (no drill); the §4
//                        INLINE accordion for a light form nested-item.
//    popover           — a light, trigger-anchored floating editor (glance edit).
//    dock-panel        — the right dock's element/page panel (the default form home).
//    dock-drill        — progressive drill-in *within* the dock (the D7.1b editor).
//    focus-view        — a SEPARATE Studio route/screen (realized SL-2) for
//                        workspace-weight subjects; SL-4 wires the nested-item drill
//                        boundary to escalate INTO it when this verdict is returned.
//    relocated-surface — a dedicated left-dock / relocated home (Pages&Site, Model,
//                        global Style) for site-scope subjects; off the weight ladder.
//
export type Container =
  | 'inline'
  | 'popover'
  | 'dock-panel'
  | 'dock-drill'
  | 'focus-view'
  | 'relocated-surface'

// ── PlacementScope — the CLOSED, canonical FIVE-scope set (SSOT · §3.2) ─────────
//
//  A subject's relationship to the current focus — the axis orthogonal to weight.
//    micro-target — ONE property of the selected element (glance; recolor/rename).
//    element      — the selected node/chrome (its own inspector; the dock element home).
//    nested-item  — an array/object item inside the element's props (the D7.1b drill).
//    page         — page-level authoring: config · perspectives · the filters pipeline.
//    site         — site / data-model / global authoring; belongs to a dedicated home.
//
export type PlacementScope = 'micro-target' | 'element' | 'nested-item' | 'page' | 'site'

// ── The escalation ladder — capacity order for the invariant ───────────────────
//
//  The weight-escalation containers, lightest → heaviest. `relocated-surface` is
//  deliberately NOT here: site scope is a weight-independent HOME, so it never
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

// ── PLACEMENT_TABLE — the SSOT arrangement (scope × weight-band → container) ────
//
//  Read this as the law itself. Keyed by the finer four `WeightBand`s so the dock's
//  INLINE-vs-DRILL refinement (§4 / D7.1b) survives; each row escalates left→right
//  as weight grows, and every weight-laddered row terminates at `focus-view` for an
//  oversize subject (FF-NO-CRAMMED-DOCK: nothing oversize stays in the dock).
//
//    scope \ band  | flat        | grouped     | nested      | oversize
//    ------------- | ----------- | ----------- | ----------- | ----------
//    micro-target  | popover     | popover     | dock-drill  | focus-view
//    element       | dock-panel  | dock-panel  | dock-drill  | focus-view
//    nested-item   | inline      | dock-drill  | dock-drill  | focus-view
//    page          | dock-panel  | dock-panel  | dock-drill  | focus-view
//    site          | relocated   | relocated   | relocated   | relocated   (weight-independent)
//
export const PLACEMENT_TABLE: Readonly<Record<PlacementScope, Readonly<Record<WeightBand, Container>>>> = {
  // §3.2 micro-target · glance → POPOVER. A single transient property pops over; if
  // it were ever weighed heavier it is really a section — we complete totality by
  // escalating up the ladder (it stops being a popover), mirroring `element`.
  'micro-target': {
    flat: 'popover', grouped: 'popover', nested: 'dock-drill', oversize: 'focus-view',
  },
  // §3.2 element · form → RIGHT DOCK (the Inspector); nested structure drills; only a
  // subject past the dock budget escapes to its own screen (workspace → FOCUS-VIEW).
  element: {
    flat: 'dock-panel', grouped: 'dock-panel', nested: 'dock-drill', oversize: 'focus-view',
  },
  // §3.2 nested-item · form → DOCK DRILL, with the §4 refinement: a light (flat) item
  // renders INLINE in the dock body (no drill); a structured one drills; a workspace
  // one (rich-type / over-depth) escapes. This IS the deep-authorability column.
  'nested-item': {
    flat: 'inline', grouped: 'dock-drill', nested: 'dock-drill', oversize: 'focus-view',
  },
  // §3.2 page · form → RIGHT DOCK (Page context: config · perspectives); page
  // workspace (the filters pipeline · perspective builder) escalates to FOCUS-VIEW —
  // stacking it in the dock is exactly the reported cram.
  page: {
    flat: 'dock-panel', grouped: 'dock-panel', nested: 'dock-drill', oversize: 'focus-view',
  },
  // §3.2 site / data-model / workspace is a weight-independent HOME, not a ladder: it
  // always lands on its own relocated surface (LEFT-DOCK Pages&Site · RELOCATED Model /
  // Style), which manages its internal weight (incl. its own focus-views) itself.
  site: {
    flat: 'relocated-surface', grouped: 'relocated-surface',
    nested: 'relocated-surface', oversize: 'relocated-surface',
  },
} as const

// ── CANONICAL_TABLE — the SPEC §3.2 three-weight cells, encoded verbatim ────────
//
//  The authoritative table exactly as §3.2 states it (glance/form/workspace). Cells
//  the spec marks "n/a" are omitted (partial rows). This exists so the fitness can
//  PROVE the finer `PLACEMENT_TABLE` projects onto the canonical law — the two
//  vocabularies are one model, not two. It is DATA, never branched on at runtime.
//
export const CANONICAL_TABLE: Readonly<
  Record<PlacementScope, Partial<Record<CanonicalWeight, Container>>>
> = {
  'micro-target': { glance: 'popover' },
  element: { glance: 'popover', form: 'dock-panel', workspace: 'focus-view' },
  'nested-item': { glance: 'popover', form: 'dock-drill', workspace: 'focus-view' },
  page: { glance: 'popover', form: 'dock-panel', workspace: 'focus-view' },
  site: { form: 'relocated-surface', workspace: 'relocated-surface' },
} as const

/** The canonical weight family a container answers to (§3.1). `relocated-surface`
 *  is the off-ladder site HOME and has no ladder weight. */
export function containerWeightFamily(container: Container): CanonicalWeight | 'home' {
  switch (container) {
    case 'popover':
      return 'glance'
    case 'inline':
    case 'dock-panel':
    case 'dock-drill':
      return 'form'
    case 'focus-view':
      return 'workspace'
    case 'relocated-surface':
      return 'home'
  }
}

// ── resolveSurface — (scope, band) → container (pure, TOTAL) ────────────────────
//
//  A total lookup into the SSOT table: every (scope, band) pair resolves to exactly
//  one container in the closed set. This is the function every surface calls; none
//  decides its own placement.
//
export function resolveSurface(scope: PlacementScope, weight: WeightBand): Container {
  return PLACEMENT_TABLE[scope][weight]
}

// ── placeSubject — the one-call composition (shape → band → container) ──────────
//
//  Convenience over the two halves: weigh the subject, then resolve. This is the
//  primitive most consumers will use directly.
//
export function placeSubject(scope: PlacementScope, shape: SubjectShape): Container {
  return resolveSurface(scope, deriveWeight(shape))
}

// re-exported for consumers that want the projection without importing `./weight`.
export { toCanonicalWeight }
