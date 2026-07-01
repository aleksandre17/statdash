// ── prop-visibility.ts — the ONE `PropField.showWhen` evaluator (SSOT) ──────
//
//  PropField.showWhen documents "chartType === 'bar'" style conditions. There is
//  exactly ONE evaluator for that grammar in the whole tree — the runner and the
//  Constructor must agree on when a field is visible, or a field the author sees
//  and edits could be dark (or vice-versa) at render. SSOT + DRY.
//
//  Safe by construction (Law: safe expression evaluation, no arbitrary code-exec):
//  we PARSE the documented `lhs === rhs` shape — never `eval`. Anything we cannot
//  parse is treated as "always visible" (Postel's Law: liberal in author input,
//  never throw). Richer sandboxed expressions are a later enhancement.
//
//  Named `evalShowWhen` (not `isVisible`) deliberately: `isVisible` is already the
//  FilterSchema VisibilityExpr evaluator (`config/filter`). This is a different,
//  narrower grammar (a PropField's authoring-form visibility hint), so it gets its
//  own name — the panel re-exports it under its local `isVisible` alias.
//
import { getAtPath } from './prop-path'

/**
 * True if a field with the given `showWhen` is visible against `values`.
 * Supports `lhs === rhs` (quoted or bare rhs); compares as strings so
 * 'bar' === 'bar' and 5 === '5' both behave intuitively. Absent/unparseable
 * condition ⇒ visible (Postel).
 */
export function evalShowWhen(
  showWhen: string | undefined,
  values: Record<string, unknown>,
): boolean {
  if (!showWhen) return true
  const m = /^\s*([\w.]+)\s*===\s*(.+?)\s*$/.exec(showWhen)
  if (!m) return true
  const [, lhs, rhsRaw] = m
  const actual = getAtPath(values, lhs)
  const rhs    = rhsRaw.replace(/^['"]|['"]$/g, '')
  return String(actual ?? '') === rhs
}
