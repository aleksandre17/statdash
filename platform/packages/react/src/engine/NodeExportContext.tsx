// ── NodeExportContext — section-scoped panel-rows publish/subscribe (Law 9) ──
//
//  The EXPORT twin of NodeStatusContext (data-integrity). This is exactly the
//  Option-D seam SectionShell reserved: "if a real aggregate-ROWS consumer
//  appears, panels PUBLISH their rows up, a scope owner subscribes." The compact
//  section-header download menu IS that consumer.
//
//  THE MODEL (GRASP information-expert + low coupling):
//    • Each data panel PUBLISHES its resolved { rows, meta } UPWARD via
//      `useReportPanelExport` (it holds ctx.rows — the precise per-slice truth),
//      instead of each rendering its own export control.
//    • The SECTION owns the scope (`useExportScope`) and renders ONE export menu
//      in its header for the currently-VISIBLE panel's rows (the active chart↔
//      table view). Law 9 (ONS/Eurostat): "export per section".
//    • The visibility gate (shared NodeVisibilityContext) means only the SHOWN
//      view reports — a toggled-hidden panel (display:none, still mounted) clears
//      its report, so the header always exports the slice on screen.
//    • Postel: a panel with NO scope above it publishes nowhere; `scoped` is
//      false and the panel falls back to its own inline menu (nothing lost
//      outside the section anatomy).
//
//  Why the SECTION owns this scope (unlike NodeStatus, which moved UP to the page
//  in AR-40): export is a per-section affordance (Eurostat "download this table"),
//  not a page-wide summary. A section's active view is exactly one data slice.
//
//  LOOP-SAFE design: only PRESENCE (which visible panels can export) lives in
//  React state — it changes on mount / unmount / visibility-toggle, NOT on every
//  row recompute. The rows themselves live in a ref and are read at CLICK time via
//  `readActive()`, so a changing `ctx.rows` identity never triggers a render loop
//  and the download always serializes the latest rows.
//
//  Engine-layer placement is correct: depends only on React + engine primitives
//  (DataRow/ExportMeta types, the visibility context), never a plugin. The section
//  (plugin) creates the scope; panels (plugins) consume the report hook. The arrow
//  stays clean.
//

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { DataRow, ExportMeta } from '@statdash/engine'
import { useNodeVisible } from './NodeStatusContext'

/** The published unit — a panel's currently-displayed rows + export metadata. */
export interface PanelExportData {
  rows: DataRow[]
  meta: ExportMeta
}

interface NodeExportCollector {
  report(nodeId: string, exp: PanelExportData): void
  clear(nodeId: string): void
}

// Publish channel — panels report UP to the nearest section export scope.
const NodeExportContext = createContext<NodeExportCollector | null>(null)

// ── NodeExportProvider — wrap a subtree so its panels publish to this scope ──
export function NodeExportProvider({
  collector,
  children,
}: {
  collector: NodeExportCollector
  children:  ReactNode
}) {
  return <NodeExportContext.Provider value={collector}>{children}</NodeExportContext.Provider>
}

export interface ExportScope {
  /** Hand to NodeExportProvider so the subtree's panels report here. */
  collector: NodeExportCollector
  /** True when ≥1 VISIBLE panel has published non-empty rows — drives whether the
   *  section header renders its export control. */
  hasExport: boolean
  /** Read the ACTIVE (primary visible) panel's CURRENT rows+meta. Call at CLICK
   *  time (not render) so the download serializes the latest rows. */
  readActive: () => PanelExportData | undefined
}

// ── useExportScope — the section creates ONE scope; reads the active export ───
//
//  State is the ordered list of reporting (visible, non-empty) node ids — it
//  changes only on presence transitions, so a per-render `report` (rows identity
//  churns) is idempotent and never loops. The rows live in `entries` (a ref),
//  refreshed on every report and read lazily by `readActive`.
export function useExportScope(): ExportScope {
  const entries         = useRef<Map<string, PanelExportData>>(new Map())
  const [ids, setIds]   = useState<string[]>([])

  const collector = useMemo<NodeExportCollector>(
    () => ({
      report: (id, exp) => {
        entries.current.set(id, exp)                                   // refresh rows (ref — no state churn)
        setIds((prev) => (prev.includes(id) ? prev : [...prev, id]))   // presence only (idempotent)
      },
      clear: (id) => {
        entries.current.delete(id)
        setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev))
      },
    }),
    [],
  )

  const readActive = useCallback((): PanelExportData | undefined => {
    const id = ids[0] // primary = first reporter (DOM/mount order); the toggle case has exactly one
    return id ? entries.current.get(id) : undefined
  }, [ids])

  return { collector, hasExport: ids.length > 0, readActive }
}

// ── useReportPanelExport — a panel publishes its rows to the nearest scope ────
//
//  Returns TRUE when a section export scope is present (the panel published up
//  and should render NO local control); FALSE when standalone (the panel renders
//  its own inline menu, Postel). Visibility-gated: a mounted-but-hidden panel
//  (view-toggle display:none) clears its report so only the shown view exports.
//  Empty rows also clear (nothing to export). Keyed on the authored id, falling
//  back to a stable useId() so an id-less panel still reports exactly once.
export function useReportPanelExport(
  nodeId: string | undefined,
  rows:   DataRow[],
  meta:   ExportMeta,
): boolean {
  const collector  = useContext(NodeExportContext)
  const visible    = useNodeVisible()
  const fallbackId = useId()
  const id         = nodeId ?? fallbackId
  const empty      = rows.length === 0

  useEffect(() => {
    if (!collector) return
    if (!visible || empty) { collector.clear(id); return }
    collector.report(id, { rows, meta })
    return () => collector.clear(id)
  }, [collector, id, visible, empty, rows, meta])

  return collector !== null
}
