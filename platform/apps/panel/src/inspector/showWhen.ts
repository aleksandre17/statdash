// ── showWhen — safe conditional-field evaluation (NO eval) ───────────────────
//
//  PropField.showWhen documents "chartType === 'bar'" style conditions. We
//  support exactly that safe, declarative shape by PARSING — never eval (Law:
//  safe expression evaluation, no arbitrary code-exec). Anything we cannot parse
//  is treated as "always visible" (Postel's Law: liberal in author input,
//  never throw). Richer sandboxed expressions are a later enhancement.
//
//  Mirrors the engine PropSchemaForm's isVisible — kept panel-local so the
//  Inspector's conditional logic is unit-testable without the engine form.
//

/** Read a dot-path value off the props object (e.g. "view.width"). */
function getAtPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj
  for (const seg of path.split('.')) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[seg]
  }
  return cur
}

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
function setAtPath<T>(obj: T, path: string, value: unknown): T {
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

/**
 * True if a field with the given `showWhen` is visible against `props`.
 * Supports `lhs === rhs` (quoted or bare rhs); compares as strings so
 * 'bar' === 'bar' and 5 === '5' both behave intuitively.
 */
export function isVisible(showWhen: string | undefined, props: Record<string, unknown>): boolean {
  if (!showWhen) return true
  const m = /^\s*([\w.]+)\s*===\s*(.+?)\s*$/.exec(showWhen)
  if (!m) return true
  const [, lhs, rhsRaw] = m
  const actual = getAtPath(props, lhs)
  const rhs    = rhsRaw.replace(/^['"]|['"]$/g, '')
  return String(actual ?? '') === rhs
}

export { getAtPath, setAtPath }
