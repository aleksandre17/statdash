// ── PanelExportBar — the panel-export seam (M-5 capability) ────────────────
//
//  Every data panel shell (chart / table / gauge / …) renders its ExportBar the
//  SAME way: inject the DI EXPORT_BAR component, then wire `onExport` to dispatch
//  a `data:export` command on ctx.bus carrying the rows + meta. That trio was
//  copy-pasted verbatim across the panel shells.
//
//  Promoting it to one wrapper makes "let this panel export its rows" a reusable
//  capability: a shell renders `<PanelExportBar ctx={ctx} rows={rows} meta={meta} />`
//  and the injection + bus-dispatch wiring is owned here, once. A new panel type
//  that wants export costs ZERO per-shell wiring; a change to the export command
//  contract is a single edit here, not N edits across shells.
//
//  React-layer placement is correct: this depends only on the DI container
//  (ctx.ui), the EXPORT_BAR token, and the typed command bus (ctx.bus) — all
//  engine/react primitives, never a plugin. The arrow stays clean.
//

import { useInject }              from '../../engine/useInject'
import { EXPORT_BAR }             from './ExportBar'
import type { RenderContext }     from '../../engine/types'
import type { DataRow, ExportMeta } from '@statdash/engine'

export interface PanelExportBarProps {
  /** The panel's RenderContext — supplies the DI container (ctx.ui) + bus. */
  ctx:   RenderContext
  /** Rows to export — the panel's resolved ctx.rows. */
  rows:  DataRow[]
  /** Export metadata (title + filename). */
  meta:  ExportMeta
}

/**
 * Inject the DI ExportBar and wire its `onExport` to dispatch a `data:export`
 * command on the bus. Renders nothing when rows are empty or no export formats
 * are registered (ExportBar's own guard), so callers need no conditional.
 */
export function PanelExportBar({ ctx, rows, meta }: PanelExportBarProps) {
  const ExportBar = useInject(ctx.ui, EXPORT_BAR)
  return (
    <ExportBar
      rows={rows}
      meta={meta}
      onExport={fmt => ctx.bus.dispatch({ type: 'data:export', format: fmt, rows, meta })}
    />
  )
}
