// ── Placement Law · weight (AR-49 SL-0) ───────────────────────────────────────
//
//  HALF ONE of the Placement Law (the other is `resolveSurface.ts`). WEIGHT is
//  the *magnitude* axis: how much authoring surface a subject demands, derived
//  purely from its SHAPE — never from what kind of editor/node it is. A subject
//  is weighed once, here, and that band feeds the scope×weight → container table.
//
//  ── ONE threshold SSOT (do not fork) ─────────────────────────────────────────
//  This GENERALIZES the deep-authorability weight notion D7.1b already enforces
//  in the nested-item editor — it does NOT invent a second, competing threshold:
//    • `inlineMaxFields` (4) is the point past which flat, in-place presentation
//      stops scaling. It is the SAME "4" the Inspector uses for
//      `GROUP_TAB_THRESHOLD` (≥4 labelled groups → tabs, not one long scroll).
//    • `maxDrillDepth` (8) is the SAME backstop as `NestedItemControl`'s private
//      `MAX_NESTING` (8) — the depth past which drill-in navigation stops being
//      comfortable and the subject must escape to its own screen (a FOCUS-VIEW),
//      not degrade to raw JSON inside a cramped dock.
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
   *  Inspector's `GROUP_TAB_THRESHOLD` (4) — the same "flat stops scaling" point. */
  inlineMaxFields: 4,
  /** Nesting depth past which drill-in navigation stops being comfortable and the
   *  subject must escape to a FOCUS-VIEW. Mirrors `NestedItemControl.MAX_NESTING`
   *  (8) — the same backstop, expressed once. */
  maxDrillDepth: 8,
} as const

// ── WeightBand — the closed, ordinal magnitude set (matches the D7.1b taxonomy) ─
//
//  Four bands, in increasing magnitude. They map 1:1 onto the deep-authorability
//  taxonomy the nested-item editor already lives by (flat scalars render inline;
//  nested structure drills; over-depth escapes):
//    flat     — a handful of flat scalar fields; presentable in place.
//    grouped  — more flat fields than fit inline, but still one (grouped) panel.
//    nested   — carries nested array/object structure; needs progressive drill.
//    oversize — deeper than the drill budget; must have its own screen.
//
export type WeightBand = 'flat' | 'grouped' | 'nested' | 'oversize'

/** Ascending magnitude order — the canonical ordering of the closed band set. */
export const WEIGHT_BANDS: readonly WeightBand[] = ['flat', 'grouped', 'nested', 'oversize'] as const

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
}

// ── deriveWeight — SubjectShape → WeightBand (pure, total) ──────────────────────
//
//  The single point where raw shape becomes an ordinal band, using ONLY the two
//  SSOT thresholds. Over-depth dominates (a deep structure is oversize regardless
//  of breadth); then any nesting is `nested`; then breadth alone decides flat vs
//  grouped. Total over all inputs — every shape resolves to exactly one band.
//
export function deriveWeight(shape: SubjectShape): WeightBand {
  const depth = shape.depth ?? 0
  const hasNested = shape.hasNested ?? depth > 0

  if (depth > WEIGHT_THRESHOLDS.maxDrillDepth) return 'oversize'
  if (hasNested) return 'nested'
  if (shape.flatFields > WEIGHT_THRESHOLDS.inlineMaxFields) return 'grouped'
  return 'flat'
}
