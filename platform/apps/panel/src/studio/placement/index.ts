// ── Placement Law (AR-49 SL-0b) — public surface ──────────────────────────────
//
//  The pure primitive that derives WHERE any editable subject is authored, from
//  its scope × weight (aligned to SPEC §3.2). One import site for every consumer
//  surface (SL-1+):
//    placeSubject(scope, shape) → Container       // the one-call form
//    resolveSurface(scope, weight) → Container     // scope × pre-weighed band
//    deriveWeight(shape) → WeightBand              // shape → magnitude band
//    toCanonicalWeight(band) → CanonicalWeight     // roll the band onto §3.1's three
//
export {
  deriveWeight, toCanonicalWeight,
  WEIGHT_THRESHOLDS, WEIGHT_BANDS, CANONICAL_WEIGHTS,
  type WeightBand, type CanonicalWeight, type SubjectShape,
} from './weight'
export {
  resolveSurface, placeSubject, containerWeightFamily,
  PLACEMENT_TABLE, CANONICAL_TABLE, ESCALATION_LADDER, capacityRank,
  type Container, type PlacementScope,
} from './resolveSurface'
