// ── SkeletonRegistry — type+variant → skeleton dispatch ─────────────────
//
//  Grafana panel loading state pattern.
//  Brand override → type default → engine generic fallback (3-level cascade).
//  registerSlice populates this when Skeleton export present on slice.
//  renderNode (Phase 2) wraps shell in <Suspense fallback={skeletonFn(node)}>
//

import type { ReactNode } from 'react'
import type { NodeBase, RenderContext } from './types'

export type SkeletonFn = (node: NodeBase, ctx: RenderContext) => ReactNode

export class SkeletonRegistry {
  private map = new Map<string, SkeletonFn>()

  register(type: string, variant: string, fn: SkeletonFn): void {
    this.map.set(`${type}::${variant}`, fn)
  }

  get(type: string, variant = 'default'): SkeletonFn | undefined {
    return (
      this.map.get(`${type}::${variant}`) ??
      this.map.get(`${type}::default`)
    )
  }
}

export const skeletonRegistry = new SkeletonRegistry()