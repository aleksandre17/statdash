// ── targets/nodeWalk.ts — shared generic node-tree walker ────────────────────
//
//  Extracted from api.ts + warm.ts where the same isNodeObject predicate and
//  child-collection logic was duplicated (Law 5: one concern, one home).
//
//  Generic walk — no registry coupling, no React.  Any field whose value is:
//    - an array whose items include objects with `type: string` → child nodes
//    - a plain object with `type: string`                       → single child node
//
//  Correctly handles `children`, `sections`, `items`, `header`, `footer`,
//  and any future node-bearing field without coupling to concrete node shapes.
//

export type GenericNode = Record<string, unknown> & { type: string }

// Hotfix (Option A: denylist). Structural fix (Option B) injects an
// isChildSlot(node, key) predicate backed by the nodeRegistry slot taxonomy —
// see docs/plan/JSON-TARGET-GAPS.md G8.
export const DATA_CARRYING_KEYS = new Set([
  'data',         // DataSpec — the primary data-carrying field
  'transforms',   // TransformStep[] — pipeline, not children
  'fieldConfig',  // FieldConfig — config object, not a child node
  'dataLinks',    // DataLinkDef[] — link definitions, not children
  'vars',         // VarMap — variable definitions
  'view',         // ViewParams — config object
  'filterSchema', // FilterSchema — filter definitions
  'modeOrder',    // string[] — mode config
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
 * Walk every field of `node` and collect all child-node objects.
 *
 * Returns an array of every value (direct or array-item) that satisfies
 * `isNodeObject`.  Preserves document order within each field; field order
 * follows `Object.keys()`.
 *
 * Keys listed in `DATA_CARRYING_KEYS` are never treated as structural child
 * slots — they carry data payloads (DataSpec, TransformStep[], etc.) and must
 * not be walked as node trees.
 */
export function collectChildNodes(node: Record<string, unknown>): GenericNode[] {
  const children: GenericNode[] = []

  for (const key of Object.keys(node)) {
    if (DATA_CARRYING_KEYS.has(key)) continue

    const val = node[key]

    if (Array.isArray(val)) {
      for (const item of val) {
        if (isNodeObject(item)) children.push(item)
      }
    } else if (isNodeObject(val)) {
      children.push(val)
    }
  }

  return children
}
