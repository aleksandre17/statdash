// ── Store Filter Utilities ─────────────────────────────────────────────
//
//  Module-internal helpers shared by ApiStore, CachedStore, ExternalStore.
//  Not re-exported from the public engine API — store-impl.ts is the
//  only consumer.
//
//  dimKey        — stable cache key from SectionContext.dims
//  matchesLeaves — leaf-set containment check
//  resolveFilter — FilterValue → concrete leaf list (with CtxRef support)
//  matchesFilter — full filter predicate over an observation row
//  DimResolver   — code↔id + hierarchy rollup (Kimball surrogate-key pattern)
//

import type { Classifier, ClassifierEntry, CtxRef, DimVal,
              FilterValue, NeCtxRef, NeRef }                           from '../sdmx'
import type { SectionContext }                                         from '../core/context'


// ── dimKey ────────────────────────────────────────────────────────────

export function dimKey(ctx: SectionContext): string {
  return Object.entries(ctx.dims)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(',')
}


// ── Filter helpers ────────────────────────────────────────────────────

export type LeafFn = (dim: string, val: DimVal) => DimVal[]

export function matchesLeaves(leaves: DimVal[], obsVal: DimVal | undefined): boolean {
  if (obsVal === undefined) return false
  for (const l of leaves) if (String(l) === String(obsVal)) return true
  return false
}

/** Returns null = wildcard (skip this dimension filter). */
export function resolveFilter(
  fv:      FilterValue,
  ctx:     SectionContext,
  expand?: LeafFn,
  dim?:    string,
): DimVal[] | null {
  if (Array.isArray(fv)) return fv as DimVal[]
  if (typeof fv === 'object' && '$ctx' in (fv as object)) {
    const val = ctx.dims[(fv as CtxRef).$ctx]
    if (val === '' || val === null || val === undefined) return null         // wildcard
    if (typeof val === 'string' && val.includes(',')) {
      const parts = val.split(',').filter(Boolean) as DimVal[]
      return expand && dim ? parts.flatMap((p) => expand(dim, p)) : parts
    }
    return expand && dim ? expand(dim, val) : [val as DimVal]
  }
  return [fv as DimVal]
}

export function matchesFilter(
  obs:     Record<string, DimVal>,
  filter:  Partial<Record<string, FilterValue>>,
  ctx:     SectionContext,
  expand?: LeafFn,
): boolean {
  for (const [dim, fv] of Object.entries(filter)) {
    if (fv === undefined) continue
    if (typeof fv === 'object' && !Array.isArray(fv) && '$ne' in (fv as object)) {
      const ne = fv as NeRef | NeCtxRef
      if (String(obs[dim]) === String(ne.$ne)) return false
      if ('$ctx' in ne) {
        const ctxVal = ctx.dims[(ne as NeCtxRef).$ctx]
        if (ctxVal !== '' && ctxVal !== null && ctxVal !== undefined) {
          const leaves = expand ? expand(dim, ctxVal) : [ctxVal]
          if (!matchesLeaves(leaves, obs[dim])) return false
        }
      }
      continue
    }
    const allowed = resolveFilter(fv, ctx, expand, dim)
    if (allowed === null) continue
    if (!matchesLeaves(allowed, obs[dim])) return false
  }
  return true
}


// ── DimResolver — per-dim code↔id translator with hierarchy ──────────
//
//  Pure structural service built from a Classifier. Handles:
//    code → id  (query-time input translation)
//    id   → code (observe() output translation)
//    code → descendant ids (rollup expansion)
//
//  Kimball surrogate-key semantics: facts reference ids; API boundary sees codes.

export class DimResolver {
  private readonly codeToId = new Map<string, DimVal>()
  private readonly idToCode = new Map<string, DimVal>()
  private readonly descIds  = new Map<string, string[]>()

  constructor(classifier: Classifier) {
    const pairs: Array<[string, ClassifierEntry]> = Array.isArray(classifier)
      ? classifier.map(e => [String(e.code), e])
      : Object.entries(classifier)

    const children = new Map<string, string[]>()
    for (const [id, entry] of pairs) {
      this.codeToId.set(String(entry.code), this.castIdLike(id))
      this.idToCode.set(id, entry.code)
      if (entry.parent !== undefined) {
        const p = String(entry.parent)
        const arr = children.get(p) ?? []
        arr.push(id)
        children.set(p, arr)
      }
    }
    const walk = (id: string, acc: Set<string>): void => {
      if (acc.has(id)) return
      acc.add(id)
      for (const c of children.get(id) ?? []) walk(c, acc)
    }
    for (const [id] of pairs) {
      const acc = new Set<string>()
      walk(id, acc)
      this.descIds.set(id, [...acc])
    }
  }

  private castIdLike(id: string): DimVal {
    if (/^-?\d+$/.test(id)) return Number(id)
    return id
  }

  leafIds(code: DimVal): DimVal[] {
    const id = this.codeToId.get(String(code))
    if (id === undefined) return [code]
    const desc = this.descIds.get(String(id))
    if (!desc) return [id]
    return desc.map((d) => this.castIdLike(d))
  }

  codeOf(id: DimVal): DimVal {
    return this.idToCode.get(String(id)) ?? id
  }
}
