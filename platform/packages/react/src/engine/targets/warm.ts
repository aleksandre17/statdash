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
import { isNodeVisibleInActiveView }                    from './visibilityGate'
import type { VisibilityGate }                          from './visibilityGate'

/**
 * Recursively collect all DataSpec requirements from a node tree.
 * Same generic walk as api.ts — no registry coupling.
 *
 * Perspective-aware (P-opt): before collecting a node's requirements, the
 * node's `view.visibleWhen` is evaluated against the active perspective via
 * `isNodeVisibleInActiveView` — the SAME gate `renderNode` applies on the live
 * DOM (`renderNode.ts:228`). A node hidden in the active perspective warms
 * NOTHING (neither its own slices nor its descendants'), matching the live page
 * which never resolves a hidden subtree. When `gate` is undefined
 * (`snapshot:'all-perspectives'`) the gate is the identity ⇒ every node warms,
 * i.e. byte-identical to the pre-P-opt eager walk (the union of all perspectives).
 */
function collectRequirements(
  node: Record<string, unknown>,
  ctx:  SectionContext,
  gate: VisibilityGate | undefined,
): Requirement[] {
  const reqs: Requirement[] = []

  // Perspective gate — skip a node (and its whole subtree) when it is hidden
  // in the active perspective, exactly as the live renderNode short-circuits.
  if (gate && !isNodeVisibleInActiveView(node, gate)) return reqs

  if (node['data'] !== undefined && node['data'] !== null) {
    try {
      reqs.push(...extractRequirements(node['data'] as DataSpec, ctx))
    } catch { /* graceful — unknown spec type emits no requirements */ }
  }

  for (const [key, val] of Object.entries(node)) {
    if (DATA_CARRYING_KEYS.has(key)) continue

    if (Array.isArray(val)) {
      for (const item of val) {
        if (isNodeObject(item)) reqs.push(...collectRequirements(item, ctx, gate))
      }
    } else if (isNodeObject(val)) {
      reqs.push(...collectRequirements(val, ctx, gate))
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
 * Perspective-aware (P-opt): by default (`snapshot:'active'`) only the ACTIVE
 * perspective's nodes warm — a node hidden by `view.visibleWhen` in the active
 * perspective contributes no requirements, exactly as the live DOM never
 * resolves it (`renderNode.ts:228`). Pass `snapshot:'all-perspectives'` to warm
 * the union of every perspective (the pre-P-opt eager behaviour) for a
 * self-contained export. `snapshot` is a render-CALL option, not a config field
 * — it is render-intent, not an artifact property (Vision #3 SYNTHESIS).
 *
 * ```ts
 * // SSR pipeline:
 * warmPageStore(page, staticCtx)                   // pre-warm (active perspective)
 * const html = renderPageToHTML(page, staticCtx)   // cache hits only
 * ```
 */
export function warmPageStore(
  page:      NodePageConfig,
  staticCtx: StaticRenderContext,
  opts?:     { snapshot?: SnapshotScope },
): void {
  const store = resolveStore({ stores: staticCtx.stores, pageStoreKey: staticCtx.pageStoreKey })

  // Duck-type check — CachedStore has warm(); staticStore does not.
  if (!('warm' in store && typeof (store as { warm?: unknown }).warm === 'function')) return

  const reqs = collectRequirements(
    page as unknown as Record<string, unknown>,
    staticCtx.sectionCtx,
    activeViewGate(staticCtx, opts?.snapshot ?? 'active'),
  )

  ;(store as { warm(r: Requirement[]): void }).warm(reqs)
}

/**
 * Snapshot scope — render-CALL intent (NOT a config field):
 *   'active'           — warm only the active perspective's nodes (default).
 *   'all-perspectives' — warm the union of every perspective (self-contained export).
 */
export type SnapshotScope = 'active' | 'all-perspectives'

/**
 * Build the active-perspective visibility gate from a StaticRenderContext, or
 * `undefined` for `'all-perspectives'` (gate disabled ⇒ every node warms = the
 * union of all perspectives).
 *
 * The active id is sourced from the `ctx.perspectiveState` SSOT (VISION #3 / P1 —
 * HIGH-3), the SAME record `renderNode` reads. When a SSR caller populated only the
 * `perspective`/`perspectiveKey` triad (no `perspectiveState`), it is derived here as
 * `{ [perspectiveKey]: perspective.current }` — one source. `buildStaticContext`
 * seeds `perspectiveState` from the triad so the common SSR path already carries it.
 */
export function activeViewGate(
  staticCtx: StaticRenderContext,
  scope:     SnapshotScope,
): VisibilityGate | undefined {
  if (scope === 'all-perspectives') return undefined
  const perspectiveState =
    staticCtx.sectionCtx.perspectiveState ??
    { [staticCtx.perspectiveKey]: staticCtx.perspective.current }
  return {
    filterParams: staticCtx.filterParams,
    perspectiveState,
  }
}
