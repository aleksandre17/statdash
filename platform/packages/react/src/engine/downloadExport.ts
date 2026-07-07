// ── downloadExport — react-layer browser download of exported rows [N16] ──
//
//  The ONE download-trigger seam. Serialization lives in @statdash/engine
//  (pure TS, no DOM); the browser side — Blob → object URL → transient
//  <a download> click → revoke — lives HERE, in the React adapter layer, so
//  the dependency arrow stays clean (engine never touches the DOM).
//
//  Two callers share this single implementation:
//    • useExport()  — the ExportMenu's own click path (no bus).
//    • SiteRenderer's `data:export` command handler — the bus-dispatched path
//      the panel shells + section header use via PanelExport / the export menu.
//
//  Neither reimplements CSV/xlsx: both serialize through the registry format's
//  SerializeFn. A new format (registerExport) downloads with zero edits here.
//

import { getExportFormat } from '@statdash/engine'
import type { DataRow, ExportMeta, EngineRow, ExportFormatId } from '@statdash/engine'

/**
 * Slugify a filename stem for the `download` attribute.
 * Keeps unicode letters/digits (so a Georgian title stays legible), lower-cases,
 * and collapses every other run to a single hyphen. Empty result → 'export'.
 * `mshp` → `mshp`; `GDP by region` → `gdp-by-region`.
 */
export function slugifyFilename(stem: string): string {
  const s = stem
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  return s || 'export'
}

/**
 * Build the download filename: slugified stem (meta.filename ?? meta.title)
 * + the format extension. The stem is the panel/section identity the shell
 * supplies (typically the node id, e.g. `mshp`).
 */
export function exportFilename(meta: ExportMeta, ext: string): string {
  return `${slugifyFilename(meta.filename ?? meta.title ?? 'export')}.${ext}`
}

/**
 * Serialize `rows` through the registered `format` and trigger a browser
 * download. Returns `false` (no-op) when the format is unregistered, so callers
 * can branch without throwing. Empty `rows` are handled gracefully — the
 * registry serializers are empty-safe (csv → header-less empty string, xlsx →
 * a valid empty workbook), so this never crashes on an empty panel.
 *
 * SerializeFn returns `string` (csv/sdmx-json) OR `Uint8Array` (xlsx/binary).
 * A text payload gets a UTF-8 BOM prepended when the format declares `bom`
 * (so Excel opens Georgian CSV correctly); a Uint8Array is passed through as a
 * raw BlobPart so its bytes are NOT UTF-8 re-encoded (which would corrupt the
 * OOXML zip container).
 */
export function downloadExport(
  format: ExportFormatId,
  rows:   DataRow[],
  meta:   ExportMeta = {},
): boolean {
  const fmt = getExportFormat(format)
  if (!fmt) return false

  // UTF-8 byte-order mark (U+FEFF) — kept as an explicit escape, never an
  // invisible literal, so the source stays greppable and leak-guard-clean.
  const UTF8_BOM = '\uFEFF'
  const content = fmt.serialize(rows as unknown as EngineRow[], meta)
  const parts: BlobPart[] =
    typeof content === 'string'
      ? (fmt.bom ? [UTF8_BOM, content] : [content])
      : [new Uint8Array(content)]

  const blob = new Blob(parts, { type: fmt.mime })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = exportFilename(meta, fmt.ext)
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return true
}
