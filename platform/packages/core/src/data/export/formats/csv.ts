// ── CSV serializer [N16] ──────────────────────────────────────────────
//
//  RFC 4180 compliant CSV.
//  Header row: field labels (falls back to field names).
//  Data rows: one EngineRow per line; values coerced to string.
//

import type { EngineRow } from '../../encoding'
import type { ExportMeta } from '../types'
import { provenanceLines } from '../provenanceFooter'

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  // Quote if contains comma, double-quote, newline, or carriage-return
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function serializeCsv(rows: EngineRow[], meta: ExportMeta): string {
  if (rows.length === 0) return ''

  const fields = meta.fields ?? Object.keys(rows[0])
  const labels = meta.labels ?? {}

  const header = fields.map(f => csvCell(labels[f] ?? f)).join(',')
  const body   = rows.map(row =>
    fields.map(f => csvCell(row[f])).join(',')
  ).join('\r\n')

  const table = `${header}\r\n${body}`

  // AR-48 P1 — citation footer (Eurostat/OWID convention: trailing metadata
  // block, one blank line below the data table). Absent `meta.provenance` ⇒
  // byte-identical to the pre-P1 output (regression-safe).
  const footer = provenanceLines(meta.provenance)
  if (footer.length === 0) return table

  const footerBlock = footer.map(({ label, value }) => csvCell(`${label}: ${value}`)).join('\r\n')
  return `${table}\r\n\r\n${footerBlock}`
}
