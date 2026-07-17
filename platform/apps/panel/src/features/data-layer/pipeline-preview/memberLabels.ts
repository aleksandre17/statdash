// ── memberLabels — governed MEMBER labels for the live grid CELLS (SPEC §3.2/§3.4) ─
//
//  W-P3 (ADR-046). The grid's HEADERS already speak governed nouns (columnLabels.ts);
//  this is the peer resolver for the grid's CELLS: a dimension member CODE (e.g. a
//  region code `adjara`, a sector code `AGRI`) resolves to its GOVERNED member label
//  (`აჭარა`, the sector's label) in the author plane, so no raw SDMX code leaks
//  (FF-AUTHOR-NO-QUERY, Law 4). The member labels live on the cube profile's codelists
//  (`CubeProfile.dimensions[].members[]` — Law 5: members resolve FROM the DSD), the
//  SAME profile every data-bound picker reads (`useActiveProfile`).
//
//  Honest fallback (Law 11): a member the profile has no label for renders as its raw
//  code — never a fabricated label. The one exception is the SDMX TOTAL sentinel `_T`,
//  a STANDARD code with a canonical governed meaning ("Total") — rendering it as such
//  is adopting the SDMX standard whole (Law 4), not inventing a label.
//
import type { DimVal } from '@statdash/engine'
import type { CubeProfile } from '../../../lib/cubeApi'
import { readCubeLabel } from '../../../discovery/cubeEnumOptions'
import type { Locale } from '../../../types/constructor'

/** The SDMX "total / all members" sentinel — a standard code, not a data value. */
export const SDMX_TOTAL = '_T'

function totalLabel(locale: Locale): string {
  return locale === 'en' ? 'Total' : 'სულ'
}

/** Resolve a cell's raw value to its governed display value. A dimension member code
 *  becomes its governed member label; everything else (numbers, derived fields, the
 *  value column, null/no-data) passes through UNCHANGED. */
export interface MemberLabelResolver {
  (field: string, value: DimVal | null | undefined): DimVal | null | undefined
}

/**
 * Build a `(field, value) → governed member label` resolver from the cube profile for
 * `locale`. Keyed by dimension CODE (the column field name IS the SDMX dim key, Law 1
 * generic — no dimension is special-cased). A value under a known dimension resolves
 * through that dimension's codelist; an unknown dimension / non-member value passes
 * through (honest raw fallback); `_T` under any dimension renders as the governed Total.
 */
export function buildMemberLabels(profile: CubeProfile, locale: Locale): MemberLabelResolver {
  const byDim = new Map<string, Map<string, string>>()
  for (const dim of profile.dimensions ?? []) {
    const members = new Map<string, string>()
    for (const m of dim.members ?? []) members.set(m.code, readCubeLabel(m.label, locale, m.code))
    byDim.set(dim.code, members)
  }

  return (field, value) => {
    if (typeof value !== 'string' || value === '') return value
    const members = byDim.get(field)
    if (members) {
      const label = members.get(value)
      if (label !== undefined) return label
    }
    // The SDMX total sentinel resolves to its standard governed meaning even when the
    // profile's codelist does not enumerate it explicitly.
    if (value === SDMX_TOTAL) return totalLabel(locale)
    // Honest fallback — the true code, never a fabricated label.
    return value
  }
}

/** The identity resolver — the steward plane (raw SDMX codes) and the not-yet-ready
 *  catalog both use this: cells pass through verbatim. */
export const rawMemberLabels: MemberLabelResolver = (_field, value) => value
