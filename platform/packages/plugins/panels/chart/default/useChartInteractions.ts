import { useCallback }          from 'react'
import type { DimVal }           from '@statdash/engine'
import { useNodeInteractions }   from '@statdash/react/engine'
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

  // Cross-filter — a chart point:click is a selection gesture. It routes through
  // the ONE shared adapter (def.on[] + dataLinks filter branch → CommandBus), the
  // SAME seam the table and map use. This finally honours the filter branch that
  // was previously dropped here (navigate-only). NAVIGATION (dataLinks 'navigate')
  // is a distinct cross-page concern and stays local (nav:drill).
  const { emit } = useNodeInteractions(def, ctx)

  const onDataClick = useCallback((dataIndex: number) => {
    const row = ctx.rows?.[dataIndex]
    if (!row) return
    // Selection (on[] + dataLinks:filter) — one write point via the adapter.
    emit('point:click', row as unknown as Record<string, unknown>)
    // Navigation (dataLinks:navigate) — cross-page drill, not a selection write.
    if (def.dataLinks?.length) {
      const nav = ctx.resolveLinks(def.dataLinks, row as unknown as Record<string, DimVal>)
        .find((l) => l.action === 'navigate')
      if (nav && nav.action === 'navigate') {
        ctx.bus.dispatch({ type: 'nav:drill', href: nav.href, target: nav.target ?? 'page' })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emit, def.dataLinks, ctx.rows, ctx.resolveLinks, ctx.bus])

  // Present the handler only when the node declares an interaction (on[] or
  // dataLinks) — otherwise the chart stays inert (no affordance, no regression).
  const interactive = !!(def.on?.length || def.dataLinks?.length)

  return {
    onDataHover,
    onDataLeave,
    onDataClick: interactive ? onDataClick : undefined,
  }
}
