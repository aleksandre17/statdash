// ── promotionMode — the generic residence-promotion flag (ADR-023 · R2 expand) ──
//
//  "One Type System, One Tree, Two Residences." The Promotion Law (ADR-023 §3.3)
//  graduates a value-band item that carries ≥2 node facets into a first-class
//  registered node TYPE. A promotion lands Strangler-style (Law 7): the promoted
//  node type is built ALONGSIDE the legacy value-band path, and a flag selects
//  which residence renders. The legacy path stays fully working until its
//  FF-PROMOTION-LOSSLESS gate is machine-green over EVERY stored config — only
//  then does the one-way CONTRACT step retire it.
//
//  THIS FLAG IS GENERIC (Law 1 · Law 8 · OCP): it names NO specific promoted type.
//  A promotion is keyed by the promoted node-type string (`'kpi-card'` for R2,
//  `'hero-card'` for R3, …); the engine hardcodes none of them. A shell that owns a
//  legacy value-band path reads `isPromotionEnabled(<its-promoted-type>)` and
//  branches to the promoted-node render when the set contains it. Default is OFF
//  (empty set) — every promotion ships dark until its gate authorizes the contract.
//
//  Module-level singleton (survives StrictMode double-invoke). This is process
//  state, not React state — a promotion is a build/rollout decision, toggled at
//  boot (or by a fitness gate proving both residences), never per-render.
//

/** The set of promoted node types currently rendering through their PROMOTED residence. */
const enabled = new Set<string>()

/** Route a promoted node type's render through the tree band (its registered node type). */
export function enablePromotion(type: string): void {
  enabled.add(type)
}

/** Revert a promoted node type to its legacy value-band residence (Strangler expand). */
export function disablePromotion(type: string): void {
  enabled.delete(type)
}

/** Is this promoted node type currently rendering through its PROMOTED (tree-band) residence? */
export function isPromotionEnabled(type: string): boolean {
  return enabled.has(type)
}

/**
 * Run `fn` with `type` promoted, restoring the prior state afterwards. The test
 * seam FF-PROMOTION-LOSSLESS uses to render a corpus BOTH ways (legacy vs promoted)
 * and assert byte-identical output — the sole authorization for the contract.
 */
export function withPromotion<T>(type: string, fn: () => T): T {
  const was = enabled.has(type)
  enabled.add(type)
  try {
    return fn()
  } finally {
    if (!was) enabled.delete(type)
  }
}
