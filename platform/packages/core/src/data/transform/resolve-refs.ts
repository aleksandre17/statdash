// ── resolvePipeRefs — state-bound pipeline-step params (AR-36) ────────────────
//
//  The pipeline sibling of `resolveEncodingRefs` (../encoding, P0). Lowers any
//  state-bound `{ $ctx: key }` param on a transform step to the CONCRETE value it
//  names — read from the render context (dims) / page vars — BEFORE `applyPipeline`
//  runs. After this pass no step param is a ref, so the step handlers are untouched.
//
//  Two params can bind to state today (the OLAP pivot's roll-up + order verbs):
//    • aggregate `by`  — the roll-up LEVEL. Resolves to a COMMA-STRING field list
//      ("sector,geo,time"), split into the array. So which grain the pivot
//      aggregates to (by-region ⇄ sector×geo) rotates with the selection.
//    • sort `by` / `dir` — the display order (e.g. donut → value desc, stacked bar
//      → sectorOrder asc). Resolves to a concrete field name / direction.
//
//  Resolution REUSES the one ref dispatcher (`resolveRef`, ../../ref/ref — R4): a
//  `$ctx` binds `services.dims`, with a `$ref` (var-scope) fallback to `services.vars`
//  so a derived page var (`_byDims`, `_sortBy`, …) resolves too — the SAME two-step
//  resolution `resolveEncodingRefs` uses. Dimension-blind (Law 1): no dim-name literal
//  here — it substitutes whatever field/list the config named.
//
//  Byte-identical (FF-PIVOT-*): a pipeline with NO ref param is returned by the SAME
//  reference (fast path, zero allocation), and each ref-free step passes through
//  untouched → every stored config produces an identical TransformStep[].
//
//  Lives in the react binding layer's call-path (react holds dims+vars, Law 3) but is
//  a pure core fn — exported so the invariant is testable without a render harness,
//  exactly like `resolveEncodingRefs` and the `resolveBlends` desugar.

import type { TransformStep }            from './types'
import type { CtxScopeRef, RefServices } from '../../ref/ref'
import { resolveRef }                    from '../../ref/ref'

/** True when a value is an un-resolved `{ $ctx: key }` state ref. */
function isCtxRef(v: unknown): v is CtxScopeRef {
  return typeof v === 'object' && v !== null && '$ctx' in v
}

/**
 * Resolve a `{ $ctx: key }` ref → its concrete value as a string, via the ONE
 * dispatcher: `$ctx` → dims, else `$ref` (var scope) → vars. Never throws; an
 * unresolved ref → undefined (the caller keeps the original param).
 */
function resolveRefValue(ref: CtxScopeRef, services: RefServices): string | undefined {
  const v = resolveRef(ref, services) ?? resolveRef({ $ref: ref.$ctx }, services)
  return v == null ? undefined : String(v)
}

/** Split a comma-string field list into its members (trimmed, empties dropped). */
function splitFields(s: string): string[] {
  return s.split(',').map((p) => p.trim()).filter(Boolean)
}

export function resolvePipeRefs(
  steps:    readonly TransformStep[],
  services: RefServices,
): TransformStep[] {
  let changed = false
  const out = steps.map((step): TransformStep => {
    if (step.op === 'aggregate' && 'by' in step && isCtxRef(step.by)) {
      const resolved = resolveRefValue(step.by, services)
      changed = true
      // Un-lowered/empty → whole-set aggregate (empty groupBy). A resolved list
      // splits on comma into the group-by dims.
      return { ...step, by: resolved ? splitFields(resolved) : [] }
    }
    if (step.op === 'sort') {
      const byRef  = isCtxRef(step.by)  ? step.by  : undefined
      const dirRef = isCtxRef(step.dir) ? step.dir : undefined
      if (byRef || dirRef) {
        changed = true
        const next = { ...step } as Extract<TransformStep, { op: 'sort' }>
        if (byRef)  next.by  = resolveRefValue(byRef, services) ?? ''
        if (dirRef) {
          const d = resolveRefValue(dirRef, services)
          next.dir = d === 'asc' || d === 'desc' ? d : undefined
        }
        return next
      }
    }
    return step
  })
  return changed ? out : (steps as TransformStep[])
}
