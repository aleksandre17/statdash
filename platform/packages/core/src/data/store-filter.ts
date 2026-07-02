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
import { TIME_DIM, MEASURE_DIM }                                       from '../core/context'
import { resolveRef }                                                   from '../ref/ref'
import type { StoreQuery }                                             from './store'


// ── splitMultiValue — the SSOT for "one string value carrying an OR-set" ──
//
//  A multi-select resolves to a single comma-joined string in ctx.dims (e.g.
//  `geo:'R2,R3'`). This is the ONE place that decodes that convention into its
//  member codes, so the WIRE serializer (buildObsFilterParam) and the CLIENT
//  resolver (resolveFilter) agree on what a comma-joined value means — the class
//  of bug where the wire emitted a literal "R2,R3" (an unmatchable code → 0 rows)
//  while resolveFilter split it client-side. Whitespace-trimmed; empties dropped.
export function splitMultiValue(val: string): string[] {
  return val.split(',').map((p) => p.trim()).filter(Boolean)
}

// ── toWireValue — a resolved ctx/baseline scalar → its wire filter shape ──
//
//  Mirrors resolveFilter's comma-split so a multi-value ctx pin serializes as the
//  route's OR-within-dim ARRAY, never a literal "R2,R3". A comma string → its
//  members (single → scalar for back-compat, ≥2 → array); a plain value → itself;
//  an empty result → undefined (the caller drops the pin, scoping nothing).
function toWireValue(val: DimVal): string | string[] | undefined {
  if (typeof val === 'string' && val.includes(',')) {
    const parts = splitMultiValue(val)
    return parts.length === 0 ? undefined : parts.length === 1 ? parts[0] : parts
  }
  const s = String(val)
  return s === '' ? undefined : s
}


// ── buildObsFilterParam — StoreQuery → wire `filter` JSON (or undefined) ──
//
//  Assembles the non-time dim filter for the observations wire param. Sources,
//  in precedence order:
//    1. ctx.dims baseline (every nonTimeDim with a concrete value)
//    2. a `val` query's MEASURE_DIM pin (the OLAP point-read measure SSOT)
//    3. q.filter overrides ($ctx scope · array OR-set · scalar · `$ne` exclusion)
//
//  `$ne` is a CLIENT-SIDE operator (the route's dim-filter schema has no `<>`): a
//  pure `{$ne}` sends NO positive pin AND drops any ctx-baseline pin for that dim
//  (q.filter intent wins — else the baseline scopes the fetch TO the excluded
//  value and matchesFilter drops every row). A `{$ne,$ctx}` sends the $ctx scalar.
//
//  The result is key-sorted so the wire param (and the cache identity derived from
//  it) is insertion-order-invariant — two reads of one logical slice key identically.
export function buildObsFilterParam(
  q:           StoreQuery,
  ctx:         SectionContext,
  nonTimeDims: readonly string[],
): string | undefined {
  const filterRecord: Record<string, string | string[]> = {}

  for (const dim of nonTimeDims) {
    const ctxVal = ctx.dims[dim]
    if (ctxVal !== undefined && ctxVal !== '' && ctxVal !== null) {
      const wire = toWireValue(ctxVal)
      if (wire !== undefined) filterRecord[dim] = wire
    }
  }

  // A `val` query is an OLAP point-read for ONE measure: pin MEASURE_DIM (the val
  // SSOT) — else the server returns every measure and storeVal collapses onto rows[0].
  if (q.type === 'val') {
    filterRecord[MEASURE_DIM] = q.code
  }

  if (q.type === 'obs' && q.filter) {
    for (const [dim, fv] of Object.entries(q.filter)) {
      if (dim === TIME_DIM || fv === undefined || fv === null) continue
      const isObj = typeof fv === 'object' && !Array.isArray(fv)
      if (isObj && '$ne' in (fv as object)) {
        const ne = fv as { $ne: unknown; $ctx?: string }
        if (ne.$ctx !== undefined) {
          const val = ctx.dims[ne.$ctx]
          if (val !== undefined && val !== '' && val !== null) {
            const wire = toWireValue(val)
            if (wire !== undefined) filterRecord[dim] = wire
          }
        } else {
          // Pure `{$ne}`: fetch the broader set, exclude client-side. Drop any
          // stale ctx-baseline pin so it does not scope the fetch to the excluded
          // value (the empty sector donut: ctx.dims['sector']='_T' + `$ne:'_T'`).
          delete filterRecord[dim]
        }
      } else if (isObj && '$ctx' in (fv as object)) {
        const ref = (fv as { $ctx: string }).$ctx
        const val = ctx.dims[ref]
        if (val !== undefined && val !== '' && val !== null) {
          const wire = toWireValue(val)
          if (wire !== undefined) filterRecord[dim] = wire
        }
      } else if (Array.isArray(fv)) {
        // Multi-value OR-set (kept as an array; empty → dropped, scopes nothing).
        const vals = (fv as Array<string | number>).map((v) => String(v))
        if (vals.length > 0) filterRecord[dim] = vals
      } else {
        filterRecord[dim] = String(fv)
      }
    }
  }

  if (Object.keys(filterRecord).length === 0) return undefined

  const sorted: Record<string, string | string[]> = {}
  for (const k of Object.keys(filterRecord).sort()) sorted[k] = filterRecord[k]
  return JSON.stringify(sorted)
}


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
    // ctx-scope ref → SectionContext.dims, via the one resolver (../ref).
    const val = resolveRef(fv as CtxRef, { dims: ctx.dims }) as DimVal | undefined
    if (val === '' || val === null || val === undefined) return null         // wildcard
    if (typeof val === 'string' && val.includes(',')) {
      const parts = splitMultiValue(val) as DimVal[]           // SSOT with the wire serializer
      return expand && dim ? parts.flatMap((p) => expand(dim, p)) : parts
    }
    return expand && dim ? expand(dim, val) : [val as DimVal]
  }
  return [fv as DimVal]
}

/**
 * matchedValues — the obs-value list at a coordinate over a row set (the OLAP cell
 * matching loop, SSOT). ONE implementation of "resolve a value from a set of rows",
 * shared by BOTH sync stores:
 *   • ExternalStore — over its in-memory `observations` (facts are ids; `expand` is
 *     the classifier leaf-set so a coordinate matches its whole hierarchy subtree).
 *   • ApiStore     — over an already-cached SUPERSET slice's rows (facts are the
 *     server's leaf codes, already scoped by the wire filter; `expand` is identity).
 *
 * Generic over the coordinate (Law 1 — no dimension privileged): `code` matches the
 * MEASURE_DIM cell, carry-forward rows are excluded (SNA T-account dedup), each
 * coordinate dim constrains via leaf-set containment (unset '' / null / undefined
 * values are skipped — a wildcard). Empty result ⇒ caller sums to the OLAP zero cell.
 */
export function matchedValues(
  rows:       readonly Record<string, DimVal>[],
  code:       string,
  coordinate: Record<string, DimVal>,
  expand?:    LeafFn,
): number[] {
  const out: number[] = []
  for (const o of rows) {
    if (String(o[MEASURE_DIM] ?? '') !== code) continue
    if (Number(o['isCarryForward'] ?? 0) === 1) continue
    let ok = true
    for (const [dim, val] of Object.entries(coordinate)) {
      if (val === '' || val === null || val === undefined) continue
      const obsVal = o[dim]
      if (obsVal === undefined) continue
      const leaves = typeof val === 'string' && val.includes(',')
        ? val.split(',').filter(Boolean).flatMap((p) => (expand ? expand(dim, p) : [p]))
        : (expand ? expand(dim, val) : [val])
      if (!matchesLeaves(leaves, obsVal)) { ok = false; break }
    }
    if (ok) out.push(Number(o['value'] ?? 0))
  }
  return out
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
        // The NeCtxRef's optional ctx-scope narrowing resolves via the one dispatcher.
        const ctxVal = resolveRef({ $ctx: (ne as NeCtxRef).$ctx }, { dims: ctx.dims }) as DimVal | undefined
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
