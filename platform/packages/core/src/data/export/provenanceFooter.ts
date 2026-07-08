// ── provenanceFooter — pure citation-provenance formatting [AR-48 P1] ─────────
//
//  Pure, DOM-free rendering of `ExportProvenance` into human-readable lines. Both
//  csv.ts (a trailing comment block) and xlsx.ts (a "Metadata" sheet) consume the
//  SAME line set, so the two formats never drift on which fields they surface or
//  in what order (DRY — Law 9's "every artifact carries its provenance" is one
//  formatting decision, not two).
//
//  Order matters for citation readability (Eurostat/OWID convention): source
//  first (who), then lastUpdated (when), methodology (how), permalink (where),
//  accessedAt (the reproducibility stamp) last.

import type { ExportProvenance } from './types'

/** One provenance line as a [label, value] pair — the row-shape both formats render. */
export interface ProvenanceLine {
  label: string
  value: string
}

/**
 * Project an `ExportProvenance` into orderable [label, value] lines. Returns an
 * EMPTY array for `undefined` or an all-empty provenance (Postel — nothing to
 * degrade to, callers skip the footer/sheet entirely rather than emit an empty one).
 */
export function provenanceLines(provenance: ExportProvenance | undefined): ProvenanceLine[] {
  if (!provenance) return []
  const lines: ProvenanceLine[] = []
  if (provenance.source)         lines.push({ label: 'Source',      value: provenance.source })
  if (provenance.lastUpdated)    lines.push({ label: 'Last updated', value: provenance.lastUpdated })
  if (provenance.methodologyUrl) lines.push({ label: 'Methodology', value: provenance.methodologyUrl })
  if (provenance.permalink)      lines.push({ label: 'Permalink',   value: provenance.permalink })
  if (provenance.accessedAt)     lines.push({ label: 'Accessed',    value: provenance.accessedAt })
  return lines
}
