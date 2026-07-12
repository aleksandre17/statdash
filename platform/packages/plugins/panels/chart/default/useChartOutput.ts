import { useMemo }              from 'react'
import { interpretChart }        from '@statdash/charts'
import { resolveRef, splitMultiValue } from '@statdash/engine'
import { resolveNodeTemplate, resolveActionField } from '@statdash/react/engine'
import type { ChartType, RefServices, LocaleString } from '@statdash/engine'
import type { RenderContext }    from '@statdash/react/engine'
import type { ChartOutput }      from '@statdash/charts'
import type { ChartNode }        from './ChartNode'
import { resolveChartDefLocale } from './utils/localeChartDef'

// ── resolveEmphasis (AR-42) — a `highlight` action's param → an emphasis set ──
//
//  The READ peer of the node's `highlight` write, exactly as TableShell derives
//  `selectedIds` from its selection action (same param = SSOT, Law 1). A chart that
//  declares a `type:'highlight'` action reads that param HERE and lowers it to the
//  neutral `ChartOutput.emphasis` category set the realizer dims from — no requery
//  (the param is transient, not a query dim). No highlight action, or an empty
//  param → `undefined` → the output is byte-identical (bare = unchanged, Postel).
//
//  The emphasis set is the param OR-set (`splitMultiValue`); it matches
//  `output.categories` directly, so a bar-by-category chart whose highlight
//  `fromField` is the category field emphasizes the clicked category. Mapping a
//  non-category `fromField` value → its category is an additive follow-up (the
//  channel is category-keyed; a value→category resolver joins without a new arm).
function resolveEmphasis(
  def:          ChartNode,
  filterParams: RenderContext['filterParams'],
  services:     RefServices,
): readonly string[] | undefined {
  const hl = def.on?.flatMap((h) => h.actions).find((a) => a.type === 'highlight')
  if (!hl) return undefined
  const key = resolveActionField(hl.key, services)
  if (!key) return undefined
  const set = splitMultiValue(String(filterParams[key] ?? ''))
  return set.length ? set : undefined
}

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
//   1. Display-text render boundary + fieldConfig cascade — resolveChartDefLocale folds
//      the parent's ctx.fieldConfig (node def wins per key) and resolves EVERY bilingual
//      ChartNode text field (label / centerLabel / axis units / fieldConfig text) via the
//      CANONICAL template resolver (resolveNodeTemplate → resolveTemplate): it BOTH
//      collapses the i18n / perspective carrier to the active locale AND expands `{key}`
//      tokens against the ctx (`{ ...filterParams, ...vars }` over dims) — the SAME
//      primitive the section subtitle / page-header badge / KPI trendSub funnel through.
//      A locale-only resolve (the old useResolveLocale) left a template like
//      "…დინამიკა, {fromYear}–{toYear}" un-expanded on the series-name/tooltip path (the
//      admin-reported Latin `{fromYear}` leak); routing it through resolveTemplate here
//      resolves the real years per locale, and no raw { ka, en } bag reaches ChartOutput →
//      toApexOptions (Law 1; the engine stays locale-agnostic, resolution at this boundary).
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

  return useMemo(() => {
    const rows = ctx.rows ?? []
    // Canonical display-text resolver — the ONE primitive every template funnels through
    // (useNodeTemplate's param contract: node/repeat vars + filter params over ctx.dims).
    // resolveNodeTemplate is pure, so it lives inside the memo (deps stay on its inputs,
    // not on an unstable closure identity).
    const params  = { ...ctx.filterParams, ...ctx.vars }
    const resolve = (tpl: LocaleString): string => resolveNodeTemplate(tpl, sectionCtx, params)
    // P3: lower a state-bound MARK to a concrete ChartType BEFORE the def reaches the
    // interpreter. Bare-string chartType → same def (byte-identical).
    const markedDef = typeof def.chartType === 'string'
      ? def
      : { ...def, chartType: resolveChartType(def.chartType, { dims: sectionCtx.dims, vars: ctx.vars ?? {} }) }
    const base = resolveChartDefLocale(markedDef, ctx.fieldConfig, resolve)
    const out = interpretChart(
      {
        ...base,
        ...(legend  != null ? { legend:  viewLegend(legend)  } : {}),
        ...(tooltip != null ? { tooltip: { mode: tooltip }   } : {}),
      },
      rows,
      sectionCtx,
    )
    // Emphasis (AR-42) — attach the resolved condition-on-selection category set.
    // Recomputes with ctx.filterParams (a highlight click), NOT with the rows (no
    // requery); byte-identical when the node declares no highlight action.
    const emphasis = resolveEmphasis(def, ctx.filterParams, { dims: sectionCtx.dims, vars: ctx.vars ?? {} })
    return emphasis ? { ...out, emphasis } : out
  }, [def, ctx.fieldConfig, ctx.vars, ctx.filterParams, legend, tooltip, ctx.rows, sectionCtx])
}

function viewLegend(l: 'bottom' | 'right' | 'none') {
  return l === 'none' ? { show: false } : { show: true, position: l as 'bottom' | 'right' }
}
