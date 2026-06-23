// ── useNodeStatus — publish a node's data-status on the EventBus (Pattern E) ─
//
//  The published half of the deferred NodeStatusContext (see SectionShell's
//  Option-D ADR). A data-bearing panel calls this with its resolved rows; the
//  hook derives a status ('ok' | 'empty' | 'error') and publishes 'node:status'
//  on ctx.eventBus — but ONLY when the status actually changes (deduped), and
//  ONLY from inside an effect (never during render — no side-effects-in-render).
//
//  Why a hook, not a renderNode emission:
//    Emitting from renderNode (a pure render pass) would fire on every render
//    and run a side effect during rendering — a React anti-pattern and an event
//    storm. Status is a cross-render transition, so it belongs in an effect.
//
//  Why opt-in, not forced on every panel:
//    There is no aggregate CONSUMER yet (YAGNI — the section does not collapse on
//    all-empty today). Forcing emission into all panels speculatively is exactly
//    the Option-C/B speculative generality the ADR rejects. This hook is the
//    Strangler-Fig seam: panels adopt it one at a time, and the aggregator
//    (NodeStatusContext) is built when the first real consumer appears.
//
//  Law 3 (Clean Architecture): app-agnostic. Reads only ctx.eventBus + rows.
//

import { useEffect, useRef } from 'react'
import type { DataRow }      from '@statdash/engine'
import type { RenderContext } from './types'

export type NodeStatus = 'ok' | 'empty' | 'error'

/** Derive a NodeStatus from resolved rows. `error` is opt-in via the flag. */
export function deriveNodeStatus(rows: DataRow[] | undefined, hasError = false): NodeStatus {
  if (hasError) return 'error'
  return rows && rows.length > 0 ? 'ok' : 'empty'
}

/**
 * Publish this node's data-status on the EventBus, deduped to status changes.
 *
 * ```ts
 * // In a data panel's inner component:
 * useNodeStatus(ctx, 'chart', rows, def.id)
 * ```
 *
 * @param ctx       render context (for ctx.eventBus)
 * @param nodeType  emitting node's type (attribution)
 * @param rows      resolved rows — empty/absent ⇒ 'empty'
 * @param nodeId    optional node id (attribution)
 * @param hasError  when true, status is 'error' regardless of rows
 */
export function useNodeStatus(
  ctx:      RenderContext,
  nodeType: string,
  rows:     DataRow[] | undefined,
  nodeId?:  string,
  hasError = false,
): void {
  const status = deriveNodeStatus(rows, hasError)
  const last   = useRef<NodeStatus | undefined>(undefined)

  useEffect(() => {
    if (last.current === status) return    // dedupe: only publish on transition
    last.current = status
    ctx.eventBus.publish('node:status', { nodeId, nodeType, status })
  }, [ctx.eventBus, nodeType, nodeId, status])
}
