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
 * Dimension-code options from the profile. The label resolves to the GOVERNED
 * bilingual dimension label when the semantic catalog governs this code
 * (`resolveGovernedLabel`, Law 4 i18n); otherwise it falls back to the bare
 * dimension code (never blank). The raw SDMX `conceptRole` is deliberately NOT
 * echoed to the author — it is a plumbing token (AR-52: no plumbing surfaced to
 * authors), and "measure (measure)" / "time (time)" is pure noise. Law 1: every
 * dimension resolves through the SAME generic path, none is special-cased.
 */
export function dimensionOptions(
  profile: CubeProfile,
  resolveGovernedLabel?: (code: string) => string | undefined,
): CubeOption[] {
  return (profile.dimensions ?? []).map((d) => ({
    value: d.code,
    label: resolveGovernedLabel?.(d.code) ?? d.code,
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
