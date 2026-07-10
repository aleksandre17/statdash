// ── Placement Law · weight (AR-49 SL-0 → reconciled SL-0b) ─────────────────────
//
//  HALF ONE of the Placement Law (the other is `resolveSurface.ts`). WEIGHT is
//  the *magnitude* axis: how much authoring surface a subject demands, derived
//  purely from its SHAPE — never from what kind of editor/node it is. A subject
//  is weighed once, here, and that band feeds the scope×weight → container table.
//
//  ── Two weight vocabularies, one aligned model (SPEC §3.1) ────────────────────
//  The canonical model (§3.1) names THREE weights — `glance | form | workspace`:
//      glance     : weight ≈ 1               (a single, transient property)
//      form       : weight ≤ FORM_BUDGET     (fits the bounded dock column)
//      workspace  : weight > FORM_BUDGET  OR  dominated by a rich type
//  We keep a FINER, four-band shape magnitude (`WeightBand`) because the dock
//  makes one more container-level distinction the 3-weight axis cannot express:
//  a light form subject renders IN-PLACE (inline, no drill) while a heavier one
//  DRILLS (§4 / D7.1b). The four bands roll up onto the canonical three via
//  `toCanonicalWeight` (proven agreement in `placement.fitness.test.ts`):
//      flat · grouped · nested  →  form        (oversize → workspace)
//  `glance` is not a shape band — it is the `micro-target` scope / POPOVER end of
//  the ladder (a single-property edit is glance by definition), so it is carried
//  positionally by scope, not by magnitude. See `resolveSurface.ts`.
//
//  ── ONE threshold SSOT (do not fork) ─────────────────────────────────────────
//  This GENERALIZES the deep-authorability §4 / D7.1b weight notion already
//  enforced in the nested-item editor — it does NOT invent a second threshold:
//    • `inlineMaxFields` (4) is the point past which flat, in-place presentation
//      stops scaling. It is the SAME "4" the Inspector uses for
//      `GROUP_TAB_THRESHOLD` and the §4 INLINE/DRILL split (`weight ≤ 4`).
//    • `maxDrillDepth` (8) is the SAME backstop as `NestedItemControl`'s private
//      `MAX_NESTING` (8) — the depth past which drill-in stops being comfortable
//      and the subject must escape to its own screen (a FOCUS-VIEW). It coincides
//      with the canonical FORM_BUDGET (8): both are the "escape the dock" line.
//  These two are the whole threshold set. When SL-1+ rewires consumers, D7.1b's
//  `MAX_NESTING` and the Inspector's `GROUP_TAB_THRESHOLD` should read FROM this
//  SSOT (Strangler-Fig) so the number lives in exactly one place. This step only
//  lands the primitive — it does not yet touch those consumers.
//
//  Pure + framework-free by construction: no React, no store, no DOM, no side
//  effects. Trivially testable, and reusable by every surface that later asks
//  "where does this subject go?" through `resolveSurface`.
//

// ── Threshold SSOT — the ONLY placement magic numbers, named + provenanced ─────
export const WEIGHT_THRESHOLDS = {
  /** Flat (scalar) fields that still fit an inline / single-panel presentation.
   *  Past this, a subject needs grouping (tabs/accordion) or a drill. Mirrors the
   *  Inspector's `GROUP_TAB_THRESHOLD` (4) and the §4 INLINE/DRILL split. */
  inlineMaxFields: 4,
  /** Nesting depth past which drill-in navigation stops being comfortable and the
   *  subject must escape to a FOCUS-VIEW. Mirrors `NestedItemControl.MAX_NESTING`
   *  (8) — the same backstop, expressed once. Coincides with FORM_BUDGET (8). */
  maxDrillDepth: 8,
} as const

// ── CanonicalWeight — the SPEC §3.1 three-weight axis (the placement table key) ─
//
//  The authoritative weight vocabulary. `glance` is reached positionally (the
//  `micro-target` scope / POPOVER end); the shape-derived `WeightBand` below rolls
//  up onto `form | workspace` via `toCanonicalWeight`.
//
export type CanonicalWeight = 'glance' | 'form' | 'workspace'

/** Ascending magnitude order of the canonical weights. */
export const CANONICAL_WEIGHTS: readonly CanonicalWeight[] = ['glance', 'form', 'workspace'] as const

// ── WeightBand — the finer, shape-derived magnitude (dock inline-vs-drill refine) ─
//
//  Four bands, in increasing magnitude, mapping 1:1 onto the deep-authorability §4
//  taxonomy the nested-item editor already lives by (flat scalars render inline;
//  nested structure drills; over-depth / rich types escape). They roll up onto the
//  canonical three (flat/grouped/nested → form; oversize → workspace):
//    flat     — a handful of flat scalar fields; presentable in place (INLINE).
//    grouped  — more flat fields than fit inline, but still one (grouped) panel.
//    nested   — carries nested array/object structure; needs progressive drill.
//    oversize — past the dock budget (deep, or a rich type); needs its own screen.
//
export type WeightBand = 'flat' | 'grouped' | 'nested' | 'oversize'

/** Ascending magnitude order — the canonical ordering of the closed band set. */
export const WEIGHT_BANDS: readonly WeightBand[] = ['flat', 'grouped', 'nested', 'oversize'] as const

/** Roll a fine shape band up onto the canonical §3.1 weight it belongs to.
 *  `glance` is intentionally unreachable here — it is a SCOPE position
 *  (micro-target / single transient property), not a shape magnitude. */
export function toCanonicalWeight(band: WeightBand): Exclude<CanonicalWeight, 'glance'> {
  return band === 'oversize' ? 'workspace' : 'form'
}

// ── SubjectShape — the pure descriptor a subject is weighed from ───────────────
//
//  Deliberately abstract: it carries only the STRUCTURAL facts that drive size —
//  never an editor name, node type, or any domain literal. Any surface can derive
//  this from its schema/value without the placement law knowing what it holds.
//
export interface SubjectShape {
  /** Count of flat (scalar) editable fields at the subject's top level. */
  flatFields: number
  /** Does the subject contain nested array/object structure (drill-worthy)?
   *  Defaults to `depth > 0` when omitted. */
  hasNested?: boolean
  /** Maximum nesting depth of the subject's structure (0 = flat). */
  depth?: number
  /** Is the subject dominated by a RICH type (DataSpec | ChartDef | VisibilityExpr
   *  | MetricCalc)? Per §3.1 a rich type is workspace-weight regardless of breadth —
   *  it escapes the dock to a FOCUS-VIEW. Abstract flag: the law never names types. */
  hasRichType?: boolean
}

// ── deriveWeight — SubjectShape → WeightBand (pure, total) ──────────────────────
//
//  The single point where raw shape becomes an ordinal band, using ONLY the SSOT
//  thresholds and the canonical §3.1 rules. A rich type dominates (→ oversize);
//  then over-depth (→ oversize); then any nesting is `nested`; then breadth alone
//  decides flat vs grouped. Total over all inputs — one band per shape.
//
export function deriveWeight(shape: SubjectShape): WeightBand {
  const depth = shape.depth ?? 0
  const hasNested = shape.hasNested ?? depth > 0

  if (shape.hasRichType) return 'oversize' // §3.1: a rich type is workspace-weight, always
  if (depth > WEIGHT_THRESHOLDS.maxDrillDepth) return 'oversize'
  if (hasNested) return 'nested'
  if (shape.flatFields > WEIGHT_THRESHOLDS.inlineMaxFields) return 'grouped'
  return 'flat'
}
