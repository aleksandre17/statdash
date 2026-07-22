// ── Lifecycle band placement — derived, never hand-picked (C3 · Placement Law) ────
//
//  The Authoring Lifecycle band (chip + Publish/Discard/History) is ONE component
//  placed by the Placement Law (studio/placement) in BOTH zooms of a stored config
//  document — the Model-floor workbench head (full) and the browser row (compact) —
//  NOT hand-mounted per host (DESIGN-0104 §2·C3 · DW-D lineage). Both zooms consult
//  THIS declaration; neither picks a surface with a literal.
//
//  The band acts on the WHOLE selected document (ELEMENT scope) and is structurally a
//  flat control cluster (a chip + a few buttons, no nested structure) → the law derives
//  the element's dock-panel as its container. Encoded as scope × shape, resolved by the
//  same `placeSubject` every editor uses — so a change to the law re-places the band for
//  free (OCP), and the fitness proves the placement is DERIVED, not a literal.
//
import { placeSubject, type Container, type PlacementScope } from '../../../studio/placement/resolveSurface'
import type { SubjectShape } from '../../../studio/placement/weight'

/** The band acts on the whole selected config document. */
export const LIFECYCLE_BAND_SCOPE: PlacementScope = 'element'

/** A flat control cluster (chip + Publish/Discard/History) — no nested structure. */
export const LIFECYCLE_BAND_SHAPE: SubjectShape = { flatFields: 3 }

/** The container the Placement Law derives for the band (the SSOT both zooms honor). */
export function resolveLifecycleBandContainer(): Container {
  return placeSubject(LIFECYCLE_BAND_SCOPE, LIFECYCLE_BAND_SHAPE)
}
