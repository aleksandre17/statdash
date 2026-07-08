// ── DeliveryPort — the ViewSnapshot facade [AR-48 P0] ─────────────────────────
//
//  Names the ONE substrate (`ViewSnapshot`, @statdash/contracts) the delivery
//  facets — extract · embed · permalink — compose over
//  (DESIGN-delivery-port-export-embed-snapshot.md §2). This module wires the
//  two ALREADY-EXISTING "what is on screen?" reads onto that one shape, with NO
//  new resolution and NO behaviour change:
//
//    EXTRACT  — a section/panel already resolved its rows ONCE (ctx.rows,
//               published via NodeExportContext / read by SectionExportMenu).
//               `viewSnapshotFromRows` wraps that single, already-resolved read
//               into the SSOT shape. It does NOT call `interpretSpec` again.
//    SNAPSHOT/EMBED — `renderPageToJSON` already walks + resolves the whole
//               page ONCE (targets/api.ts). `viewSnapshotFromPageSnapshot`
//               projects that result into the SAME SSOT shape. It does NOT
//               re-resolve either.
//
//  `downloadExport` (the extract facet's browser-download trigger) is refactored
//  to ROUTE THROUGH this facade internally (`extractFromSnapshot`) — its public
//  signature and every byte it produces are UNCHANGED (see downloadExport.test.ts);
//  only the internal plumbing now names the substrate it operates on.
//
//  The (P2) mint client will call `viewSnapshotFromPageSnapshot` and POST the
//  result — a `ViewSnapshot` is structurally a `SnapshotEnvelope`
//  (`generatedAt: string` + every other field a subtype of `unknown`), so no
//  adapter is needed at that boundary either. Building that POST call is P2's
//  job (wiring the embed loop to the client); this module only names and proves
//  the substrate it will carry.
//
//  See delivery.fitness.test.ts (FF-DELIVERY-ONE-SSOT) for the grep-guard +
//  unit proof that neither constructor performs a second data read.

import type { ViewSnapshot } from '@statdash/contracts'
import { getExportFormat }   from '@statdash/engine'
import type { DataRow, ExportMeta, EngineRow, ExportFormatId } from '@statdash/engine'
import type { PageDataSnapshot } from '../targets/api'

// ── EXTRACT facet — wrap an already-resolved rows read ────────────────────────

/**
 * Wrap the live extract path's already-resolved rows (the section/panel's
 * `ctx.rows`, the SAME slice on screen) into the `ViewSnapshot` SSOT.
 *
 * Deliberately minimal `viewState`: the call site (a per-panel/-section rows
 * read) does not carry the full page's filter/locale/perspective state, and
 * Postel's Law says an honest partial substrate beats fabricating fields the
 * caller does not have. The full-page SNAPSHOT/EMBED build below populates
 * `viewState` completely — both are valid `ViewSnapshot`s over the same
 * optional-field shape (DESIGN §2's "one substrate", not "one required shape").
 */
export function viewSnapshotFromRows(
  rows: DataRow[],
  meta: ExportMeta,
): ViewSnapshot {
  return {
    configRef:   { pageId: meta.filename ?? meta.title },
    viewState:   {},
    data:        rows as unknown as ViewSnapshot['data'],
    generatedAt: new Date().toISOString(),
  }
}

/**
 * Extract facet: serialize `snapshot.data` through the registered `format` and
 * trigger a browser download. This is the EXACT logic `downloadExport` always
 * ran — moved here so the extract facet is named and provably reads from the
 * `ViewSnapshot`, not from a second data source. Returns `false` (no-op) for an
 * unregistered format, mirroring the prior `downloadExport` contract.
 *
 * `filenameFor` is injected (not imported) to avoid a circular module edge with
 * downloadExport.ts, which keeps owning the filename-slug helpers callers use
 * directly (`slugifyFilename` / `exportFilename` stay public there, unchanged).
 */
export function extractFromSnapshot(
  snapshot:    ViewSnapshot,
  format:      ExportFormatId,
  meta:        ExportMeta,
  filenameFor: (meta: ExportMeta, ext: string) => string,
): boolean {
  const fmt = getExportFormat(format)
  if (!fmt) return false

  const rows = (snapshot.data ?? []) as unknown as DataRow[]

  // UTF-8 byte-order mark (U+FEFF) — kept as an explicit escape, never an
  // invisible literal, so the source stays greppable and leak-guard-clean.
  const UTF8_BOM = String.fromCharCode(0xfeff)
  const content = fmt.serialize(rows as unknown as EngineRow[], meta)
  const parts: BlobPart[] =
    typeof content === 'string'
      ? (fmt.bom ? [UTF8_BOM, content] : [content])
      : [new Uint8Array(content)]

  const blob = new Blob(parts, { type: fmt.mime })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filenameFor(meta, fmt.ext)
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return true
}

// ── SNAPSHOT/EMBED facet — project renderPageToJSON's output ──────────────────

/**
 * Project a `renderPageToJSON` result into the `ViewSnapshot` SSOT — the
 * snapshot/embed facet's constructor. Performs NO re-resolution: every field
 * is read off the already-produced `PageDataSnapshot`.
 */
export function viewSnapshotFromPageSnapshot(pageSnapshot: PageDataSnapshot): ViewSnapshot {
  return {
    configRef: {
      pageId:        pageSnapshot.pageId,
      schemaVersion: pageSnapshot.schemaVersion,
    },
    viewState: {
      filterParams:   pageSnapshot.filterParams,
      perspective:    pageSnapshot.sectionCtx.perspectiveState,
      locale:         pageSnapshot.locale,
      fallbackLocale: pageSnapshot.fallbackLocale,
    },
    data:        pageSnapshot.nodes as unknown as ViewSnapshot['data'],
    generatedAt: pageSnapshot.generatedAt,
  }
}
