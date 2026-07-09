// ── metricDraft — pure helpers for authoring a ManifestMetric (M2.2) ───────────
//
//  The "pick, never type" discipline (Law 2) extended to metric DEFINITION: a
//  Steward picks a real SDMX measure from a live cube profile and these pure
//  functions seed the governed ManifestMetric draft (unit pre-fill from the
//  measure's resolved unit; format options from the LIVE formatter registry so a
//  new formatter = a new option with zero code — Law 8). No React, no store, no
//  network — trivially testable.
//
import { FORMATTERS } from '@statdash/engine'
import type { ManifestMetric } from '@statdash/contracts'
import type { CubeProfileMeasure, CubeResolvedUnit } from '../../lib/cubeApi'

/**
 * Valid display-format keys, sourced from the LIVE formatter registry (the SSOT the
 * downstream getFormatter reads). 'default' is the fallback formatter, not an
 * author-pickable governance choice, so it is excluded. Registry-driven ⇒ a new
 * formatter appears here automatically (Law 8 — open for extension, no code change).
 */
export function formatKeyOptions(): string[] {
  return Object.keys(FORMATTERS).filter((k) => k !== 'default').sort()
}

/** SDMX-slug rule for a metric id: lower-snake/kebab alphanumerics, must start with a letter. */
const ID_RE = /^[a-z][a-z0-9_]*$/

/** True when `id` is a legal, immutable registry key (the DataSpec `measure` ref). */
export function isValidMetricId(id: string): boolean {
  return ID_RE.test(id)
}

/**
 * Slugify a free-typed candidate id into the legal shape (lowercase, non-alnum → _,
 * leading digits/underscores trimmed). A convenience for the "new metric" field; the
 * steward can still edit it. Empty-safe (returns '' for an all-illegal input).
 */
export function slugifyMetricId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^[^a-z]+/, '')
    .replace(/_+$/g, '')
}

/**
 * Resolve a measure's RESOLVED unit into a bilingual LocaleString map for the
 * governance form's unit pre-fill. Prefers the resolved label (already bilingual),
 * falling back to the symbol on every active locale. A `source:'none'` unit yields
 * an empty map — the editor then WARNS the steward to supply one (spec §4.1). Pure.
 */
export function unitToLocaleString(
  unit:    CubeResolvedUnit | null | undefined,
  locales: readonly string[],
): Record<string, string> {
  if (!unit || unit.source === 'none') return {}
  if (unit.label && typeof unit.label === 'object') {
    // Fill every active locale so the LocaleField renders a complete record.
    const out: Record<string, string> = {}
    for (const loc of locales) {
      out[loc] = unit.label[loc] ?? unit.label['en'] ?? Object.values(unit.label)[0] ?? (unit.symbol ?? '')
    }
    return out
  }
  if (unit.symbol) {
    const out: Record<string, string> = {}
    for (const loc of locales) out[loc] = unit.symbol
    return out
  }
  return {}
}

/**
 * Seed a NEW ManifestMetric draft from a picked dataset + measure. The id is left
 * for the steward to choose (immutable once created); code + dataSource + unit are
 * DERIVED from the pick (never hand-typed — Law 2 / spec §4.1). label defaults to
 * the measure's own label so the required field is never blank.
 */
export function draftFromMeasure(
  datasetCode: string,
  measure:     CubeProfileMeasure,
  locales:     readonly string[],
): ManifestMetric {
  return {
    id:         '',
    code:       measure.code,
    dataSource: datasetCode,
    label:      { ...measure.label },
    unit:       unitToLocaleString(measure.unit, locales),
  }
}

/** True when the resolved unit could not be pre-filled — the editor warns the steward. */
export function unitNeedsAttention(unit: CubeResolvedUnit | null | undefined): boolean {
  return !unit || unit.source === 'none'
}
