// ── RenderTarget: warm — prefetch cache planner [N27 / Phase 10.3] ─────────
//
//  Lightweight cache pre-warm — static analysis only, no full spec interpretation.
//  Use before renderPageToHTML or a DOM mount to ensure the first render
//  hits the CachedStore val-cache rather than computing each observation fresh.
//
//  For in-memory ExternalStore: reduces redundant val computations on first render.
//  For ApiStore (Phase 2): enables batched prefetch (one HTTP call vs. N).
//
//  Architecture: extractRequirements (engine/core) → store.warm() (CachedStore)
//

import type { DataSpec, Requirement, SectionContext }  from '@statdash/engine'
import { extractRequirements }                          from '@statdash/engine'
import type { NodePageConfig }                          from '../types'
import type { StaticRenderContext }                     from './html'
import { resolveStore }                                 from '../resolveNodeRows'
import { isNodeObject, DATA_CARRYING_KEYS }             from './nodeWalk'

/**
 * Recursively collect all DataSpec requirements from a node tree.
 * Same generic walk as api.ts — no registry coupling.
 */
function collectRequirements(
  node: Record<string, unknown>,
  ctx:  SectionContext,
): Requirement[] {
  const reqs: Requirement[] = []

  if (node['data'] !== undefined && node['data'] !== null) {
    try {
      reqs.push(...extractRequirements(node['data'] as DataSpec, ctx))
    } catch { /* graceful — unknown spec type emits no requirements */ }
  }

  for (const [key, val] of Object.entries(node)) {
    if (DATA_CARRYING_KEYS.has(key)) continue

    if (Array.isArray(val)) {
      for (const item of val) {
        if (isNodeObject(item)) reqs.push(...collectRequirements(item, ctx))
      }
    } else if (isNodeObject(val)) {
      reqs.push(...collectRequirements(val, ctx))
    }
  }

  return reqs
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Pre-warm the page store's val-cache before rendering.
 *
 * Walks the node tree via `extractRequirements` (static analysis — no full
 * spec interpretation), collects every `{ code, dims }` pair the page needs,
 * then calls `store.warm(reqs)` to populate the val-cache in one pass.
 *
 * No-op when the resolved store has no `warm` method (e.g. `staticStore`).
 *
 * ```ts
 * // SSR pipeline:
 * warmPageStore(page, staticCtx)                   // pre-warm (fast)
 * const html = renderPageToHTML(page, staticCtx)   // cache hits only
 * ```
 */
export function warmPageStore(
  page:      NodePageConfig,
  staticCtx: StaticRenderContext,
): void {
  const store = resolveStore({ stores: staticCtx.stores, pageStoreKey: staticCtx.pageStoreKey })

  // Duck-type check — CachedStore has warm(); staticStore does not.
  if (!('warm' in store && typeof (store as { warm?: unknown }).warm === 'function')) return

  const reqs = collectRequirements(
    page as unknown as Record<string, unknown>,
    staticCtx.sectionCtx,
  )

  ;(store as { warm(r: Requirement[]): void }).warm(reqs)
}
