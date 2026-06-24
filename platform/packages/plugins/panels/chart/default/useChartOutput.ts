import { useMemo }              from 'react'
import { interpretChart }        from '@statdash/charts'
import type { RenderContext }    from '@statdash/react/engine'
import type { ChartOutput }      from '@statdash/charts'
import type { ChartNode }        from './ChartNode'

// ── useChartOutput — resolve a ChartNode + ctx into a ChartOutput ──────────
//
//  Owns the two data-shaping memos ChartControl used to inline:
//   1. fieldConfig cascade — the parent's ctx.fieldConfig is the base, the
//      node's own def.fieldConfig overrides it (node wins per key). Either
//      side absent ⇒ skip the merge.
//   2. interpretChart — strip the shell-only fields (type/chartType/fieldConfig)
//      off def, fold in the resolved fieldConfig + the parent view's
//      legend/tooltip overrides, then interpret against the rows.
//
//  Pulling this out lets ChartControl read as orchestration only — it asks for
//  the output, it does not compute it.
//
export function useChartOutput(ctx: RenderContext, def: ChartNode): ChartOutput {
  const { sectionCtx } = ctx
  const legend  = ctx.view?.legend
  const tooltip = ctx.view?.tooltip

  // fieldConfig cascade — parent ctx.fieldConfig as base, node def as override.
  const defFc = def.fieldConfig
  const fieldConfig = useMemo(
    () => (ctx.fieldConfig || defFc) ? { ...ctx.fieldConfig, ...defFc } : undefined,
    [ctx.fieldConfig, defFc],
  )

  return useMemo(() => {
    const rows = ctx.rows ?? []
    const { type: _type, chartType, fieldConfig: _fc, ...chartDefFields } = def
    return interpretChart(
      {
        type: chartType,
        ...chartDefFields,
        ...(fieldConfig != null ? { fieldConfig } : {}),
        ...(legend  != null ? { legend:  viewLegend(legend)  } : {}),
        ...(tooltip != null ? { tooltip: { mode: tooltip }   } : {}),
      },
      rows,
      sectionCtx,
    )
  }, [def, fieldConfig, legend, tooltip, ctx.rows, sectionCtx])
}

function viewLegend(l: 'bottom' | 'right' | 'none') {
  return l === 'none' ? { show: false } : { show: true, position: l as 'bottom' | 'right' }
}
