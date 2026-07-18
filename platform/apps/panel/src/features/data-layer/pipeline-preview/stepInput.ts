// ── stepInput — the OFFER model for a pipeline step's editor (P-OFFER · SPEC §3) ──
//
//  The Authoring Canon's P-OFFER principle (owner 2026-07-18): the author never
//  TYPES an identifier — every field / member is PICKED from an offered, governed
//  list; free text only where a name is genuinely new. This pure model is what a
//  step editor (FilterStepForm, SortStepForm, …) consumes to OFFER, rather than ask
//  the author to guess a column key or a member code.
//
//  It is derived from the ONE derivation path (the same rows the live grid renders):
//    • the step's INPUT rows = the OUTPUT of the previous step (deriveStepRows prefix
//      — never a second fetch, FF-ONE-DERIVATION-PATH);
//    • the column set = deriveColumns over those rows (the exact grid columns);
//    • a column's offered VALUES = its ACTUAL distinct members in the input rows,
//      governed-labeled (the same buildColumnLabels / memberLabels seams the grid
//      speaks) — the Excel/Power-Query AutoFilter list, adopted whole (Law 4).
//
//  Pure + framework-free (no React, no store) — trivially testable.
//
import type { DimVal, EngineRow, TransformStep, PipelineContext } from '@statdash/engine'
import { deriveStepRows, deriveColumns, AS_OF_SOURCE } from './pipelinePreview'
import type { ColumnLabelResolver } from './columnLabels'
import type { MemberLabelResolver } from './memberLabels'

/** An offered COLUMN — option value = the field key (what a step writes), option
 *  label = the governed name (what the author reads). `numeric` marks a value-typed
 *  column: the ledgered seam for a future comparator row (=,≠,>,≥,<,≤,between) once
 *  the engine filter grammar carries comparators — today it is equality/IN only
 *  (`FilterValue = DimVal | DimVal[] | CtxRef | NeRef | NeCtxRef`), so every column
 *  is picked by member, the faithful AutoFilter gesture. */
export interface ColumnOffer {
  field:   string
  label:   string
  numeric: boolean
}

/** An offered VALUE — `value` = the RAW member code / number a step writes into its
 *  config (never fabricated); `label` = the governed member label the author reads. */
export interface ValueOffer {
  value: DimVal
  label: string
}

/** The offer a step editor consumes: the input columns + a column's distinct offered
 *  values, all governed-labeled. Absent (`undefined`) at a call site ⇒ the editor
 *  degrades to free text (honest fallback — never a dead control, SPEC §3 / Law 11). */
export interface StepInputOffer {
  columns: ColumnOffer[]
  /** The distinct offered values for a column (governed-labeled, label-sorted). Empty
   *  when the column is unknown or the rows carry no members for it. */
  valuesFor(field: string): ValueOffer[]
  /** Whether a column is value-typed (numeric) — the comparator seam (ledgered). */
  isNumeric(field: string): boolean
}

/** How many distinct values a single column offers before the list is capped (the
 *  AutoFilter search narrows within it — an honest bound, not a silent truncation). */
export const DISTINCT_CAP = 1000

// ── stepInputRows — the INPUT rows to step `stepIndex` (the ONE derivation path) ──
//
//  Each step's input = the previous step's OUTPUT (Power Query's exact model). The
//  prefix-run to `stepIndex - 1` yields exactly that: `stepIndex === 0` derives to
//  AS_OF_SOURCE (the Get browse rows); step `k` derives to the output after step
//  `k-1`. Reuses `deriveStepRows` — no second engine seam, no cache.
export function stepInputRows(
  sourceRows: readonly EngineRow[],
  tail:       readonly TransformStep[],
  stepIndex:  number,
  ctx?:       PipelineContext,
): EngineRow[] {
  return deriveStepRows(sourceRows, tail, stepIndex <= 0 ? AS_OF_SOURCE : stepIndex - 1, ctx)
}

/** Localize a possibly-tagged LocaleString label to a plain display string. */
function labelString(value: unknown, locale: string): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') {
    const bag = value as Record<string, string>
    return bag[locale] ?? bag['en'] ?? Object.values(bag)[0] ?? ''
  }
  return String(value)
}

/** Whether a raw cell value is numeric (a real number, or an all-digit numeric string). */
function isNumericValue(v: DimVal): boolean {
  if (typeof v === 'number') return true
  return typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))
}

// ── buildStepInputOffer — the offer over a step's input rows ───────────────────────
export function buildStepInputOffer(args: {
  rows:         readonly EngineRow[]
  columnLabel:  ColumnLabelResolver
  cellLabel:    MemberLabelResolver
  /** Fields the author plane hides (measure / obsStatus) — excluded from the offer so
   *  the offered columns match exactly what the grid shows the author. */
  hiddenFields?: ReadonlySet<string>
  locale:       string
}): StepInputOffer {
  const { rows, columnLabel, cellLabel, hiddenFields, locale } = args
  const fields = deriveColumns(rows).filter((f) => !(hiddenFields?.has(f)))

  // Per field: distinct offered values (code → offer, first-seen, capped) + numeric flag.
  const distinct = new Map<string, Map<string, ValueOffer>>()
  const numeric  = new Map<string, boolean>(fields.map((f) => [f, true]))

  for (const row of rows) {
    for (const f of fields) {
      const v = row[f]
      if (v === null || v === undefined || v === '') continue
      if (numeric.get(f) && !isNumericValue(v as DimVal)) numeric.set(f, false)
      let members = distinct.get(f)
      if (!members) { members = new Map(); distinct.set(f, members) }
      const key = String(v)
      if (!members.has(key) && members.size < DISTINCT_CAP) {
        members.set(key, { value: v as DimVal, label: labelString(cellLabel(f, v as DimVal), locale) })
      }
    }
  }

  const columns: ColumnOffer[] = fields.map((f) => ({
    field:   f,
    label:   columnLabel(f),
    numeric: numeric.get(f) ?? false,
  }))

  return {
    columns,
    isNumeric: (f) => numeric.get(f) ?? false,
    valuesFor: (f) => {
      const members = distinct.get(f)
      if (!members) return []
      return [...members.values()].sort((a, b) =>
        labelString(a.label, locale).localeCompare(labelString(b.label, locale), locale))
    },
  }
}
