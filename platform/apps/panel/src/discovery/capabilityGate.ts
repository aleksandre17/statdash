// ── capabilityGate — capability-gated palette (C3) ───────────────────────────
//
//  PURE filter: given the palette entries (from the open node registry) and the
//  active dataset's profile, return only the entries the dataset can actually
//  support. This is the "capability-gated palette" rule (skill §12 capability
//  discovery): the Constructor offers only what the active dataset's profile
//  supports for data-bound panels — never a chart on a dataset with no measures.
//
//  The gating rule (conservative — Postel: only gate what we can PROVE is
//  unsupported):
//    - A NON data-bound entry (no 'data' cap and not chart/kpi) → always kept
//      (layout/content panels need no dataset).
//    - A data-bound entry (declares CAPS.DATA, or chart/kpi caps) → kept ONLY
//      when the profile is ready AND has ≥1 measure (you cannot render a metric
//      with no measure). Geo panels additionally need a geo-role dimension.
//    - When NO profile is available (no dataset bound / loading / error) → the
//      gate is OPEN (all entries kept). Gating is an ENHANCEMENT, never a
//      blocker: an unavailable profile must not empty the palette (graceful
//      degradation — verify-gate).
//
//  Law 1: data-binding capability is read from declared caps + concept roles,
//  never from a hardcoded panel-type list (a new data panel that declares 'data'
//  is gated automatically; a new layout type that doesn't is not).
//
import type { CubeProfile } from '../lib/cubeApi'
import type { PaletteEntry } from '../canvas/paletteEntries'
import type { ActiveProfile } from './useActiveProfile'

// Caps that mark an entry as DATA-BOUND (needs a dataset to render anything).
const DATA_CAPS = new Set(['data', 'chart', 'kpi', 'filterable'])

const GEO_ROLE = 'geo'

/** True when an entry declares any data-binding capability. */
export function isDataBound(entry: PaletteEntry): boolean {
  return entry.caps.some((c) => DATA_CAPS.has(c))
}

/** True when an entry is (heuristically) a geo/map panel needing a geo axis. */
function needsGeo(entry: PaletteEntry): boolean {
  return entry.type === 'map' || entry.type.includes('geo') || entry.caps.includes('map')
}

/** True when a ready profile can support a given data-bound entry. */
function profileSupports(entry: PaletteEntry, profile: CubeProfile): boolean {
  const hasMeasure = (profile.measures ?? []).length > 0
  if (!hasMeasure) return false
  if (needsGeo(entry)) {
    return (profile.dimensions ?? []).some((d) => d.conceptRole === GEO_ROLE)
  }
  return true
}

/**
 * Gate palette entries against the active profile. Pure + total. When no ready
 * profile is available the gate is OPEN (returns the input list) — gating only
 * removes entries it can PROVE the dataset cannot support.
 */
export function gatePaletteEntries(
  entries: PaletteEntry[],
  active: ActiveProfile,
): PaletteEntry[] {
  // Gate open unless we have a ready profile to gate against.
  if (active.status !== 'ready') return entries
  const profile = active.profile

  return entries.filter((entry) => {
    if (!isDataBound(entry)) return true            // layout/content: never gated
    return profileSupports(entry, profile)           // data panel: must be supported
  })
}
