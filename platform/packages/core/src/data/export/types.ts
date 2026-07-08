// ── Export types [N16] ─────────────────────────────────────────────────
//
//  Pure-function serialization API for the export registry.
//  No DOM, no download triggers — those live in the React adapter layer.
//
//  Pattern: each format is a SerializeFn + mime + extension.
//  The React layer calls serialize() then fires URL.createObjectURL.
//

import type { EngineRow } from '../encoding'

/**
 * Minimal citation provenance carried on a delivered export artifact (AR-48 P1,
 * Law 9 — an NSO number without its vintage is a reproducibility half-measure).
 * Every field optional: absence degrades gracefully (Postel) — a citation
 * without provenance is still a valid citation, it simply carries no footer.
 *
 * D6 "minimal payload" (DESIGN-delivery-port-export-embed-snapshot.md §7):
 * source + lastUpdated + a methodology LINK + permalink; the full ESMS report
 * stays one click away via `methodologyUrl`. Structurally mirrors
 * `@statdash/contracts`' `ViewSnapshotProvenance` (the wire/snapshot twin) —
 * each owns its own boundary shape rather than importing across the arrow
 * (core cannot depend on contracts' react-facing wire shape; see that type's
 * own doc comment for the symmetric rationale).
 */
export interface ExportProvenance {
  source?:         string
  lastUpdated?:    string
  methodologyUrl?: string
  /** The citation URL for this exact view (the permalink leg of the same port). */
  permalink?:      string
  /** ISO timestamp the artifact was generated — the reproducibility stamp. */
  accessedAt?:     string
}

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
  /**
   * Citation provenance for this artifact (AR-48 P1). When present, csv appends
   * a footer block and xlsx adds a "Metadata" sheet (see provenanceFooter.ts).
   * Absent ⇒ byte-identical to the pre-P1 output (regression-safe).
   */
  provenance?: ExportProvenance
}

/**
 * Pure serializer — takes rows + meta, returns the serialized payload.
 * Text formats (csv, sdmx-json) return a `string`; binary container formats
 * (xlsx and other OOXML/zip payloads) return raw bytes as a `Uint8Array`.
 * The download layer wraps either in a Blob with the format's `mime`.
 * Must be synchronous and free of side-effects.
 */
export type SerializeFn = (rows: EngineRow[], meta: ExportMeta) => string | Uint8Array

/**
 * Identifier of a registered export format (e.g. 'csv', 'xlsx', 'sdmx-json').
 *
 * The registry is the single source of truth for available formats — ids are
 * an open set (plugins/app layer register new ones), so this is `string`, not
 * a hand-maintained literal union. Consumers derive the live list from
 * `listExportFormats()`; this alias names the value type for that SSOT so
 * callers stop duplicating a `'csv' | 'xlsx'` union that can drift.
 */
export type ExportFormatId = string

/** A registered export format descriptor. */
export interface ExportFormat {
  /** IANA media type (e.g. 'text/csv', 'application/json'). */
  mime:      string
  /** File extension without dot (e.g. 'csv', 'json'). */
  ext:       string
  /** Human-readable label for the Constructor's export-format catalog. */
  label:     string
  /**
   * Emit a UTF-8 byte-order mark ahead of the payload. Applies only to text
   * (`string`) serializers — the download layer prepends the U+FEFF BOM so Excel
   * detects UTF-8 and renders non-Latin scripts (e.g. Georgian) correctly.
   * The format declares its own need (SSOT); the download layer never guesses
   * per-format from a mime literal. Binary serializers (Uint8Array) ignore it.
   */
  bom?:      boolean
  serialize: SerializeFn
}
