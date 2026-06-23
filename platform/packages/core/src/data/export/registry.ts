// ── Export registry [N16] ─────────────────────────────────────────────
//
//  OCP registry for data export formats.
//  Built-ins (CSV, SDMX-JSON) register at module init in export/index.ts.
//  App-layer or plugin formats (XLSX, PNG, SVG) register via registerExport().
//

import type { ExportFormat } from './types'

const _registry = new Map<string, ExportFormat>()

/**
 * Register an export format.
 * Last-write-wins — allows overriding built-ins in tests or by plugins.
 */
export function registerExport(id: string, format: ExportFormat): void {
  _registry.set(id, format)
}

/** Look up a registered export format by id. */
export function getExportFormat(id: string): ExportFormat | undefined {
  return _registry.get(id)
}

/**
 * Returns all registered export format ids (insertion order).
 * Used by the Constructor to populate the export-format catalog.
 */
export function listExportFormats(): string[] {
  return [..._registry.keys()]
}
