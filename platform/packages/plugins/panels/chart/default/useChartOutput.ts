import { useMemo }              from 'react'
import { interpretChart }        from '@statdash/charts'
import { useResolveLocale }      from '@statdash/react'
import { resolveRef }            from '@statdash/engine'
import type { ChartType, RefServices } from '@statdash/engine'
import type { RenderContext }    from '@statdash/react/engine'
import type { ChartOutput }      from '@statdash/charts'
import type { ChartNode }        from './ChartNode'
import { resolveChartDefLocale } from './utils/localeChartDef'

// AR-36 P3 — resolve a state-bound MARK. `chartType` may be a `{ $ctx: key }` ref
// (donut ⇄ bar rotating with the selection); lower it to the concrete ChartType via
// the ONE dispatcher ($ctx → dims, $ref → vars fallback — the SAME two-step resolution
// the encoding-ref pass uses). A plain string chartType passes through untouched
// (byte-identical). Dimension-blind (Law 1): substitutes whatever mark the config named.
function resolveChartType(
  chartType: ChartNode['chartType'],
  services:  RefServices,
): ChartType {
  if (typeof chartType === 'string') return chartType
  const key = chartType.$ctx
  const v   = resolveRef({ $ctx: key }, services) ?? resolveRef({ $ref: key }, services)
  return (v == null ? 'bar' : String(v)) as ChartType
}

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
    // P3: lower a state-bound MARK to a concrete ChartType BEFORE the def reaches the
    // interpreter. Bare-string chartType → same def (byte-identical).
    const markedDef = typeof def.chartType === 'string'
      ? def
      : { ...def, chartType: resolveChartType(def.chartType, { dims: sectionCtx.dims, vars: ctx.vars ?? {} }) }
    const base = resolveChartDefLocale(markedDef, ctx.fieldConfig, resolve)
    return interpretChart(
      {
        ...base,
        ...(legend  != null ? { legend:  viewLegend(legend)  } : {}),
        ...(tooltip != null ? { tooltip: { mode: tooltip }   } : {}),
      },
      rows,
      sectionCtx,
    )
  }, [def, ctx.fieldConfig, ctx.vars, legend, tooltip, ctx.rows, sectionCtx, resolve])
}

function viewLegend(l: 'bottom' | 'right' | 'none') {
  return l === 'none' ? { show: false } : { show: true, position: l as 'bottom' | 'right' }
}
