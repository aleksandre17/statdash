// ── Export types [N16] ─────────────────────────────────────────────────
//
//  Pure-function serialization API for the export registry.
//  No DOM, no download triggers — those live in the React adapter layer.
//
//  Pattern: each format is a SerializeFn + mime + extension.
//  The React layer calls serialize() then fires URL.createObjectURL.
//

import type { EngineRow } from '../encoding'

/** Per-export metadata — drives filename generation and column selection. */
export interface ExportMeta {
  /** Section or page title — used as filename stem when filename is not set. */
  title?:    string
  /** Explicit filename override (without extension). */
  filename?: string
  /** Ordered field list for export. If omitted, all fields from first row are used. */
  fields?:   string[]
  /** Human-readable column labels keyed by field name. Falls back to field name. */
  labels?:   Record<string, string>
}

/**
 * Pure serializer — takes rows + meta, returns a string.
 * Must be synchronous and free of side-effects.
 */
export type SerializeFn = (rows: EngineRow[], meta: ExportMeta) => string

/** A registered export format descriptor. */
export interface ExportFormat {
  /** IANA media type (e.g. 'text/csv', 'application/json'). */
  mime:      string
  /** File extension without dot (e.g. 'csv', 'json'). */
  ext:       string
  /** Human-readable label for the Constructor's export-format catalog. */
  label:     string
  serialize: SerializeFn
}
