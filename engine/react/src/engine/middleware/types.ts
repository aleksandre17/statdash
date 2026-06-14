// ── RenderMiddleware — AOP interceptor for the render pipeline ────────────
//
//  Grafana analogue: PanelPlugin lifecycle hooks (onPanelLoad, onConfigChange).
//  Appsmith analogue: EvaluationWorker + ActionDispatcher pipeline.
//
//  Use cases:
//    Dev: performance profiling (before records timestamp, after measures)
//    Constructor Phase 2: selection highlight overlay (after wraps element)
//    Analytics: render count tracking, error reporting
//    A/B testing: render alternative variants based on experiment state
//
//  Registration (call before first render — typically in setupRegistrations):
//    import { middlewareRegistry } from '@geostat/react/engine'
//    middlewareRegistry.use({ name: 'perf', before: (node, ctx) => { ... } })
//

import type { ReactNode }        from 'react'
import type { NodeBase, RenderContext } from '../types'

export interface RenderMiddleware {
  /** Optional name for debugging / identification. */
  name?:  string

  /**
   * Before hook — called after migration+validation, before shell lookup.
   * Can transform RenderContext (e.g. inject edit-mode flags, override vars).
   * Must return the (possibly modified) context.
   */
  before?: (node: NodeBase, ctx: RenderContext) => RenderContext

  /**
   * After hook — called after ErrorBoundary+Suspense wrapping.
   * Can wrap the element (e.g. add edit-mode overlays, analytics wrappers).
   * Return null/undefined → element passes through unchanged.
   */
  after?: (element: ReactNode, node: NodeBase, ctx: RenderContext) => ReactNode
}