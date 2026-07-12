// ── constructor.selectors — typed read-side hooks (ISP) ───────────────────────
//
//  Consumers depend only on the slice they read. Split out of the store module
//  (one concern per file — the store factory owns action wiring, this owns the
//  read accessors). Re-exported from constructor.store for import stability.
//
import { useConstructorStore } from './constructor.store'
import type { SelectionAddress } from './constructor.history'

// `useActiveSurface` now lives in studio/useStudioRoute (the surface is URL state,
// not store state) — the store no longer holds `activeSurface`.
export const useDataSources     = () => useConstructorStore((s) => s.dataSources)
export const useDataSpecs       = () => useConstructorStore((s) => s.dataSpecs)
export const useSite            = () => useConstructorStore((s) => s.site)
export const usePages           = () => useConstructorStore((s) => s.pages)

// ── Effective active page — the derived "always-a-home" SSOT (FF-ALWAYS-A-HOME) ──
//
//  The invalid state "pages exist but none is active" — a null `activePageId` (or a
//  STALE one pointing at a just-removed page: removePagePatch nulls it while sibling
//  pages remain) while `pages` is non-empty — was REPRESENTABLE, and any boot race /
//  ordering / live-payload quirk that left it so stranded the whole shell (blank
//  canvas, empty Layers, blank page-switcher, disabled Save/Publish). We make that
//  state unrepresentable at the READ boundary: a null/stale selection falls back to
//  the first page, so given ≥1 page the effective id is NEVER null.
//
//  Pure + read-only (never a set-state side-effect). The imperative `setActivePage`
//  remains the EXPLICIT-selection write; correctness no longer depends on it having
//  fired. "The active page" in this single-canvas always-home shell IS the effective
//  page, so the long-standing selectors resolve through this derivation and every
//  surface (canvas, Layers, page switcher, Save/Publish, page-scoped panes, commands)
//  inherits the guarantee with no call-site branching on a raw null.
export function effectiveActivePageId(
  activePageId: string | null,
  pages: readonly { id: string }[],
): string | null {
  if (activePageId != null && pages.some((p) => p.id === activePageId)) return activePageId
  return pages[0]?.id ?? null
}

export const useEffectiveActivePageId = () =>
  useConstructorStore((s) => effectiveActivePageId(s.activePageId, s.pages))
export const useEffectiveActivePage   = () =>
  useConstructorStore((s) => {
    const id = effectiveActivePageId(s.activePageId, s.pages)
    return id != null ? (s.pages.find((p) => p.id === id) ?? null) : null
  })

// Legacy names resolve through the derived SSOT (the raw explicit selection remains
// the store field `s.activePageId` — the `setActivePage` write target — which no
// surface should read to decide which page renders).
export const useActivePage   = useEffectiveActivePage
export const useActivePageId = useEffectiveActivePageId
// ── The selection reads, DERIVED from the ONE address (ADR-041 R4) ────────────
//
//  `selectedNodeId` · `selectedItemPath` are no longer independent store fields —
//  they are pure projections of the ONE `selection` `PartAddress` (FF-ONE-SELECTION-
//  ADDRESS). A whole-node selection contributes the nodeId; a drilled part adds the
//  partPath. Chrome is NOT a special case any more: a chrome region is the site-frame's
//  nodeId + a `chrome.<slot>` partPath, so it flows through these SAME two reads (the
//  `chromeSelectionOf`/`isChromeSelection` projections are retired with the arm).
//  Each projection returns a primitive, so the derived hooks stay referentially stable.

/** The owning node of the current selection (a node or a drilled part), else null. */
export const selectedNodeIdOf = (s: SelectionAddress | null): string | null =>
  s != null ? s.nodeId : null

/** The drilled part's `partPath` (positional value / stable-key sourced / chrome slot). */
export const selectedItemPathOf = (s: SelectionAddress | null): string | null =>
  s != null && s.partPath != null ? s.partPath : null

export const useSelection        = () => useConstructorStore((s) => s.selection)
export const useSelectedNode     = () => useConstructorStore((s) => selectedNodeIdOf(s.selection))
export const useSelectedItemPath = () => useConstructorStore((s) => selectedItemPathOf(s.selection))
export const useHistory         = () => useConstructorStore((s) => ({ canUndo: s.canUndo, canRedo: s.canRedo, undo: s.undo, redo: s.redo }))

// ── Lifecycle read-side (server FSM mirror + save/publish UI state) ───────────
export const usePageLifecycle = (id: string | null) =>
  useConstructorStore((s) => (id ? s.lifecycle[id] ?? null : null))
export const useSaveStatus = (id: string | null) =>
  useConstructorStore((s) => (id ? s.saveStatus[id] ?? null : null))
export const usePublishStatus = (id: string | null) =>
  useConstructorStore((s) => (id ? s.publishStatus[id] ?? null : null))
