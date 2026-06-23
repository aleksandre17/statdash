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

export { getAtPath }
