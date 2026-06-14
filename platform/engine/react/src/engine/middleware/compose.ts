import type { ReactNode }        from 'react'
import type { NodeBase, RenderContext } from '../types'
import type { RenderMiddleware }  from './types'

/**
 * Compose an array of middlewares into a single middleware.
 * Before hooks applied left-to-right; after hooks applied right-to-left.
 */
export function composeMiddleware(mws: RenderMiddleware[]): RenderMiddleware {
  if (mws.length === 0) return {}

  return {
    before: (node: NodeBase, ctx: RenderContext): RenderContext =>
      mws.reduce((c, mw) => mw.before?.(node, c) ?? c, ctx),

    after: (element: ReactNode, node: NodeBase, ctx: RenderContext): ReactNode =>
      [...mws].reverse().reduce(
        (el, mw) => mw.after?.(el, node, ctx) ?? el,
        element,
      ),
  }
}