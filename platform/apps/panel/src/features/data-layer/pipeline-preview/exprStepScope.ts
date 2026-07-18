// ── exprStepScope — the expr-role SCOPE + live preview for a pipeline step (card 0087) ─
//
//  The P-OFFER EXPR/TEMPLATE first-class mandate (owner 2026-07-18): an expr-role field
//  (derive's `expr`, a template string) projects the schema-aware expr editor with its
//  autocomplete scope EXTENDED by the step's INPUT COLUMNS, and a LIVE per-row preview of
//  the computed value — the Power-Query Custom-Column / Retool `{{ }}` moment (Law 4).
//
//  ONE evaluator, ONE scope SSOT (FF-EXPR-SCOPE-SSOT): both the offered scope AND the
//  preview derive from the SAME `StepInputOffer` — the offered identifiers are exactly the
//  input columns, and a bare identifier in a derive/template formula resolves to that row's
//  field (`applyStep` → `@statdash/expr`). So what the editor OFFERS equals what the
//  evaluator RESOLVES, by construction — never a parallel hand-list, never a second
//  interpretation. Pure + framework-free (offer in → suggestions/preview out).
//
import type { EngineRow, TransformStep } from '@statdash/engine'
import { applyStep } from '@statdash/engine'
import type { BindSuggestion } from '../../../inspector/controls/binding/bindSuggestions'
import { operatorSuggestions } from '../../../inspector/controls/binding/bindSuggestions'
import type { ColumnOffer } from './stepInput'
import type { Locale } from '../../../types/constructor'

/**
 * The offered expr scope for a step = its INPUT COLUMNS (each inserted as the bare
 * identifier the evaluator reads from `row[field]`) + the formula operators. Derived from
 * the SAME `ColumnOffer[]` the preview evaluates against — so the offer EQUALS what
 * `applyStep` resolves (FF-EXPR-SCOPE-SSOT). The author sees the governed column label; the
 * inserted token is the raw field key (the resolvable identifier).
 */
export function exprScopeSuggestions(columns: readonly ColumnOffer[], locale: Locale): BindSuggestion[] {
  const en = locale === 'en'
  const cols: BindSuggestion[] = columns.map((c) => ({
    kind:   'var',
    insert: c.field,
    label:  c.label && c.label !== c.field ? `${c.field} · ${c.label}` : c.field,
    detail: en ? 'column' : 'სვეტი',
  }))
  return [...cols, ...operatorSuggestions(locale)]
}

/** One row of the live preview: the input row + the value the step produced for it. */
export interface PreviewRow {
  input: EngineRow
  value: unknown
}

/** The preview of applying the CURRENT step over the sample rows: the produced column per
 *  row, OR a friendly error (never a raw parse trace surfaced to the author plane). */
export interface StepPreview {
  rows:   PreviewRow[]
  /** A friendly, bilingual error when the step could not be applied (bad formula). */
  error?: string
}

/**
 * Run the CURRENT step over its sample INPUT rows through the ONE engine evaluator
 * (`applyStep` — the exact runtime path, never a second interpretation) and read the
 * produced column (`target` = the step's `as`/`name`). Errors (a malformed formula) are
 * captured and returned friendly, so a mid-edit expr never throws into the author plane
 * (Postel's Law + Law 11). Bounded: the caller passes an already-capped sample.
 */
export function previewStep(
  step:       TransformStep,
  target:     string,
  sampleRows: readonly EngineRow[],
  locale:     Locale = 'ka',
): StepPreview {
  if (!target || sampleRows.length === 0) return { rows: [] }
  try {
    const out = applyStep(sampleRows as EngineRow[], step)
    return { rows: out.map((r, i) => ({ input: sampleRows[i], value: (r as EngineRow)[target] })) }
  } catch {
    return {
      rows:  [],
      error: locale === 'en' ? 'The formula could not be evaluated' : 'ფორმულა ვერ გამოითვალა',
    }
  }
}
