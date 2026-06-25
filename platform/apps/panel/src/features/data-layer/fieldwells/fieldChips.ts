// ── fieldChips — cube profile → draggable field chips (V5 field-wells) ────────
//
//  PURE: a cube profile → the flat list of FIELD CHIPS the palette renders. A
//  chip is one bindable thing from the active dataset — a MEASURE or a DIMENSION
//  — carried by the author from the palette into a binding well (Looker/Tableau
//  field-list pattern). Reuses the existing cube-profile resolvers
//  (measureOptions / dimensionOptions) so the chip labels are byte-identical to
//  what the typed editors already show; this module only adds the drag-relevant
//  metadata (the field KIND + its Vega-Lite measurement TYPE).
//
//  Law 1 (no privileged dims): a dimension's role is read from conceptRole /
//  isTime GENERICALLY — never by a hardcoded dimension code. The measurement
//  `type` rides from the field (R2 ChannelDef) via the engine's
//  deriveMeasurementType (the SAME default the renderer derives), so a chip
//  dropped on a channel can carry its type without the author typing anything.
//
//  Law 2 (pick-don't-type): every chip `code` comes from the profile — the
//  author drags a real measure/dimension, never hand-writes a code.
//
import { deriveMeasurementType, type MeasurementType } from '@statdash/engine'
import type { CubeProfile } from '../../../lib/cubeApi'
import type { Locale } from '../../../types/constructor'
import { measureOptions, dimensionOptions } from '../../../discovery/cubeEnumOptions'

/** Whether a chip is a measure (quantity) or a dimension (category/axis). */
export type FieldKind = 'measure' | 'dimension'

/** One draggable/pickable field from the active dataset. */
export interface FieldChip {
  /** The real code from the profile (never author-typed). */
  code:  string
  /** Display label (locale-resolved; falls back to the code). */
  label: string
  /** Measure vs dimension — drives which wells accept it. */
  kind:  FieldKind
  /**
   * The field's Vega-Lite measurement type, default-derived from its role
   * (R2 ChannelDef). Rides into a channel binding so a dropped chip can carry
   * `type` — without the author choosing one. Omitted only when it equals the
   * channel default (kept for the dimension-as-nominal case, which is the
   * renderer default, so it is byte-identical when applied as a bare string).
   */
  measurementType: MeasurementType
}

/**
 * Build the palette's chips from a profile: every measure, then every
 * dimension. Measures derive a `quantitative` type; a time dimension derives
 * `temporal`; every other dimension derives `nominal` (the renderer default).
 * Pure + total: an absent/degenerate profile yields [] (the palette shows its
 * empty state, never throws).
 */
export function fieldChips(profile: CubeProfile, locale: Locale): FieldChip[] {
  const measures: FieldChip[] = measureOptions(profile, locale).map((o) => ({
    code:  o.value,
    label: o.label,
    kind:  'measure' as const,
    measurementType: deriveMeasurementType('number', 'measure'),
  }))

  const byCode = new Map((profile.dimensions ?? []).map((d) => [d.code, d]))
  const dimensions: FieldChip[] = dimensionOptions(profile).map((o) => {
    const dim = byCode.get(o.value)
    const fieldType = dim?.isTime ? 'time' : 'string'
    return {
      code:  o.value,
      label: o.label,
      kind:  'dimension' as const,
      measurementType: deriveMeasurementType(fieldType, 'dimension'),
    }
  })

  return [...measures, ...dimensions]
}
