// ── pageContext — the active page's DEFAULT SectionContext, panel-side (0112 R1) ──
//
//  The canvas renders the engine `NodePageRenderer` inside a `FilterProvider`, so its
//  eval context (`SectionContext.dims`) is derived by the engine's ONE derivation —
//  `useFilterState` over the page `filterSchema`. The Data workbench preview
//  (`usePipelineSourceRows`) lives OUTSIDE that renderer tree (RightDock / the Specs
//  floor), so it used to hard-code `ctx.dims = {}` → every `$ctx` ref starved → 0
//  preview rows while the canvas rendered full data (the R1 divergence).
//
//  This hook is now a thin adapter over `deriveDefaultFilterState` — the provider-FREE
//  zoom of the SAME `filterCtxCore` the renderer's `useFilterState` composes
//  (@statdash/react, 0112 R1 SSOT extraction). ALL default tiers resolve here:
//  Tier 1 (literal) · Tier 2 (ExprVal, topo-ordered) · Tier 3 (options-first, resolved
//  off the live page store — the tier the first cut honestly dropped) · cascade dims.
//  One derivation, two zooms — preview ctx ≡ canvas ctx is structural, not copied.
//
//  Honest state (Law 11): while the live store is still warming, Tier-3 defaults are
//  PENDING — `isLoading` is surfaced so the caller can declare 'loading', never render
//  a fake empty under a half-resolved ctx.
//
import { useMemo } from 'react'
import type { DataStore, SectionContext } from '@statdash/engine'
import type { FilterSchemaInput } from '@statdash/engine'
import { deriveDefaultFilterState } from '@statdash/react'
import { useActivePage } from '../store/constructor.store'
import { useActiveLocales } from '../inspector/useActiveLocales'

export interface ActivePageContext {
  ctx:       SectionContext
  /** True while one or more Tier-3 (options-first) defaults await the store's warm. */
  isLoading: boolean
}

/**
 * The active page's DEFAULT `SectionContext` — the ONE panel-side eval context the Data
 * workbench preview evaluates specs under, so preview rows ≡ canvas rows for the same
 * spec + ctx. Pass the PAGE store (the store options lists resolve from) to enable
 * Tier-3 defaults; without one, Tier-3 stays honestly pending.
 */
export function useActivePageContext(store?: DataStore | null): ActivePageContext {
  const page   = useActivePage()
  const locale = useActiveLocales()[0] ?? 'ka'
  const schema = page?.meta?.filterSchema as FilterSchemaInput | undefined

  const derived = useMemo(() => deriveDefaultFilterState(schema, store), [schema, store])
  const ctx = useMemo<SectionContext>(
    () => ({ dims: derived.ctx.dims, locale }),
    // The dims object identity is stable per derivation; locale folds on top.
    [derived, locale],
  )
  return useMemo<ActivePageContext>(
    () => ({ ctx, isLoading: derived.isLoading }),
    [ctx, derived.isLoading],
  )
}
