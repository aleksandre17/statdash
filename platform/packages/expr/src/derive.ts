import type { DeriveMap, DimVal, ExprScope, ExprVal } from './types.ts'
import { evalExpr } from './eval.ts'

// ── isDevMode ────────────────────────────────────────────────────────────────
//
//  @statdash/expr is a zero-dep, bundler-agnostic package, so it must not
//  reference Vite's ambient `import.meta.env` types (that would couple it to one
//  bundler and break its own standalone `tsup --dts` build) nor Node's `process`
//  (a Node-ism, undefined in the browser). This self-contained accessor reads the
//  standard ESM `import.meta.env.DEV` flag through a local cast — no global
//  `ImportMeta` augmentation, so it can never weaken `import.meta` for consumers.
//  In a Vite build `DEV` is statically replaced; elsewhere it reads as falsy and
//  the dev-only branch is dead-stripped.
function isDevMode(): boolean {
  const env = (import.meta as { env?: { DEV?: boolean } }).env
  return env?.DEV === true
}

// ── evalDerived ────────────────────────────────────────────────────────────

// Evaluates each entry in declaration order, accumulating results.
// Each entry may reference $derived values from EARLIER entries only (DAG contract).
// Fail-safe: forward references return null (undefined propagates as null), never throw.
export function evalDerived(
  derive:    DeriveMap,
  baseScope: Pick<ExprScope, 'dims' | 'derived'>,
): Record<string, DimVal> {
  const accumulated: Record<string, DimVal> = { ...baseScope.derived }

  for (const entry of derive) {
    // Dev-mode: warn on $derived refs that haven't been evaluated yet.
    if (isDevMode()) {
      const refs = collectDerivedRefs(entry.expr)
      for (const ref of refs) {
        if (!(ref in accumulated)) {
          console.warn(
            `[evalDerived] forward reference: '${ref}' not yet evaluated when resolving '${entry.key}'. ` +
            `Check derive array order or run validateDeriveMap().`,
          )
        }
      }
    }

    const scope: ExprScope = { dims: baseScope.dims, derived: accumulated }
    accumulated[entry.key] = evalExpr(entry.expr, scope)
  }

  return accumulated
}

// ── validateDeriveMap ──────────────────────────────────────────────────────

export interface DeriveOrderError {
  key:           string   // entry whose expr contains the problematic reference
  referencedKey: string   // the $derived key that caused the problem
  reason:        'forward-ref' | 'circular'
}

// Collects all $derived key references within an ExprVal tree.
function collectDerivedRefs(expr: ExprVal): Set<string> {
  const refs = new Set<string>()

  function walk(e: unknown): void {
    if (e === null || typeof e !== 'object' || Array.isArray(e)) return

    const obj = e as Record<string, unknown>

    if ('$derived' in obj) {
      refs.add(obj['$derived'] as string)
      return  // ExprRef leaf — no children to walk
    }

    // Other ExprRef variants ($ctx, $row, $literal) — no $derived refs
    if ('$ctx' in obj || '$row' in obj || '$literal' in obj) return

    if (!('op' in obj)) return

    // Expr — walk all ExprVal children by op
    const op = obj['op'] as string

    switch (op) {
      case 'eq':  case 'ne':  case 'gt': case 'lt':
      case 'gte': case 'lte': case 'add': case 'sub':
      case 'mul': case 'div': case 'mod':
        walk(obj['left']); walk(obj['right']); break

      case 'in': case 'nin':
        walk(obj['left'])
        ;(obj['right'] as unknown[]).forEach(walk); break

      case 'null': case 'exists': walk(obj['value']); break

      case 'abs': case 'neg': walk(obj['value']); break

      case 'and': case 'or':
        ;(obj['exprs'] as unknown[]).forEach(walk); break

      case 'not': walk(obj['expr']); break

      case 'if':
        walk(obj['cond']); walk(obj['then'])
        if ('else' in obj) walk(obj['else']); break

      case 'template': break  // string literal — no ExprVal refs

      case 'concat': (obj['values'] as unknown[]).forEach(walk); break

      case 'startsWith': case 'includes':
        walk(obj['left']); break  // right is string literal

      case 'get': walk(obj['ref']); break  // ref: ExprRef

      case 'coalesce': (obj['values'] as unknown[]).forEach(walk); break

      case 'some': case 'every': case 'filter':
        walk(obj['expr']); break

      case 'map': walk(obj['expr']); break

      case 'count': break  // no ExprVal children
    }
  }

  walk(expr)
  return refs
}

// Topological validation: detects forward references and dependency cycles.
// Returns [] when DeriveMap is a valid DAG. Non-empty = authoring error.
// Use at: Constructor save gate, CI config lint, test assertions.
export function validateDeriveMap(derive: DeriveMap): DeriveOrderError[] {
  const errors: DeriveOrderError[] = []

  const keyIndex = new Map<string, number>()
  for (let i = 0; i < derive.length; i++) keyIndex.set(derive[i].key, i)
  const allKeys = new Set(keyIndex.keys())

  // Phase 1 — forward-reference detection (linear pass in declaration order)
  for (let i = 0; i < derive.length; i++) {
    const entry = derive[i]
    const refs  = collectDerivedRefs(entry.expr)
    for (const ref of refs) {
      const refIdx = keyIndex.get(ref)
      if (refIdx !== undefined && refIdx > i) {
        errors.push({ key: entry.key, referencedKey: ref, reason: 'forward-ref' })
      }
    }
  }

  // Phase 2 — cycle detection (DFS on full dependency graph)
  const visited  = new Set<string>()
  const onPath   = new Set<string>()
  const cycleIds = new Set<string>()  // dedup 'key:ref' pairs

  function dfs(key: string): void {
    if (onPath.has(key) || visited.has(key)) return
    visited.add(key)
    onPath.add(key)

    const idx = keyIndex.get(key)
    if (idx !== undefined) {
      const refs = collectDerivedRefs(derive[idx].expr)
      for (const ref of refs) {
        if (!allKeys.has(ref)) continue
        if (onPath.has(ref)) {
          const id = `${key}:${ref}`
          if (!cycleIds.has(id)) {
            cycleIds.add(id)
            const existing = errors.find(e => e.key === key && e.referencedKey === ref)
            if (existing) existing.reason = 'circular'
            else errors.push({ key, referencedKey: ref, reason: 'circular' })
          }
        } else {
          dfs(ref)
        }
      }
    }

    onPath.delete(key)
  }

  for (const key of allKeys) dfs(key)

  return errors
}