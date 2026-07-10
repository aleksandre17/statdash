// ── Placement Law (AR-49 SL-0) — public surface ───────────────────────────────
//
//  The pure primitive that derives WHERE any editable subject is authored, from
//  its scope × weight. One import site for every consumer surface (SL-1+):
//    placeSubject(scope, shape) → Container    // the one-call form
//    resolveSurface(scope, weight) → Container // scope × pre-weighed band
//    deriveWeight(shape) → WeightBand          // shape → magnitude band
//
export {
  deriveWeight, WEIGHT_THRESHOLDS, WEIGHT_BANDS,
  type WeightBand, type SubjectShape,
} from './weight'
export {
  resolveSurface, placeSubject, PLACEMENT_TABLE, ESCALATION_LADDER, capacityRank,
  type Container, type PlacementScope,
} from './resolveSurface'
