// ── cubeEnumOptions — resolve enum-ref options from a cube profile (C3) ──────
//
//  PURE resolvers for the cube-backed PropFieldSource discriminants:
//    'cube.measures'    → the dataset's measure codes (label = resolved label)
//    'cube.dimensions'  → the dataset's dimension codes
//    'cube.members'     → the members of ONE dimension (which dim is contextual)
//
//  These are the data-bound half of EnumRefField's ENUM_REF_SOURCES: a
//  data-bound field offers REAL measures/dims/members from the active dataset's
//  profile, so the author PICKS rather than types a raw code (Law 2 declarative
//  authoring — the user never hand-writes 'GDP_SVC').
//
//  Kept pure (profile in → options out) and OFF the network/store so it is
//  trivially testable (the suggestPanels-class fitness). The live wiring
//  (active dataset → profile fetch → these resolvers) is the EnumRefField's
//  job; this module only maps a profile to options.
//
//  Locale: labels are LocaleString records on the wire; readLabel resolves to
//  the active locale, falling back to en → any → the code (never blank).
//
import type { CubeProfile, CubeLocaleString } from '../lib/cubeApi'
import type { Locale } from '../types/constructor'

/** One resolved option for a select control. */
export interface CubeOption {
  value: string
  label: string
}

/** Resolve a wire LocaleString to a display string for `locale` (never blank). */
export function readCubeLabel(
  label: CubeLocaleString | null | undefined,
  locale: Locale,
  fallback: string,
): string {
  if (!label) return fallback
  return label[locale] ?? label['en'] ?? Object.values(label)[0] ?? fallback
}

/** Measure-code options from the profile. */
export function measureOptions(profile: CubeProfile, locale: Locale): CubeOption[] {
  return (profile.measures ?? []).map((m) => ({
    value: m.code,
    label: readCubeLabel(m.label, locale, m.code),
  }))
}

/**
 * Dimension-code options from the profile. The label is the dimension code
 * itself (dimensions carry no LocaleString label on the profile bundle); the
 * conceptRole is appended as a hint when present (e.g. "region (geo)").
 */
export function dimensionOptions(profile: CubeProfile): CubeOption[] {
  return (profile.dimensions ?? []).map((d) => ({
    value: d.code,
    label: d.conceptRole ? `${d.code} (${d.conceptRole})` : d.code,
  }))
}

/**
 * Member-code options for ONE dimension of the profile. `dimensionCode` selects
 * the axis (the contextual binding — e.g. a 'cube.members' field is scoped to a
 * sibling 'cube.dimensions' selection). Unknown dimension ⇒ [] (fail-soft).
 */
export function memberOptions(
  profile: CubeProfile,
  dimensionCode: string,
  locale: Locale,
): CubeOption[] {
  const dim = (profile.dimensions ?? []).find((d) => d.code === dimensionCode)
  if (!dim) return []
  return dim.members.map((m) => ({
    value: m.code,
    label: readCubeLabel(m.label, locale, m.code),
  }))
}

/** The cube-backed PropFieldSource discriminants this module resolves. */
export const CUBE_SOURCES = ['cube.measures', 'cube.dimensions', 'cube.members'] as const
export type CubeSource = typeof CUBE_SOURCES[number]

/** True when a PropFieldSource string is one this module resolves. */
export function isCubeSource(source: string | undefined): source is CubeSource {
  return source === 'cube.measures' || source === 'cube.dimensions' || source === 'cube.members'
}
