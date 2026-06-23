// ── suggestPanels — "suggest the chart" from a cube profile (C3) ─────────────
//
//  A PURE function: profile (the dataset's introspected shape) → a ranked list
//  of recommended panel types. The Constructor surfaces these as "recommended
//  panels" so an author starts from a fit-for-the-data chart, not a blank
//  palette. Modelled on the engine's suggestedEncodings (P3-2): read the
//  semantic role of each axis, map role → visual.
//
//  The mapping (conceptRole / isTime → panel type):
//    isTime axis present                 → 'timeseries' (line over time)
//    a geo-role dimension present        → 'map'        (choropleth)
//    a hierarchical (parented) dimension → 'tree' then 'bar' (drill / compare)
//    ≥1 measure (always, as a baseline)  → 'kpi-strip'  (headline metric)
//    ≥1 measure + ≥1 non-time dimension  → 'bar'        (measure across a dim)
//
//  Soundness (the fitness invariant): geo→map, isTime→timeseries. The result is
//  ORDERED by specificity (most data-specific suggestion first) and DEDUPED by
//  panel type. Each suggestion carries the `reason` (which axis drove it) so the
//  UI can explain the recommendation (Principle of Least Astonishment).
//
//  Law 1 (no privileged dims): roles are read GENERICALLY from conceptRole /
//  isTime / parentCode — never by hardcoded dimension code ('geo', 'time').
//  The geo discriminant is the SDMX concept role 'geo' (a declared role on the
//  dimension), not a dimension whose code happens to be "geo".
//
import type { CubeProfile, CubeProfileDimension } from '../lib/cubeApi'

/** One recommended panel, with the data feature that justifies it. */
export interface PanelSuggestion {
  /** The registry node type to add (e.g. 'timeseries', 'map', 'bar'). */
  panelType: string
  /** Machine reason token — which profile feature drove this suggestion. */
  reason:    'time-axis' | 'geo-role' | 'hierarchy' | 'measure' | 'measure-by-dim'
  /** The dimension/measure code that triggered it (for the UI explanation). */
  basis:     string
}

// SDMX concept role that marks a geographic dimension. A role is a DECLARED
// semantic on the dimension (Law 1) — not the dimension's code.
const GEO_ROLE = 'geo'

/** True when a dimension's codelist declares any parent edge (a hierarchy). */
function isHierarchical(dim: CubeProfileDimension): boolean {
  return dim.members.some((m) => m.parentCode != null)
}

/**
 * Suggest panel types for a dataset profile, most data-specific first, deduped
 * by panelType. Pure + total: an empty/degenerate profile yields [] (or just
 * the measure baseline) — never throws.
 */
export function suggestPanels(profile: CubeProfile): PanelSuggestion[] {
  const out: PanelSuggestion[] = []
  const seen = new Set<string>()

  const push = (s: PanelSuggestion) => {
    if (seen.has(s.panelType)) return
    seen.add(s.panelType)
    out.push(s)
  }

  const dims     = profile.dimensions ?? []
  const measures = profile.measures ?? []

  // 1. Time axis → timeseries (the strongest, most specific signal).
  const timeDim = dims.find((d) => d.isTime)
  if (timeDim) push({ panelType: 'timeseries', reason: 'time-axis', basis: timeDim.code })

  // 2. Geo concept role → map.
  const geoDim = dims.find((d) => d.conceptRole === GEO_ROLE)
  if (geoDim) push({ panelType: 'map', reason: 'geo-role', basis: geoDim.code })

  // 3. Hierarchical (parented) non-time dimension → tree (drill-down).
  const hierDim = dims.find((d) => !d.isTime && isHierarchical(d))
  if (hierDim) push({ panelType: 'tree', reason: 'hierarchy', basis: hierDim.code })

  // 4. A measure across a non-time, non-geo dimension → bar (compare).
  const barDim = dims.find((d) => !d.isTime && d.conceptRole !== GEO_ROLE)
  if (measures.length > 0 && barDim) {
    push({ panelType: 'bar', reason: 'measure-by-dim', basis: barDim.code })
  }

  // 5. Baseline: any measure → a KPI headline strip (last; least specific).
  if (measures.length > 0) {
    push({ panelType: 'kpi-strip', reason: 'measure', basis: measures[0].code })
  }

  return out
}
