// ── useNodeStream — live subscription hook for streaming-capable stores ──────
//
//  When the store has caps.streaming === true and implements subscribe(), this
//  hook subscribes to live updates and re-renders on each push.
//
//  Falls back to resolveNodeRows (sync) when:
//    - The store is not streaming-capable (caps.streaming !== true), OR
//    - The store does not implement subscribe(), OR
//    - The node has no DataSpec.
//
//  For non-streaming stores with view.polling.interval set, this hook also
//  provides opt-in polling: a setInterval fires resolveNodeRows periodically,
//  bridging the gap between pure-sync stores and true streaming stores.
//
//  Usage in shells:
//    const rows = useNodeStream(node, ctx)   // replaces useNodeRows for live panels
//
//  Architecture (Ports & Adapters):
//    subscribe? is the only live-data boundary. Polling is an adapter shim for
//    stores that cannot push. SSR (renderPageToJSON / renderPageToHTML) never
//    calls this hook — it uses querySync directly.
//
//  09-B: additive — new optional method on DataStore, new optional field on StoreCaps.
//

import React                                        from 'react'
import type { DataSpec, EngineRow, StoreQuery }     from '@statdash/engine'
import type { NodeBase, RenderContext }             from './types'
import { resolveNodeRows, resolveStore }            from './resolveNodeRows'
import { specDimKey }                               from './specDimKey'

/**
 * Live subscription hook for streaming-capable stores.
 *
 * Subscribes to `store.subscribe()` when `store.caps.streaming === true` and
 * `store.subscribe` is implemented. On each push the component re-renders with
 * the new rows.
 *
 * Falls back to `resolveNodeRows` (synchronous) when the store is not
 * streaming-capable or the node has no DataSpec.
 *
 * For non-streaming stores with `node.view.polling.interval` set, fires
 * `resolveNodeRows` on a timer.
 *
 * ```ts
 * // In a defineShell render:
 * const rows = useNodeStream(node, ctx)   // replaces useNodeRows for live panels
 * ```
 */
export function useNodeStream(node: NodeBase, ctx: RenderContext): EngineRow[] {
  const store = resolveStore(ctx)

  const hasData      = 'data' in node && !!node.data
  const isStreaming  = store?.caps?.streaming === true && typeof store.subscribe === 'function'
  const viewPolling  = (node.view as { polling?: { interval: number } } | undefined)?.polling

  // ── Unconditional state — hooks must not be conditional ───────────────────
  //
  //  Even when we are in the sync fast-lane, we must declare useState and both
  //  useEffect calls unconditionally (React hooks rules). The effects are
  //  no-ops when their guard conditions are false.
  //
  const [rows, setRows] = React.useState<EngineRow[]>(() =>
    resolveNodeRows(node, ctx) as unknown as EngineRow[],
  )

  // ── Stable key for subscription deps ─────────────────────────────────────
  //
  //  Re-subscribe / re-poll when the query identity changes (different spec
  //  or resolved dim values). specDimKey returns '' when there are no
  //  extractable requirements — treated as stable.
  //
  const depKey = hasData
    ? specDimKey(node.data as DataSpec, ctx.sectionCtx)
    : ''

  // ── Effect 1: streaming subscription ─────────────────────────────────────
  //
  //  Only active when store is streaming-capable and node has a DataSpec.
  //  Calls subscribe() which must fire cb immediately with current rows, then
  //  on every update. Returns an Unsubscribe fn used as the cleanup.
  //
  React.useEffect(() => {
    if (!isStreaming || !hasData || !store.subscribe) return

    const query = {
      type:   'obs',
      ...(node.data as Record<string, unknown>),
    } as unknown as StoreQuery

    const unsub = store.subscribe(
      query,
      ctx.sectionCtx,
      (result) => {
        // subscribe? callback receives QueryResult — extract .data
        setRows((result.data ?? []) as EngineRow[])
      },
    )

    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming, hasData, depKey, node.storeKey, ctx.pageStoreKey])

  // ── Effect 2: polling fallback ────────────────────────────────────────────
  //
  //  Active when:
  //    - view.polling.interval is set, AND
  //    - The store is NOT streaming (polling is a shim for non-streaming stores)
  //  On each tick, resolveNodeRows is called synchronously and the result is
  //  pushed via setRows. The interval is cleared on unmount or dep change.
  //
  React.useEffect(() => {
    if (!viewPolling?.interval || isStreaming) return

    const id = setInterval(() => {
      setRows(resolveNodeRows(node, ctx) as unknown as EngineRow[])
    }, viewPolling.interval)

    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewPolling?.interval, isStreaming, depKey, node.storeKey, ctx.pageStoreKey])

  // ── Fast-lane: sync stores without polling ────────────────────────────────
  //
  //  When not streaming and not polling, skip state entirely and return the
  //  synchronous result directly. This avoids the extra render cycle from
  //  useState initialisation.
  //
  if (!isStreaming && !viewPolling?.interval) {
    return resolveNodeRows(node, ctx) as unknown as EngineRow[]
  }

  return rows
}
