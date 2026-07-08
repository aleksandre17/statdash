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
//  AR-48 P0: the actual serialize+Blob+download logic now lives in
//  delivery/DeliveryPort.ts's `extractFromSnapshot` — the EXTRACT facet over the
//  `ViewSnapshot` SSOT. This function is an UNCHANGED public seam (same
//  signature, byte-identical output — see downloadExport.test.ts) that wraps its
//  `rows` into a `ViewSnapshot` (a pure, zero-I/O wrap — no second data read)
//  before delegating. Callers are unaffected.
//

import { viewSnapshotFromRows, extractFromSnapshot } from './delivery/DeliveryPort'
import type { DataRow, ExportMeta, ExportFormatId } from '@statdash/engine'

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
 * OOXML zip container). See delivery/DeliveryPort.ts for the implementation.
 */
export function downloadExport(
  format: ExportFormatId,
  rows:   DataRow[],
  meta:   ExportMeta = {},
): boolean {
  // A pure, zero-I/O wrap of the ALREADY-resolved `rows` — no second read, no
  // re-`interpretSpec` (FF-DELIVERY-ONE-SSOT). The extract facet then reads
  // exclusively from `snapshot.data`, never from `rows` directly.
  const snapshot = viewSnapshotFromRows(rows, meta)
  return extractFromSnapshot(snapshot, format, meta, exportFilename)
}
