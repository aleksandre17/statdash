// ── PanelExport — the panel-export seam (M-5 capability) ───────────────────
//
//  A data panel shell renders `<PanelExport ctx rows meta nodeId />` and this
//  wrapper owns the wiring, once:
//    • It PUBLISHES the panel's resolved { rows, meta } to the nearest SECTION
//      export scope (useReportPanelExport). The section renders ONE compact
//      export menu in its header for the active (visible) view — Law 9,
//      "export per section". A scoped panel renders NOTHING here.
//    • POSTEL fallback: a panel with NO section scope above it (a standalone
//      chart under a page) renders its OWN compact ExportMenu inline, so export
//      is never lost outside the section anatomy — the SAME `data:export` bus
//      path (downloadExport seam unchanged).
//
//  React-layer placement is correct: depends only on the DI container (ctx.ui),
//  the EXPORT_MENU token, the export scope, and the typed command bus (ctx.bus) —
//  all engine/react primitives, never a plugin. The arrow stays clean.
//

import { useInject }              from '../../engine/useInject'
import { useReportPanelExport }   from '../../engine/NodeExportContext'
import { EXPORT_MENU }            from './ExportMenu'
import type { RenderContext }     from '../../engine/types'
import type { DataRow, ExportMeta } from '@statdash/engine'

export interface PanelExportProps {
  /** The panel's RenderContext — supplies the DI container (ctx.ui) + bus. */
  ctx:   RenderContext
  /** Rows to export — the panel's resolved ctx.rows. */
  rows:  DataRow[]
  /** Export metadata (title + filename). */
  meta:  ExportMeta
  /** Panel node id — the scope key (dedupe + active-view pick). */
  nodeId?: string
}

/**
 * Publish the panel's rows to the section export scope; render an inline
 * ExportMenu only when standalone. Renders nothing when rows are empty or no
 * export formats are registered (ExportMenu's own guard), so callers need no
 * conditional.
 */
export function PanelExport({ ctx, rows, meta, nodeId }: PanelExportProps) {
  const scoped     = useReportPanelExport(nodeId, rows, meta)
  const ExportMenu = useInject(ctx.ui, EXPORT_MENU)

  // Scoped → the section header owns the control (this panel published upward).
  if (scoped) return null

  // Standalone → the compact menu inline, same bus-dispatched download path.
  return (
    <ExportMenu
      rows={rows}
      meta={meta}
      onExport={fmt => ctx.bus.dispatch({ type: 'data:export', format: fmt, rows, meta })}
    />
  )
}
