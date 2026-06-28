import { useMemo }              from 'react'
import { interpretChart }        from '@statdash/charts'
import { useResolveLocale }      from '@statdash/react'
import type { RenderContext }    from '@statdash/react/engine'
import type { ChartOutput }      from '@statdash/charts'
import type { ChartNode }        from './ChartNode'
import { resolveChartDefLocale } from './utils/localeChartDef'

// ── useChartOutput — resolve a ChartNode + ctx into a ChartOutput ──────────
//
//  Owns the data-shaping the shell used to inline:
//   1. LocaleString render boundary + fieldConfig cascade — resolveChartDefLocale
//      folds the parent's ctx.fieldConfig (node def wins per key) and resolves EVERY
//      bilingual ChartNode text field (label / centerLabel / axis units / fieldConfig
//      text) to the active locale, so the engine receives string-only ChartDef and no
//      raw { ka, en } bag can reach ChartOutput → toApexOptions (Law 1; the engine
//      stays locale-agnostic, resolution happens at this React boundary).
//   2. interpretChart — fold in the parent view's legend/tooltip overrides on top of
//      the resolved def, then interpret against the rows.
//
//  Pulling this out lets ChartControl read as orchestration only — it asks for
//  the output, it does not compute it.
//
export function useChartOutput(ctx: RenderContext, def: ChartNode): ChartOutput {
  const { sectionCtx } = ctx
  const legend  = ctx.view?.legend
  const tooltip = ctx.view?.tooltip
  const resolve = useResolveLocale()

  return useMemo(() => {
    const rows = ctx.rows ?? []
    const base = resolveChartDefLocale(def, ctx.fieldConfig, resolve)
    return interpretChart(
      {
        ...base,
        ...(legend  != null ? { legend:  viewLegend(legend)  } : {}),
        ...(tooltip != null ? { tooltip: { mode: tooltip }   } : {}),
      },
      rows,
      sectionCtx,
    )
  }, [def, ctx.fieldConfig, legend, tooltip, ctx.rows, sectionCtx, resolve])
}

function viewLegend(l: 'bottom' | 'right' | 'none') {
  return l === 'none' ? { show: false } : { show: true, position: l as 'bottom' | 'right' }
}
