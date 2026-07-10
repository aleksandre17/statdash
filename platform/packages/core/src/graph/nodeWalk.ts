// ── graph/nodeWalk — the shared generic node-tree walker [AR-49 V2 / ADR-024] ─
//
//  CONSOLIDATED INTO CORE (ADR-024 §3). This walker was born in
//  `packages/react/src/engine/targets/nodeWalk.ts` (extracted from api.ts + warm.ts
//  — Law 5, one concern one home) but is PURE and STRUCTURAL: no registry, no React,
//  no DOM. V2's `compilePage` (core) must walk the same tree the render/warm/api
//  targets walk, so the single source of truth is re-homed here, arrow-clean. The
//  react target file now RE-EXPORTS from core (byte-identical for every existing
//  importer: api.ts, warm.ts, navUtils.ts).
//
//  Generic walk — no registry coupling. Any field whose value is:
//    - an array whose items include objects with `type: string` → child nodes
//    - a plain object with `type: string`                       → single child node
//  …EXCEPT the DATA-CARRYING keys, which hold config payloads (DataSpec,
//  TransformStep[], …) whose `type`/`op` is a DISCRIMINANT, never a child renderable.

export type GenericNode = Record<string, unknown> & { type: string }

// A value under one of these keys carries a `type`/`op`/config DISCRIMINANT but is
// NOT a structural child renderable — never walk it as a node tree (its refs belong
// to the host node). This is the SAME boundary the extractDeps ground-truth scanner
// and the V0 baseline corpus scanner use — one distinction, one home.
export const DATA_CARRYING_KEYS = new Set([
  'data',         // DataSpec — the primary data-carrying field
  'transforms',   // TransformStep[] — pipeline, not children
  'fieldConfig',  // FieldConfig — config object, not a child node
  'dataLinks',    // DataLinkDef[] — link definitions, not children
  'vars',         // VarMap — variable definitions
  'view',         // ViewParams — config object
  'filterSchema', // FilterSchema — filter definitions
  'perspectives', // PerspectivesByParam — perspective-axis config
  'computed',     // ComputedMap — computed filter values
  'crossValidate',// CrossValidator[] — filter validators
  'context',      // SectionContext — context config
  'store',        // DataStore — store reference
])

/**
 * Type-guard: returns true when a value looks like a renderable node object.
 * A node must be a non-null, non-array object with a `type` string field.
 */
export function isNodeObject(val: unknown): val is GenericNode {
  return (
    val !== null &&
    typeof val === 'object' &&
    !Array.isArray(val) &&
    typeof (val as Record<string, unknown>)['type'] === 'string'
  )
}

/**
 * Walk every field of `node` and collect all DIRECT child-node objects (one level).
 *
 * Returns every value (direct or array-item) that satisfies `isNodeObject`.
 * Preserves document order within each field; field order follows `Object.keys()`.
 * Keys listed in `DATA_CARRYING_KEYS` are never treated as structural child slots.
 */
export function collectChildNodes(node: Record<string, unknown>): GenericNode[] {
  const children: GenericNode[] = []
  for (const key of Object.keys(node)) {
    if (DATA_CARRYING_KEYS.has(key)) continue
    const val = node[key]
    if (Array.isArray(val)) {
      for (const item of val) if (isNodeObject(item)) children.push(item)
    } else if (isNodeObject(val)) {
      children.push(val)
    }
  }
  return children
}

/** A renderable paired with the deterministic, stable id `compilePage` addresses it by. */
export interface WalkedNode {
  /** Stable structural id — `node.id` when present & unique, else the tree path. */
  id:   string
  node: GenericNode
  /** The document path (parent chain) — used to break `node.id` collisions/absence. */
  path: string
}

/**
 * DEEP-walk a config tree and collect EVERY renderable node (the root included when
 * it is itself renderable), each with a stable, deterministic id. This is the walk
 * `compilePage` runs to build one graph cell per data-bearing node.
 *
 * Id rule (deterministic, order-independent, collision-free):
 *   • the structural PATH (`root`, `root.sections[0]`, `root.sections[0].children[2]`)
 *     is always the fallback and is unique by construction;
 *   • when a node carries a string `id`, it is PREFERRED (stable across reorders in a
 *     Constructor), but de-duplicated by suffixing the path if the same `id` recurs.
 *
 * Respects the same `DATA_CARRYING_KEYS` / `type`-discriminant boundary as the one-
 * level walker: a DataSpec/TransformStep is descended for the host node but is never
 * counted as a child renderable.
 */
export function collectNodesDeep(root: unknown): WalkedNode[] {
  const out: WalkedNode[] = []
  const seenId = new Set<string>()

  const visit = (val: unknown, path: string): void => {
    if (isNodeObject(val)) {
      const rawId = typeof val['id'] === 'string' && val['id'] ? (val['id'] as string) : path
      const id = seenId.has(rawId) ? `${rawId}@${path}` : rawId
      seenId.add(id)
      out.push({ id, node: val, path })
    }
    if (val === null || typeof val !== 'object') return
    if (Array.isArray(val)) {
      val.forEach((item, i) => visit(item, `${path}[${i}]`))
      return
    }
    for (const key of Object.keys(val as Record<string, unknown>)) {
      if (DATA_CARRYING_KEYS.has(key)) continue      // config payload, not a child tree
      visit((val as Record<string, unknown>)[key], path === '' ? key : `${path}.${key}`)
    }
  }

  visit(root, 'root')
  return out
}
