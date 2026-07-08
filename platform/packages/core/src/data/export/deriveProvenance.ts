// ── deriveExportProvenance — the ONE join point [AR-48 P1] ────────────────────
//
//  Derives an artifact's minimal citation provenance from the store's
//  MetadataPort, keyed by the underlying code(s) a panel's DataSpec touches.
//  Reuses `extractRequirements` — the SAME static-analysis seam `warm.ts`
//  already uses to prefetch every DataSpec type (query/timeseries/growth/
//  ratio-list/pivot/row-list/transform) — so this is NOT a second code-
//  extraction mechanism invented per spec type; it is the existing one, read
//  for a different purpose (DRY, GRASP information-expert: the seam that
//  already knows "which codes does this spec touch" answers this too).
//
//  Called from BOTH facets that need a provenance join, symmetrically:
//    EXTRACT  — react's PanelExport wrapper (a panel's DataSpec + resolved store)
//    SNAPSHOT — react's renderPageToJSON walkNode (the SAME per-node DataSpec +
//               resolved store, already in hand mid-walk)
//  Neither caller performs a SECOND resolution — `store.metadata.provenance()`
//  is a synchronous, already-warm registry lookup (the runtime MetadataPort is
//  installed once at boot via `withMetricProvenance`), not a network call.
//
//  Degrades gracefully (Postel): undefined when the store has no MetadataPort,
//  the spec yields no requirements, or no requirement's code carries a report.
//  NEVER throws, NEVER blocks the export/snapshot — a citation without
//  provenance is still a valid citation.

import { extractRequirements } from '../spec'
import type { DataSpec }       from '../../config/data-spec'
import type { SectionContext } from '../../core/context'
import type { DataStore }      from '../store'
import type { ExportProvenance } from './types'

export function deriveExportProvenance(
  spec:  DataSpec,
  ctx:   SectionContext,
  store: DataStore,
): ExportProvenance | undefined {
  const metadata = store.metadata
  if (!metadata) return undefined

  let codes: string[]
  try {
    codes = [...new Set(extractRequirements(spec, ctx).map((r) => r.code))]
  } catch {
    // Static analysis is best-effort — an unresolvable spec yields no provenance,
    // never a thrown export.
    return undefined
  }

  for (const code of codes) {
    const record = metadata.provenance(code, ctx)
    if (record && (record.source || record.lastUpdated || record.methodology)) {
      const provenance: ExportProvenance = {}
      if (record.source)      provenance.source         = record.source
      if (record.lastUpdated) provenance.lastUpdated    = record.lastUpdated
      if (record.methodology) provenance.methodologyUrl = record.methodology
      return provenance
    }
  }
  return undefined
}
