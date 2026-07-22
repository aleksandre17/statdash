// ── pageContext — the active page's DEFAULT SectionContext, panel-side (0112 R1) ──
//
//  The canvas renders the engine `NodePageRenderer` inside a `FilterProvider`, so its
//  eval context (`SectionContext.dims`) is derived by the engine's ONE derivation —
//  `useFilterState` → `resolveDefaults` + `toCtxValue` over the page `filterSchema`. A
//  section `query` that carries `$ctx` refs (a page-control-driven dim) therefore
//  resolves against REAL dims on the canvas.
//
//  The Data workbench preview (`usePipelineSourceRows`) lives OUTSIDE that renderer
//  tree (in the RightDock / the Specs floor), so it had NO context — it hard-coded
//  `ctx.dims = {}`. Any `$ctx` ref then resolved empty → the preview showed 0 rows at
//  every step while the canvas rendered full data (the R1 divergence). This module is
//  the panel-side PROJECTION of the engine's default-dims derivation: it reuses the
//  SAME exported engine primitives (`resolveDefaults` + `toCtxValue`) over the SAME
//  page `filterSchema`, so the preview evaluates under the page's canonical DEFAULT ctx
//  — never a second, bespoke ctx rule.
//
//  Honest semantics (Law 11): the door-opened workbench and the Specs-floor direct
//  editor both read the page's DEFAULT ctx (the state the canvas renders with before any
//  user filter interaction). A dim whose default is an OPTIONS-first pick (Tier 3 —
//  resolved from a warm store inside the renderer) is not reachable outside the provider,
//  so it is honestly ABSENT here rather than faked; unifying that last tier needs a
//  shared `@statdash/react` hook (a packages change — see the return packet).
//
import { useMemo } from 'react'
import type { DimVal, FilterSchemaInput, ParamDef, SectionContext } from '@statdash/engine'
import { resolveDefaults, toCtxValue } from '@statdash/engine'
import { useActivePage } from '../store/constructor.store'
import { useActiveLocales } from '../inspector/useActiveLocales'

/** Flatten every `{ key, def }` param across all bars — the SAME projection
 *  `useFilterState` builds (order within each bar preserved). */
function flattenParams(schema: FilterSchemaInput): Array<{ key: string; def: ParamDef }> {
  return Object.values(schema.bars).flatMap((bar) =>
    Object.entries(bar.filters).map(([key, def]) => ({ key, def })),
  )
}

/**
 * Derive the page's DEFAULT `ctx.dims` from its `filterSchema` — pure, framework-free.
 *
 * Mirrors `useFilterState`'s ctx assembly with the engine's OWN primitives:
 *   1. `resolveDefaults(params, {}, () => null)` fills every param's Tier-1 (literal) and
 *      Tier-2 (ExprVal `$ctx`-chained) default; a Tier-3 (options-first) default has no
 *      store outside the provider, so it resolves to '' (honestly absent, dropped below).
 *   2. `context.dims` maps each context dimension → its param key; `toCtxValue` folds the
 *      resolved raw value onto its wire scalar (the ONE per-type seam). Empties are dropped
 *      so an unset dim is ABSENT (`no filtering`), never a spurious match-nothing value.
 *
 * A page with no `context.dims` yields `{}` (the pre-fix behaviour) — no regression.
 */
export function deriveDefaultDims(schema: FilterSchemaInput | undefined): Record<string, DimVal> {
  const ctxDims = schema?.context?.dims
  if (!schema || !ctxDims) return {}

  const params = flattenParams(schema)
  const { dims: raw } = resolveDefaults(params, {}, () => null)

  const out: Record<string, DimVal> = {}
  for (const [dimKey, paramKey] of Object.entries(ctxDims)) {
    const def = params.find((p) => p.key === paramKey)?.def
    const val: DimVal = def ? toCtxValue(def, raw[paramKey] ?? '') : (raw[paramKey] as DimVal)
    if (val !== '' && val !== undefined) out[dimKey] = val
  }
  return out
}

/**
 * The active page's DEFAULT `SectionContext` — the ONE panel-side eval context the Data
 * workbench preview evaluates specs under, so preview rows ≡ canvas rows for the same
 * spec + ctx. Stable identity while the schema + locale are unchanged.
 */
export function useActivePageContext(): SectionContext {
  const page   = useActivePage()
  const locale = useActiveLocales()[0] ?? 'ka'
  const schema = page?.meta?.filterSchema as FilterSchemaInput | undefined

  const dims = useMemo(() => deriveDefaultDims(schema), [schema])
  return useMemo<SectionContext>(() => ({ dims, locale }), [dims, locale])
}
