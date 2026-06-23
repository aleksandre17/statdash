// ── specDimKey — data-dependency fingerprint for a DataSpec [N28] ──────────
//
//  Produces a stable string key for the exact (code × dims) pairs a DataSpec
//  reads at a given SectionContext. Used by useNodeRows to memoize resolveNodeRows
//  keyed on actual data dependencies — not the entire SectionContext object.
//
//  Foundation of the reactive dataflow graph (Phase 10.5):
//    specDimKey is the "edge label" — it changes IFF the data the spec will
//    produce changes, and stays stable when unrelated dims change.
//
//  Compatible with React useMemo dep arrays — string equality, not reference.
//

import type { DataSpec, SectionContext } from '@statdash/engine'
import { extractRequirements }           from '@statdash/engine'

/**
 * Stable fingerprint for the data dependencies of a DataSpec.
 *
 * Changes only when the set of (code, dims) pairs the spec needs changes —
 * i.e., when a dim the spec actually reads changes value.
 * Stays stable when unrelated dims change.
 *
 * Returns `''` for specs with no extractable requirements (e.g. `pivot`, `transform`).
 * Falls back to full dims JSON on extraction error.
 */
export function specDimKey(spec: DataSpec, ctx: SectionContext): string {
  try {
    const reqs = extractRequirements(spec, ctx)
    if (reqs.length === 0) return ''
    return reqs
      .map(r =>
        `${r.code}:${
          Object.entries(r.dims)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${String(v)}`)
            .join(',')
        }`,
      )
      .sort()
      .join('|')
  } catch {
    // Fallback: key on all dims (over-fires memo but never under-fires)
    return Object.entries(ctx.dims)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${String(v)}`)
      .join(',')
  }
}
