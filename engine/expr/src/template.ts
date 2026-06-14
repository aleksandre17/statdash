import type { ExprScope } from './types.ts'

// Evaluates '{key}' placeholders — checks scope.dims first, then scope.derived.
// Unknown keys → empty string (fail-safe, no throw).
export function evalTemplate(tmpl: string, scope: ExprScope): string {
  return tmpl.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const val = scope.dims[key] ?? scope.derived[key] ?? null
    return val === null ? '' : String(val)
  })
}