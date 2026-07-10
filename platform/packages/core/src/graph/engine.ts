// ── graph/engine — the reactive query-graph runtime [AR-49 V2 / ADR-024] ──────
//
//  A small, in-house, framework-free, ZERO-DEP reactive graph: the signals canon
//  (SolidJS / preact-signals / MobX mechanics) reduced to exactly what a config-
//  compiled dashboard dataflow needs — no more (ALT-C, SPEC §6: RxJS is the wrong
//  grain, preact-signals is a view-framework tie inside core, TanStack is React-tier
//  cache-not-graph semantics). The engine owns three properties and nothing else:
//
//    • PULL-LAZY derivations   — a node recomputes only when READ and only if a
//                                 dependency actually changed; never eagerly.
//    • PUSH-INVALIDATE         — a source write marks its dependents dirty (O(dependents),
//                                 no tree re-walk); the invalidation SET is returned.
//    • VALUE-EQUALITY cutoff    — a recompute that yields an equal value keeps the same
//                                 reference (stable identity for the React adapter at V3),
//                                 and — crucially — a source SET to an equal value emits
//                                 no change key (writing the same value re-evaluates zero).
//
//  Residence: `packages/core/src/graph/` — the arrow forbids core→react, which is a
//  feature: the graph is target-agnostic by construction (live render, SSR/SSG, warm,
//  api, Constructor preview all evaluate the SAME graph). SHADOW-ONLY at V2 — nothing
//  renders from it yet; deleting `src/graph/` reverts the step.
//
//  SCOPE (V2): cells depend on SOURCES (state keys), not on other cells. Today's data-
//  bearing nodes derive their rows from their own spec + state — there is no node→node
//  data edge (the `ctx.rows` cascade is a render-time inheritance, not a data edge). The
//  engine is nonetheless written so a future cell→cell edge (V3 output stage, cascade)
//  is a one-line addition (`upstream` ids), kept out now by YAGNI.

export type Equals<T> = (a: T, b: T) => boolean

/**
 * Structural deep-equality — the default cutoff for row-set values. Pure, total,
 * cycle-free (config-derived values are acyclic JSON-shaped data). `Object.is` fast
 * path first, then array / plain-object recursion.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  const aArr = Array.isArray(a), bArr = Array.isArray(b)
  if (aArr || bArr) {
    if (!aArr || !bArr || a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false
    return true
  }
  const ao = a as Record<string, unknown>, bo = b as Record<string, unknown>
  const ak = Object.keys(ao), bk = Object.keys(bo)
  if (ak.length !== bk.length) return false
  for (const k of ak) {
    if (!Object.prototype.hasOwnProperty.call(bo, k)) return false
    if (!deepEqual(ao[k], bo[k])) return false
  }
  return true
}

interface Cell<T> {
  readonly id:      string
  readonly deps:    ReadonlySet<string>   // source keys this cell reads
  readonly compute: () => T
  readonly equals:  Equals<T>
  valid:    boolean                       // memo is current
  hasValue: boolean                       // memo has ever been computed
  value:    T | undefined
}

/**
 * A reactive graph of derived cells over a flat namespace of source keys.
 * Register cells at compile time; drive it by `invalidate(changedSources)` +
 * lazy `get(id)`. Framework-free — the React adapter (V3) wraps `get` in
 * `useSyncExternalStore`; the shadow harness (V2) drives it directly.
 */
export class ReactiveGraph<T = unknown> {
  private readonly cells      = new Map<string, Cell<T>>()
  private readonly dependents = new Map<string, Set<string>>() // source key → cell ids

  /** Register a derived cell. Throws on a duplicate id (ids must be unique — compilePage guarantees it). */
  register(id: string, deps: Iterable<string>, compute: () => T, equals: Equals<T> = deepEqual): void {
    if (this.cells.has(id)) throw new Error(`ReactiveGraph: duplicate cell id '${id}'`)
    const depSet = new Set(deps)
    this.cells.set(id, { id, deps: depSet, compute, equals, valid: false, hasValue: false, value: undefined })
    for (const s of depSet) {
      let bucket = this.dependents.get(s)
      if (!bucket) { bucket = new Set(); this.dependents.set(s, bucket) }
      bucket.add(id)
    }
  }

  /**
   * Push-invalidate: mark every cell dirty whose dep-set contains one of the changed
   * sources, and RETURN that set (the invalidation fan-out). O(Σ dependents) — never a
   * tree walk. A cell with no changed dependency is untouched (its memo stays valid —
   * the exact-invalidation property the coarse legacy path lacks).
   */
  invalidate(changedSources: Iterable<string>): Set<string> {
    const dirty = new Set<string>()
    for (const s of changedSources) {
      const bucket = this.dependents.get(s)
      if (!bucket) continue
      for (const id of bucket) {
        this.cells.get(id)!.valid = false
        dirty.add(id)
      }
    }
    return dirty
  }

  /**
   * Pull-lazy read: return the cell's memoized value, recomputing ONLY when the memo
   * is invalid (a dependency changed) or absent (first read). Value-equality cutoff:
   * a recompute equal to the prior value keeps the prior REFERENCE (stable identity).
   */
  get(id: string): T {
    const cell = this.cells.get(id)
    if (!cell) throw new Error(`ReactiveGraph: unknown cell id '${id}'`)
    if (cell.valid && cell.hasValue) return cell.value as T
    const next = cell.compute()
    if (cell.hasValue && cell.equals(cell.value as T, next)) {
      cell.valid = true
      return cell.value as T           // unchanged — keep the reference
    }
    cell.value = next
    cell.hasValue = true
    cell.valid = true
    return next
  }

  /** Force-evaluate every cell (populate all memos) — the shadow harness's state-0 warm. */
  evaluateAll(): void {
    for (const id of this.cells.keys()) this.get(id)
  }

  has(id: string): boolean { return this.cells.has(id) }
  nodeIds(): string[] { return [...this.cells.keys()] }
  depsOf(id: string): ReadonlySet<string> {
    const cell = this.cells.get(id)
    if (!cell) throw new Error(`ReactiveGraph: unknown cell id '${id}'`)
    return cell.deps
  }
}
