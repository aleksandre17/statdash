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
//      with no measure). An entry that DECLARES a data requirement (e.g. a map
//      declaring `requires.conceptRole`) additionally needs a dimension carrying
//      that DECLARED concept role.
//    - When NO profile is available (no dataset bound / loading / error) → the
//      gate is OPEN (all entries kept). Gating is an ENHANCEMENT, never a
//      blocker: an unavailable profile must not empty the palette (graceful
//      degradation — verify-gate).
//
//  Law 1 (no privileged dimensions): the gate decides from DECLARED fields only —
//  the entry's `caps` (data-binding) and its DECLARED `requires.conceptRole` (the
//  role prerequisite). It NEVER sniffs a node type (`type === 'map'`) or hardcodes a
//  dimension name. The required role is matched generically against each dimension's
//  DECLARED `conceptRole` (an SDMX concept role on the DATA, not the dimension code),
//  so a second tenant declaring a different geo role passes the same gate zero-code.
//
import type { CubeProfile } from '../lib/cubeApi'
import type { PaletteEntry } from '../canvas/paletteEntries'
import type { ActiveProfile } from './useActiveProfile'

// Caps that mark an entry as DATA-BOUND (needs a dataset to render anything).
const DATA_CAPS = new Set(['data', 'chart', 'kpi', 'filterable'])

/** True when an entry declares any data-binding capability. */
export function isDataBound(entry: PaletteEntry): boolean {
  return entry.caps.some((c) => DATA_CAPS.has(c))
}

/** True when a ready profile can support a given data-bound entry. */
function profileSupports(entry: PaletteEntry, profile: CubeProfile): boolean {
  const hasMeasure = (profile.measures ?? []).length > 0
  if (!hasMeasure) return false
  // DECLARED concept-role prerequisite (Law 1) — an entry that declares
  // `requires.conceptRole` is kept only when some profile dimension carries that
  // exact DECLARED role. Absent ⇒ no role prerequisite. Zero node-type sniff.
  const requiredRole = entry.requires?.conceptRole
  if (requiredRole != null) {
    return (profile.dimensions ?? []).some((d) => d.conceptRole === requiredRole)
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
