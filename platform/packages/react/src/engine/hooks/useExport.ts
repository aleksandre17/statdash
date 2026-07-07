// ── useExport [N16] ────────────────────────────────────────────────────
//
//  @statdash/react engine layer — app-agnostic export hook.
//  Wraps the export registry + browser download trigger.
//
//  Architecture: SerializeFn lives in @statdash/engine (pure TS, no DOM).
//  Download trigger lives here (React adapter layer owns browser APIs).
//  Cast rows: DataRow[] → EngineRow[] is safe because DataRow fields are
//  all DimVal values, which is exactly what EngineRow expects.
//

import { useCallback }                from 'react'
import { listExportFormats }          from '@statdash/engine'
import type { DataRow, ExportMeta }   from '@statdash/engine'
import { downloadExport }             from '../downloadExport'

export interface UseExportResult {
  /** Sorted list of registered export format ids (e.g. ['csv', 'sdmx-json']). */
  formats:  string[]
  /** Trigger a browser download for the given format. No-op if format unregistered or rows empty. */
  exportAs: (format: string) => void
}

/**
 * Hook: wraps the export registry + browser download trigger.
 * rows must be DataRow[] from ctx.rows — cast to EngineRow[] is safe because
 * DataRow fields are all DimVal values.
 *
 * The download trigger itself is the shared `downloadExport` seam (serialize
 * via the registry, then Blob → object URL → transient <a download> click).
 * The SAME seam backs SiteRenderer's `data:export` command handler, so the
 * ExportBar's own path and the bus-dispatched path are byte-identical.
 */
export function useExport(rows: DataRow[], meta: ExportMeta): UseExportResult {
  // listExportFormats() is stable across renders (registry doesn't change at runtime)
  const formats = listExportFormats()

  const exportAs = useCallback((format: string) => {
    if (rows.length === 0) return
    downloadExport(format, rows, meta)
  }, [rows, meta])

  return { formats, exportAs }
}
