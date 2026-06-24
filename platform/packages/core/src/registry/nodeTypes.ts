// ── Node-Type Registry — the known-placeable-type SET (structural floor) ──
//
//  ADR adr-config-and-render-vision §7.3. The engine-tier structural
//  validator (validateConfig) needs the SET of valid node `type`
//  discriminants — NOT per-type field knowledge. That set is OWNED by the
//  react NodeRegistry (which knows the concrete shapes); core holds only a
//  DERIVED projection, populated at startup by react's register-all via
//  registerNodeType(t) (a later wiring step). Core ships NO hardcoded
//  node-type list — mirroring a list here would drift the moment react
//  registers a new type (the exact bug the spec-type registry avoids).
//
//  FAIL-OPEN when empty: before react injects, the set is empty; in that
//  state validateConfig SKIPS the "type ∈ known set" check rather than
//  failing every node. This mirrors validateDataSpec's tolerance of an
//  empty spec registry (pipeline.ts) — we cannot call a type unknown if we
//  do not yet know the registered set. Isolated engine/api use (no react
//  loaded) therefore never false-rejects on type.
//

const _nodeTypes = new Set<string>()

/**
 * Register a known placeable node `type`. Idempotent (Set semantics).
 *
 * Called by react's register-all for every type it registers in the
 * nodeRegistry, so the engine learns the authoritative set by injection.
 * apps/api may register the core-owned structural types it can validate
 * even without react loaded.
 */
export function registerNodeType(type: string): void {
  _nodeTypes.add(type)
}

/** All registered node `type` keys. Empty ⇒ fail-open (type check skipped). */
export function knownNodeTypes(): string[] {
  return [..._nodeTypes]
}

/** Is `type` a registered placeable node type? */
export function hasNodeType(type: string): boolean {
  return _nodeTypes.has(type)
}

/**
 * Clear the registry. TEST-ONLY seam — lets fitness tests install a known
 * set in isolation and restore fail-open afterward. Not part of the
 * production contract (production only ever grows the set at startup).
 */
export function _resetNodeTypes(): void {
  _nodeTypes.clear()
}
