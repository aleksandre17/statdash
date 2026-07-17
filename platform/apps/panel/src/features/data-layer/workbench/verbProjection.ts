// ── verbPalette — the 7-verb palette, a PROJECTION of the op-registry categories ──
//
//  W-P3 (ADR-046 · SPEC §1.2). The author never faces the ~19 concrete ops. They see
//  SEVEN intent-verbs (Get/Filter/Aggregate/Derive/Reshape/Combine/Sort). This module
//  is the PURE model behind the "+add step" palette: it PROJECTS the registry's
//  `category` declarations (the engine SSOT — `STEP_CATEGORIES` + `getOpsInCategory`)
//  into palette entries. It is NOT a hand-list — a newly-registered op appears in its
//  verb with zero panel code, and a verb with no backing op yet (`get`, until W-P4
//  registers `source`) is HONESTLY non-insertable (SPEC Refusal #7, the projection ideal).
//
//  The only panel-owned data here is author-facing DISPLAY chrome: the bilingual verb
//  labels/hints (a bounded map keyed by the 7-verb union — matches the type exactly, so
//  a widened union is a compile error) and the concrete-op display names for progressive
//  disclosure. The GROUPING (which ops back which verb) is the registry's, never ours.
//
import { STEP_CATEGORIES, getOpsInCategory, getTransformStepCategory } from '@statdash/engine'
import type { StepCategory } from '@statdash/engine'
import type { Locale } from '../../../types/constructor'

/** A bilingual display pair. */
interface Bi { ka: string; en: string }

/** Author-facing chrome for one verb + the op it inserts by default (SPEC §1.2:
 *  "Aggregate defaults to aggregate", etc.). The concrete op is a progressive-
 *  disclosure detail INSIDE the verb; picking the verb inserts `defaultOp`. */
interface VerbDisplay {
  label:     Bi
  hint:      Bi
  /** The op inserted when the verb is picked without drilling in. Empty ⇒ the verb
   *  has no insertable op yet (the `get` head — the source read, W-P4). */
  defaultOp: string
}

// Keyed by the 7-verb union — a missing/extra key is a compile error, so the display
// map can never drift out of sync with `StepCategory`. The LABEL is the SPEC §1.2
// author-facing verb name (the SSOT vocabulary); the HINT carries the plain-language
// intent ("simple words"). Bilingual.
const VERB_DISPLAY: Record<StepCategory, VerbDisplay> = {
  get:       { label: { ka: 'წყარო',       en: 'Get' },       hint: { ka: 'რა მონაცემი',                    en: 'what data' },                    defaultOp: '' },
  filter:    { label: { ka: 'ფილტრი',      en: 'Filter' },    hint: { ka: 'დატოვე მხოლოდ საჭირო სტრიქონები', en: 'keep only the rows you need' },  defaultOp: 'filter' },
  aggregate: { label: { ka: 'აგრეგაცია',   en: 'Aggregate' }, hint: { ka: 'დააჯგუფე და შეაჯამე',            en: 'group & summarize' },            defaultOp: 'aggregate' },
  derive:    { label: { ka: 'გამოთვლა',    en: 'Derive' },    hint: { ka: 'დაამატე გამოთვლილი ველი',        en: 'add a calculated field' },       defaultOp: 'derive' },
  reshape:   { label: { ka: 'გარდაქმნა',   en: 'Reshape' },   hint: { ka: 'აირჩიე ან გადააწყვე სვეტები',     en: 'pick or reshape columns' },      defaultOp: 'select' },
  combine:   { label: { ka: 'შერწყმა',     en: 'Combine' },   hint: { ka: 'დაურთე სხვა წყარო',              en: 'bring in another source' },      defaultOp: 'lookup' },
  sort:      { label: { ka: 'დახარისხება', en: 'Sort' },      hint: { ka: 'დაალაგე სტრიქონები',             en: 'order the rows' },               defaultOp: 'sort' },
}

// Concrete-op display names for the progressive-disclosure list (a verb with >1 op).
// Author-facing leaf chrome; an op absent here falls back to its bare op code (honest).
const OP_LABELS: Record<string, Bi> = {
  filter:    { ka: 'ფილტრი',              en: 'Filter' },
  aggregate: { ka: 'აგრეგაცია',           en: 'Aggregate' },
  group:     { ka: 'დაჯგუფება',           en: 'Group' },
  reduce:    { ka: 'შემცირება (ჯამი/საშ.)', en: 'Reduce (sum/avg)' },
  rollup:    { ka: 'აკეცვა განზომილებაზე', en: 'Roll up a dimension' },
  derive:    { ka: 'ფორმულა',             en: 'Formula' },
  addField:  { ka: 'ველის დამატება',      en: 'Add a field' },
  template:  { ka: 'ტექსტის შაბლონი',     en: 'Text template' },
  concat:    { ka: 'ველების შეერთება',    en: 'Join fields' },
  cast:      { ka: 'ტიპის შეცვლა',        en: 'Change type' },
  window:    { ka: 'მცოცავი/შედარებითი',  en: 'Running / relative' },
  melt:      { ka: 'ფართო→გრძელი',        en: 'Wide → long' },
  select:    { ka: 'სვეტების არჩევა',     en: 'Pick columns' },
  rename:    { ka: 'გადარქმევა',          en: 'Rename' },
  lookup:    { ka: 'მოძებნა',             en: 'Look up' },
  join:      { ka: 'შეერთება',            en: 'Join' },
  blend:     { ka: 'შერწყმა',             en: 'Blend' },
  sort:      { ka: 'დახარისხება',         en: 'Sort' },
}

function bi(pair: Bi, locale: Locale): string {
  return locale === 'en' ? pair.en : pair.ka
}

/** One entry in the palette — a verb + its concrete ops (projected) + insert default. */
export interface VerbEntry {
  category:  StepCategory
  label:     string
  hint:      string
  /** The concrete ops backing this verb, in registry order (the projection). */
  ops:       { op: string; label: string }[]
  /** The op inserted when the verb card is picked directly. Empty ⇒ non-insertable. */
  defaultOp: string
  /** False when no op backs this verb yet (the `get` head until W-P4) — the card
   *  renders honestly disabled (the source is already the pipeline's first step). */
  insertable: boolean
}

/**
 * Build the 7-verb palette for `locale` — the projection of the op registry's
 * `category` field. Iterates the canonical `STEP_CATEGORIES` order (Get first); each
 * verb's ops are `getOpsInCategory(verb)` (the SSOT). `joinByField` is EXCLUDED from
 * the author palette (it carries already-resolved rows — not declaratively authorable,
 * mirroring PipelineBuilder's exclusion), but it stays categorized in the engine.
 */
export function buildVerbPalette(locale: Locale): VerbEntry[] {
  const NON_AUTHORABLE = new Set(['joinByField'])
  return STEP_CATEGORIES.map((category) => {
    const display = VERB_DISPLAY[category]
    const ops = getOpsInCategory(category)
      .filter((op) => !NON_AUTHORABLE.has(op))
      .map((op) => ({ op, label: OP_LABELS[op] ? bi(OP_LABELS[op], locale) : op }))
    // Prefer the SPEC default op; fall back to the first projected op if absent.
    const defaultOp = ops.some((o) => o.op === display.defaultOp)
      ? display.defaultOp
      : (ops[0]?.op ?? '')
    return {
      category,
      label:      bi(display.label, locale),
      hint:       bi(display.hint, locale),
      ops,
      defaultOp,
      insertable: ops.length > 0,
    }
  })
}

/**
 * The author-facing VERB label an op projects into — the SSOT-driven replacement for
 * the old hand `VERB_LABELS` map (W-P2 pre-note #2). An op's verb is DERIVED from its
 * registry `category`, never hand-listed: `op → getTransformStepCategory(op) → the
 * verb's display label`. The head `source` op (W-P4) and any un-categorized op fall
 * back to the bare op code (honest — the true op, never a blank).
 */
export function verbLabelForOp(op: string, locale: Locale): string {
  const category = getTransformStepCategory(op)
  return category ? bi(VERB_DISPLAY[category].label, locale) : op
}
