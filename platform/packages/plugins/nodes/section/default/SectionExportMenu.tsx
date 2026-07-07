// ── SectionExportMenu — the section header's compact download control ──────
//
//  Rendered in the section header actions row (a sibling of the copy-link
//  permalink + info icons) ONLY when the section's active view has exportable
//  rows. It injects the DI ExportMenu and feeds it the ACTIVE (visible) panel's
//  rows — read at CLICK time via `readActive()` so the download serializes the
//  latest slice — dispatching the SAME `data:export` command on the bus the
//  panels used before (downloadExport seam unchanged). Law 9: export per section.
//
//  Isolated into its own component (not inlined in SectionShell) so the
//  useInject(EXPORT_MENU) hook only runs when the section actually has an export
//  to offer — a section with no reporting panels never touches the DI container.
//

import { useInject, EXPORT_MENU }   from '@statdash/react'
import type { RenderContext, PanelExportData } from '@statdash/react/engine'

export function SectionExportMenu({
  ctx,
  readActive,
}: {
  ctx:        RenderContext
  readActive: () => PanelExportData | undefined
}) {
  const ExportMenu = useInject(ctx.ui, EXPORT_MENU)
  const snapshot   = readActive()
  if (!snapshot) return null

  return (
    <ExportMenu
      rows={snapshot.rows}
      meta={snapshot.meta}
      // Match the sibling header icons (copy-link / info) exactly.
      triggerClassName="section__icon-btn"
      onExport={(fmt) => {
        // Re-read at click so a filter change since render exports fresh rows.
        const active = readActive() ?? snapshot
        ctx.bus.dispatch({ type: 'data:export', format: fmt, rows: active.rows, meta: active.meta })
      }}
    />
  )
}
