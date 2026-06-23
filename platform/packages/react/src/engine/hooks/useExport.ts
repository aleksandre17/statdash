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

import { useCallback }                            from 'react'
import { getExportFormat, listExportFormats }     from '@statdash/engine'
import type { DataRow, ExportMeta, EngineRow }    from '@statdash/engine'

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
 */
export function useExport(rows: DataRow[], meta: ExportMeta): UseExportResult {
  // listExportFormats() is stable across renders (registry doesn't change at runtime)
  const formats = listExportFormats()

  const exportAs = useCallback((format: string) => {
    const fmt = getExportFormat(format)
    if (!fmt || rows.length === 0) return

    const content = fmt.serialize(rows as unknown as EngineRow[], meta)
    const blob    = new Blob([content], { type: fmt.mime })
    const url     = URL.createObjectURL(blob)
    const a       = document.createElement('a')
    a.href        = url
    a.download    = `${meta.filename ?? meta.title ?? 'export'}.${fmt.ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [rows, meta])

  return { formats, exportAs }
}
