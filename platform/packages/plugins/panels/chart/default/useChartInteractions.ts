import { useCallback }          from 'react'
import type { DimVal }           from '@statdash/engine'
import type { RenderContext }    from '@statdash/react/engine'
import type { ChartOutput }      from '@statdash/charts'
import type { ChartNode }        from './ChartNode'

export interface ChartInteractions {
  /** EventBus: publish row:hover for the data point at dataIndex. */
  onDataHover: (dataIndex: number) => void
  /** EventBus: publish row:leave when the pointer exits a data point. */
  onDataLeave: () => void
  /**
   * DataLinks navigation: resolve the clicked row's links and dispatch nav:drill
   * for the first 'navigate' link. `undefined` when the node declares no
   * dataLinks, so the caller can omit the handler entirely (chart stays inert).
   */
  onDataClick: ((dataIndex: number) => void) | undefined
}

// ── useChartInteractions — the chart's cross-node wiring, in one place ──────
//
//  ChartControl had three inline useCallbacks doing three distinct cross-node
//  jobs: EventBus hover/leave (so a sibling table can highlight the matching
//  row) and DataLinks click → CommandBus nav:drill (cross-page drill-down).
//  They are orchestration plumbing, not chart logic, so they live here and the
//  shell consumes a small typed bundle.
//
export function useChartInteractions(
  ctx:    RenderContext,
  def:    ChartNode,
  output: ChartOutput,
): ChartInteractions {
  // EventBus — publish row:hover / row:leave on chart data-point events so a
  // sibling panel (e.g. a table) can highlight the matching row.
  const onDataHover = useCallback((dataIndex: number) => {
    const rowKey = output.categories[dataIndex] ?? String(dataIndex)
    ctx.eventBus.publish('row:hover', { rowKey, nodeType: 'chart' })
  }, [ctx.eventBus, output.categories])

  const onDataLeave = useCallback(() => {
    ctx.eventBus.publish('row:leave', { nodeType: 'chart' })
  }, [ctx.eventBus])

  // DataLinks — navigate on chart click via the CommandBus (nav:drill).
  const onDataClick = useCallback((dataIndex: number) => {
    if (!def.dataLinks?.length) return
    const row = ctx.rows?.[dataIndex]
    if (!row) return
    const links = ctx.resolveLinks(def.dataLinks, row as unknown as Record<string, DimVal>)
    if (links.length > 0) {
      const link = links[0]
      if (link.action === 'navigate') {
        ctx.bus.dispatch({ type: 'nav:drill', href: link.href, target: link.target ?? 'page' })
      }
    }
    // The granular ctx.* deps below are intentionally precise (ctx.rows changes on
    // data load; depending on the whole `ctx` object would over-invalidate). The
    // rule's demand for the parent `ctx` is over-conservative here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def.dataLinks, ctx.rows, ctx.resolveLinks, ctx.bus])

  return {
    onDataHover,
    onDataLeave,
    onDataClick: def.dataLinks?.length ? onDataClick : undefined,
  }
}
