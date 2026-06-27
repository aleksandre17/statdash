// ── lazyRendered — lazy ReactNode[] proxy (extracted from renderNode) ─────────
//
//  Shells using rendered[i], rendered.map(), rendered.filter() get the same
//  output as before — but renderNode() is called on FIRST access per index,
//  not upfront. TabsShell calling renderChild(activeTab) renders only that tab.
//
//  Split out of renderNode.ts (one concern per file, 400-line ceiling) — pure,
//  React-element-free except for the ReactNode type. No behaviour change.
//
// ── Lazy-handled methods ────────────────────────────────────────────────────
//  These are intercepted BEFORE full materialisation:
//    length, Symbol.iterator, numeric index — single-node lazy access.
//    map, filter, forEach, reduce, findIndex, some, every, indexOf, includes
//      — call all() which iterates getAt(i) lazily per index (still lazy).
//
// ── Generic-fallback methods (full materialisation) ─────────────────────────
//  Any other Array.prototype string property (slice, find, flat, flatMap,
//  concat, join, at, sort, reverse, keys, entries, values, reduceRight,
//  lastIndexOf, findLast, findLastIndex, toSorted, toReversed, toSpliced,
//  with, fill, copyWithin, …) delegates to the fully-materialised array.
//  Callers see standard ReactNode[] behaviour; the tradeoff is that all nodes
//  are rendered on first call to any such method.
//

import type { ReactNode } from 'react'

export function makeLazyRendered(
  length: number,
  getAt:  (i: number) => ReactNode,
): ReactNode[] {
  // Materialise once and cache so repeated fallback calls don't re-render.
  let materialised: ReactNode[] | undefined
  const all = (): ReactNode[] => {
    if (!materialised) materialised = Array.from({ length }, (_, i) => getAt(i))
    return materialised
  }

  return new Proxy([] as ReactNode[], {
    get(_target, prop) {
      // ── length + iterator: single-node lazy ───────────────────────────────
      if (prop === 'length')        return length
      if (prop === Symbol.iterator) return function*() { for (let i = 0; i < length; i++) yield getAt(i) }

      // ── Non-string symbols fall through to undefined ──────────────────────
      if (typeof prop !== 'string') return undefined

      // ── Numeric index: single-node lazy ──────────────────────────────────
      const idx = Number(prop)
      if (!isNaN(idx) && idx >= 0)  return getAt(idx)

      // ── Explicitly lazy methods (avoid full materialisation) ──────────────
      if (prop === 'map')       return (fn: (v: ReactNode, i: number, a: ReactNode[]) => unknown) => all().map(fn)
      if (prop === 'filter')    return (fn: (v: ReactNode, i: number, a: ReactNode[]) => boolean) => all().filter(fn)
      if (prop === 'forEach')   return (fn: (v: ReactNode, i: number, a: ReactNode[]) => void) => all().forEach(fn)
      if (prop === 'reduce')    return (fn: (acc: unknown, v: ReactNode, i: number, a: ReactNode[]) => unknown, init?: unknown) => all().reduce(fn, init)
      if (prop === 'findIndex') return (fn: (v: ReactNode, i: number, a: ReactNode[]) => boolean) => all().findIndex(fn)
      if (prop === 'some')      return (fn: (v: ReactNode, i: number, a: ReactNode[]) => boolean) => all().some(fn)
      if (prop === 'every')     return (fn: (v: ReactNode, i: number, a: ReactNode[]) => boolean) => all().every(fn)
      if (prop === 'indexOf')   return (v: ReactNode) => all().indexOf(v)
      if (prop === 'includes')  return (v: ReactNode) => all().includes(v)

      // ── Generic fallback: any other Array.prototype property ──────────────
      //  Materialise the full array and delegate. Covers: slice, find, flat,
      //  flatMap, concat, join, at, sort, reverse, keys, entries, values,
      //  reduceRight, lastIndexOf, findLast, findLastIndex, toSorted,
      //  toReversed, toSpliced, with, fill, copyWithin, and future additions.
      if (prop in Array.prototype) {
        const mat = all()
        const val = (mat as unknown as Record<string, unknown>)[prop]
        return typeof val === 'function'
          ? (val as (...args: unknown[]) => unknown).bind(mat)
          : val
      }

      return undefined
    },
  })
}
