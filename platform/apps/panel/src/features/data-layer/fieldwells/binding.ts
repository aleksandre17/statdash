// ── binding — the pure chip→config write (V5 field-wells, byte-identical) ─────
//
//  The HEART of the field-wells invariant: dropping (or picking + clicking) a
//  field chip onto a well writes the EXACT SAME config the typed editor would.
//  Drag and the keyboard/click path BOTH funnel through these pure functions, so
//  there is one write per well and the two input paths are provably identical.
//
//  The wells and the config they target:
//    'measure'        → ObsQuery.measure  (MeasureSelector's chip array — append)
//    'value' | 'label' | 'series' | 'color'
//                     → EncodingSpec[channel]  (EncodingEditor's field name)
//
//  Byte-identical rule (asserted in binding.test.ts):
//   • a measure chip → ObsQuery.measure === the array MeasureSelector emits
//     (codes appended, deduped — same string[] shape).
//   • a chip → an encoding channel === the BARE STRING the EncodingEditor writes
//     (`enc[channel] = code`). We deliberately write the bare-string form (not a
//     ChannelDef), because that is what the typed editor produces — the chip's
//     measurement `type` is the renderer's default for that field, so a bare
//     string is byte-identical AND already carries the right type via
//     default-derivation (R2). Gold-plating a ChannelDef here would DIVERGE the
//     output from the typed editor, breaking the invariant.
//
import type { EncodingSpec, ObsQuery } from '@statdash/engine'
import type { FieldChip, FieldKind } from './fieldChips'

/** The encoding channels the field-wells expose (the core, per the YAGNI bound). */
export type EncodingWell = 'value' | 'label' | 'series' | 'color'

/** Every drop well in the field-wells surface. */
export type WellId = 'measure' | EncodingWell

/** The well kinds, as a const list (capability enumeration for tests/UI). */
export const ENCODING_WELLS: readonly EncodingWell[] = ['value', 'label', 'series', 'color']
export const ALL_WELLS:      readonly WellId[]       = ['measure', ...ENCODING_WELLS]

/**
 * Which field kind a well accepts. Measures → the value/measure well; a
 * dimension → label/series/color. Matches the Looker/Tableau shelf rules and
 * keeps an author from binding a category where a quantity belongs (POLA).
 * `measure` and `value` take a measure; the categorical channels take a
 * dimension. Returns true when the chip is a valid drop for the well.
 */
export function wellAccepts(well: WellId, kind: FieldKind): boolean {
  if (well === 'measure' || well === 'value') return kind === 'measure'
  return kind === 'dimension' // label / series / color
}

// ── ObsQuery.measure write ─────────────────────────────────────────────────────

/** Normalize ObsQuery.measure (string | string[] | undefined) to a code array. */
export function readMeasures(measure: ObsQuery['measure']): string[] {
  return Array.isArray(measure) ? measure : measure ? [measure] : []
}

/**
 * Append a measure chip's code to ObsQuery.measure, deduped. Returns the SAME
 * string[] shape MeasureSelector emits (it sets `measure: codes`), so the
 * config is byte-identical to typing the code into the measure chip input.
 */
export function bindMeasure(query: ObsQuery, chip: FieldChip): ObsQuery {
  const codes = readMeasures(query.measure)
  if (codes.includes(chip.code)) return query // idempotent — no duplicate
  return { ...query, measure: [...codes, chip.code] }
}

// ── EncodingSpec channel write ─────────────────────────────────────────────────

/**
 * Bind a chip's code into an encoding channel as the BARE STRING the
 * EncodingEditor writes (`enc[channel] = code`). Byte-identical to the typed
 * editor: no ChannelDef wrapping (that would diverge from the editor's output).
 * `label` is required in EncodingSpec, so binding label sets it directly; the
 * optional channels are set to the bare code.
 */
export function bindEncoding(
  enc: EncodingSpec | undefined,
  channel: EncodingWell,
  chip: FieldChip,
): EncodingSpec {
  const base: EncodingSpec = enc ?? { label: '' }
  return { ...base, [channel]: chip.code }
}
