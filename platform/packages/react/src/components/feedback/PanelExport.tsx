// ── PanelExport — the panel-export seam (M-5 capability) ───────────────────
//
//  A data panel shell renders `<PanelExport ctx rows meta nodeId spec />` and
//  this wrapper owns the wiring, once:
//    • It PUBLISHES the panel's resolved { rows, meta } to the nearest SECTION
//      export scope (useReportPanelExport). The section renders ONE compact
//      export menu in its header for the active (visible) view — Law 9,
//      "export per section". A scoped panel renders NOTHING here.
//    • POSTEL fallback: a panel with NO section scope above it (a standalone
//      chart under a page) renders its OWN compact ExportMenu inline, so export
//      is never lost outside the section anatomy — the SAME `data:export` bus
//      path (downloadExport seam unchanged).
//    • AR-48 P1: when `spec` is given, `meta` is enriched with `provenance`
//      derived from `ctx.stores`' MetadataPort (via `deriveExportProvenance`,
//      the SAME synchronous, already-warm registry lookup `withMetricProvenance`
//      installs at boot — no network call, no second data read). This is the
//      ONE join point EVERY panel shell's export flows through, so "every
//      artifact carries its provenance" costs zero per-shell code (Law 8).
//      `spec` absent (or no MetadataPort installed) ⇒ `meta` unchanged
//      (Postel — a citation without provenance is still a valid citation).
//
//  React-layer placement is correct: depends only on the DI container (ctx.ui),
//  the EXPORT_MENU token, the export scope, and the typed command bus (ctx.bus) —
//  all engine/react primitives, never a plugin. The arrow stays clean.
//

import { useMemo }                from 'react'
import { useInject }              from '../../engine/useInject'
import { useReportPanelExport }   from '../../engine/NodeExportContext'
import { resolveStore }           from '../../engine/resolveNodeRows'
import { EXPORT_MENU }            from './ExportMenu'
import type { RenderContext }     from '../../engine/types'
import { deriveExportProvenance } from '@statdash/engine'
import type { DataRow, ExportMeta, DataSpec } from '@statdash/engine'

export interface PanelExportProps {
  /** The panel's RenderContext — supplies the DI container (ctx.ui) + bus. */
  ctx:   RenderContext
  /** Rows to export — the panel's resolved ctx.rows. */
  rows:  DataRow[]
  /** Export metadata (title + filename). */
  meta:  ExportMeta
  /** Panel node id — the scope key (dedupe + active-view pick). */
  nodeId?: string
  /**
   * The panel's DataSpec (`def.data`) — optional. When present, drives the
   * AR-48 P1 provenance join (see module header). Absent ⇒ `meta.provenance`
   * is left untouched (a panel with no spec, e.g. a literal row-list, has no
   * underlying code to look up).
   */
  spec?: DataSpec
}

/**
 * Publish the panel's rows to the section export scope; render an inline
 * ExportMenu only when standalone. Renders nothing when rows are empty or no
 * export formats are registered (ExportMenu's own guard), so callers need no
 * conditional.
 */
export function PanelExport({ ctx, rows, meta, nodeId, spec }: PanelExportProps) {
  const enrichedMeta = useMemo<ExportMeta>(() => {
    if (!spec || meta.provenance) return meta
    const store      = resolveStore({ stores: ctx.stores, pageStoreKey: ctx.pageStoreKey })
    const provenance = deriveExportProvenance(spec, ctx.sectionCtx, store)
    return provenance ? { ...meta, provenance } : meta
  }, [spec, meta, ctx.stores, ctx.pageStoreKey, ctx.sectionCtx])

  const scoped     = useReportPanelExport(nodeId, rows, enrichedMeta)
  const ExportMenu = useInject(ctx.ui, EXPORT_MENU)

  // Scoped → the section header owns the control (this panel published upward).
  if (scoped) return null

  // Standalone → the compact menu inline, same bus-dispatched download path.
  return (
    <ExportMenu
      rows={rows}
      meta={enrichedMeta}
      onExport={fmt => ctx.bus.dispatch({ type: 'data:export', format: fmt, rows, meta: enrichedMeta })}
    />
  )
}
