// ── useFilterBarAuthoring — the ONE filter-control write-through seam [D7.3] ────
//
//  Both filter-control authoring surfaces edit the SAME source of truth:
//    • the Page-context <FiltersDrawer> (all bars, expanded), and
//    • the Element-context <FilterBarControlsBridge> (a filter-bar NODE's bars,
//      drilled) — the D7.3 bridge.
//  This hook is that single seam: it projects `page.meta.filterSchema` to the
//  ordered editor view (`barViews`) and commits an edited bar's controls back
//  through the ONE reducer path (setBarParams → updatePage → markPageDirty).
//
//  Extracting it makes the SSOT literal: the node bridge does NOT copy controls
//  onto the node and does NOT fork a second write path — it writes through THIS
//  commit, exactly as the drawer does. No denormalization is possible by
//  construction (the node's `barIds` is never written here; only
//  page.meta.filterSchema.bars[barId].filters is).
//
import type { FilterSchemaInput, ParamNode } from '@statdash/engine'
import { useConstructorStore, useEffectiveActivePage } from '../../store/constructor.store'
import { toBarViews, setBarParams, type BarView } from './filterSchemaModel'

export interface FilterBarAuthoring {
  /** The active page (null when none) — the owner of the filterSchema SSOT. */
  page:      ReturnType<typeof useEffectiveActivePage>
  /** Every bar in `page.meta.filterSchema`, projected to the ordered editor view. */
  barViews:  BarView[]
  /** Commit an edited bar's controls back into page.meta.filterSchema (SSOT write). */
  commitBar: (barId: string, params: ParamNode[]) => void
}

export function useFilterBarAuthoring(): FilterBarAuthoring {
  const page          = useEffectiveActivePage()
  const updatePage    = useConstructorStore((s) => s.updatePage)
  const markPageDirty = useConstructorStore((s) => s.markPageDirty)

  const pageId = page?.id ?? null
  const schema = page?.meta?.filterSchema as FilterSchemaInput | undefined
  const barViews = toBarViews(schema)

  // Commit a bar's edited control list back into page.meta.filterSchema. Additive
  // + lossless: setBarParams preserves every OTHER bar and all advanced top-level
  // keys verbatim, so an unedited page round-trips byte-identical.
  const commitBar = (barId: string, params: ParamNode[]) => {
    if (!pageId || !page) return
    const nextSchema = setBarParams(schema, barId, params)
    updatePage(pageId, { meta: { ...page.meta, filterSchema: nextSchema } })
    markPageDirty(pageId)
  }

  return { page, barViews, commitBar }
}
