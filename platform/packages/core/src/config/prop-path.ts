// ── prop-path.ts — the dot-path grammar for authored config (SSOT) ──────────
//
//  ONE authoritative reader/writer for the `PropField.field` dot-path grammar
//  ('title', 'view.width', 'fields.0'). Both the runner (validate stored config)
//  and the authoring tool (Inspector read/write, save-guard) address config by
//  the SAME grammar — if they diverged, a field written by the Inspector could be
//  misread at render (a correctness bug, not a style nit). SSOT + DRY.
//
//  WHY core (the arrow): the grammar is pure config-semantics — no React, no app.
//  A TransformStep op's PropField (in packages/core) and the panel Inspector must
//  read the same path the same way, so the SSOT belongs beside `prop-schema.ts`
//  in core, re-exported through `@statdash/react/engine` (import sites unchanged).
//
//  Read/write parity is the invariant: a numeric segment addresses an array index
//  on BOTH sides. `getAtPath` reaches array elements via JS bracket access
//  (`arr['0'] === arr[0]`); `setAtPath` creates/descends arrays for numeric
//  segments so what the Inspector writes is exactly what the runner reads back.
//

// ── getAtPath — resolve a dot-path into a nested object/array ────────────────
//
/**
 * Resolve a dot-path string into a nested object or array.
 * 'view.width' against { view: { width: 42 } } → 42.
 * 'fields.0'   against { fields: ['a','b'] }    → 'a'  (numeric segment = index).
 * Returns undefined for any missing/non-object segment (Postel: never throws).
 */
export function getAtPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj
  for (const seg of path.split('.')) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[seg]
  }
  return cur
}

// ── setAtPath — immutable dual of getAtPath ─────────────────────────────────

/** True if a path segment addresses an array index (a non-negative integer). */
function isIndexSegment(seg: string): boolean {
  return /^\d+$/.test(seg)
}

/** Shallow clone of a container, preserving array-ness (structural sharing). */
function cloneContainer(node: unknown, asArray: boolean): Record<string, unknown> | unknown[] {
  if (Array.isArray(node)) return node.slice()
  if (node !== null && typeof node === 'object') return { ...(node as Record<string, unknown>) }
  // No (or scalar) container here yet → create one whose kind matches the segment.
  return asArray ? [] : {}
}

/**
 * Immutable dual of getAtPath: returns a NEW object/array with `value` written at
 * the dot-path, sharing every untouched branch by reference (so Zustand change
 * detection and the command-pattern undo/redo see exactly the touched path change).
 *
 * Mirrors getAtPath's path semantics precisely — same '.' delimiter, same segment
 * rules. Intermediate containers are created on demand: a numeric segment creates
 * (or descends into) an array, any other segment an object. Existing array indices
 * are written positionally. A top-level write (single segment) is the prior
 * shallow-merge behavior, exactly preserved.
 */
export function setAtPath<T>(obj: T, path: string, value: unknown): T {
  const segs = path.split('.')

  const write = (node: unknown, i: number): unknown => {
    const seg     = segs[i]
    const isLast  = i === segs.length - 1
    // The container kind at THIS level is dictated by the CURRENT segment's shape.
    const clone   = cloneContainer(node, isIndexSegment(seg))

    if (isIndexSegment(seg) && Array.isArray(clone)) {
      const idx = Number(seg)
      clone[idx] = isLast ? value : write(clone[idx], i + 1)
    } else {
      const rec = clone as Record<string, unknown>
      rec[seg] = isLast ? value : write(rec[seg], i + 1)
    }
    return clone
  }

  return write(obj, 0) as T
}
