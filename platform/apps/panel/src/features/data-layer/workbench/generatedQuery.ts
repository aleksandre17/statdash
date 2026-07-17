// ── generatedQuery — the pure model behind the GENERATED-QUERY pane (E4) ──────────
//
//  W-P2 (ADR-046 · SPEC §3.3 / §9 E4). The right pane of the three-pane workbench is
//  the "resulting query visible" want AND the per-element EXPLAIN/lineage seam (E4):
//  the pipe read top-to-bottom IS the lineage. This module is its PURE, framework-free
//  core — a `QuerySpec` in, a declarative rendering out — so the plane split (author vs
//  steward) and the governed-vs-raw invariant are trivially testable.
//
//  TWO projections over ONE spec (the plane law, ADR-041 §PLANE / SPEC §3.4):
//    • AUTHOR — `describeAuthorSteps`: a friendly, GOVERNED, bilingual rendering. Every
//      noun is resolved through the SAME governed catalog resolver the live grid speaks
//      (`ColumnLabelResolver`) — a metric-id becomes its governed label, a dim code its
//      governed label. It NEVER touches `queryReadObs` (the lowered wire query), so by
//      construction it cannot leak a raw SDMX code (FF-AUTHOR-NO-QUERY).
//    • STEWARD — `describeStewardDetail`: the raw DataSpec JSON + the lowered ObsQuery
//      (the wire truth) — the steward-only advanced door (progressive disclosure).
//
import type { DataSpec, ObsQuery, TransformStep } from '@statdash/engine'
import { queryReadObs } from '@statdash/engine'
import type { ColumnLabelResolver } from '../pipeline-preview/columnLabels'
import type { Locale } from '../../../types/constructor'

type QuerySpec = Extract<DataSpec, { type: 'query' }>

// ── The friendly verb label per op (author-readable, bilingual) ─────────────────
//
//  The generated-query pane shows a READABLE verb, never the raw op tag (E4: a
//  "friendly declarative rendering"). This is a LOCAL display map, NOT the W-P3
//  category projection over the op registry (that goes live in W-P3, driven from the
//  engine SSOT). Fallback = the op name itself (honest — the true op, never a blank).
const VERB_LABELS: Record<string, { ka: string; en: string }> = {
  source:    { ka: 'წყარო',        en: 'Get' },
  filter:    { ka: 'ფილტრი',       en: 'Filter' },
  aggregate: { ka: 'აგრეგაცია',    en: 'Aggregate' },
  reduce:    { ka: 'აგრეგაცია',    en: 'Aggregate' },
  rollup:    { ka: 'აგრეგაცია',    en: 'Aggregate' },
  group:     { ka: 'დაჯგუფება',    en: 'Group' },
  derive:    { ka: 'გამოთვლა',     en: 'Derive' },
  addField:  { ka: 'გამოთვლა',     en: 'Derive' },
  template:  { ka: 'გამოთვლა',     en: 'Derive' },
  concat:    { ka: 'გამოთვლა',     en: 'Derive' },
  cast:      { ka: 'გამოთვლა',     en: 'Derive' },
  window:    { ka: 'გამოთვლა',     en: 'Derive' },
  melt:      { ka: 'გარდაქმნა',    en: 'Reshape' },
  pivot:     { ka: 'გარდაქმნა',    en: 'Reshape' },
  select:    { ka: 'სვეტების არჩევა', en: 'Select columns' },
  rename:    { ka: 'გადარქმევა',   en: 'Rename' },
  lookup:    { ka: 'შერწყმა',      en: 'Combine' },
  join:      { ka: 'შერწყმა',      en: 'Combine' },
  blend:     { ka: 'შერწყმა',      en: 'Combine' },
  sort:      { ka: 'დახარისხება',  en: 'Sort' },
}

function verbLabel(op: string, locale: Locale): string {
  const v = VERB_LABELS[op]
  return v ? (v[locale] ?? v.en) : op
}

// The governed-noun extraction speaks only FIELD NAMES, never member VALUES — so a
// filter's raw member code (e.g. a region code) is NEVER surfaced in the author plane
// (that is the lowered-query/steward concern). Two shapes carry field names across the
// real op registry (see `defaultStep`): params whose VALUE is a field name / list, and
// params that are a RECORD KEYED BY field name (filter's `where`, rename/cast's `fields`).
// Law 1: no dim is special-cased; every field name resolves generically through the catalog.
//
//  string / string[] field-name params (sort.by · reduce.field · rollup.dim ·
//  window.over · join.on · lookup.key · aggregate.groupBy · melt.id/valueFields ·
//  derive/addField/template/concat produced `as`/`name`).
const FIELD_VALUE_KEYS = ['by', 'field', 'dim', 'over', 'on', 'key', 'groupBy', 'idFields', 'valueFields', 'as', 'name'] as const
//  record-keyed-by-field params (filter.where — the KEYS are the pinned dims).
const FIELD_RECORD_KEYS = ['where'] as const

/** Normalize an ObsQuery.measure (string | string[]) to a list. */
function readMeasures(measure: ObsQuery['measure']): string[] {
  return Array.isArray(measure) ? measure : measure ? [measure] : []
}

/** The governed dimension nouns the Get read spans — the pinned filter dims. Values
 *  are member codes (never shown); the KEYS are the dims, resolved to governed labels. */
function grainDims(query: ObsQuery): string[] {
  const filter = (query.filter ?? {}) as Record<string, unknown>
  return Object.keys(filter)
}

/** The governed field nouns a tail step consumes/produces — pulled from its field-name
 *  params + record-keyed field maps only (never member values), each resolved to a
 *  governed label. Deduped, ordered. */
function stepFieldNouns(step: TransformStep, resolve: ColumnLabelResolver): string[] {
  const rec = step as unknown as Record<string, unknown>
  const raw: string[] = []
  const pushStr = (v: unknown) => { if (typeof v === 'string' && v.length > 0) raw.push(v) }

  // string / string[] field-name params
  for (const key of FIELD_VALUE_KEYS) {
    const v = rec[key]
    if (Array.isArray(v)) v.forEach(pushStr)
    else pushStr(v)
  }
  // record-keyed-by-field params — the KEYS are the fields (values are member codes, skipped)
  for (const key of FIELD_RECORD_KEYS) {
    const v = rec[key]
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.keys(v).forEach(pushStr)
  }
  // `fields` — array of field names (select/concat/lookup) OR a record keyed by field (rename/cast)
  const fields = rec['fields']
  if (Array.isArray(fields)) fields.forEach(pushStr)
  else if (fields && typeof fields === 'object') Object.keys(fields).forEach(pushStr)

  const seen = new Set<string>()
  const out: string[] = []
  for (const name of raw) {
    const label = resolve(name)
    if (!seen.has(label)) { seen.add(label); out.push(label) }
  }
  return out
}

/** ONE author-plane step in the declarative rendering — a friendly verb + the
 *  governed nouns it consumes/produces. All strings are governed labels (never raw). */
export interface AuthorStep {
  /** The raw op (stable key; also the steward's concrete-op detail). */
  op:    string
  /** The friendly bilingual verb label the author reads. */
  verb:  string
  /** The governed nouns this step consumes (already governed labels — never raw codes). */
  nouns: string[]
}

/**
 * The GOVERNED, bilingual declarative rendering of a query pipeline (the author plane).
 * The head is the Get read (metric + grain dims); each tail step is its friendly verb +
 * the governed field nouns it touches. Resolves every noun through `resolve` (the same
 * governed catalog the live grid speaks) — so it structurally cannot show a raw code.
 */
export function describeAuthorSteps(
  spec:    QuerySpec,
  resolve: ColumnLabelResolver,
  locale:  Locale,
): AuthorStep[] {
  const en = locale === 'en'
  const out: AuthorStep[] = []

  // ── Head: the Get read ────────────────────────────────────────────────────────
  const measures = readMeasures(spec.query.measure)
  // The bound metric's governed label = the value column's governed header (the SAME
  // resolution the grid uses: `resolve('value')`), never the raw metric-id string.
  const metricLabel = measures.length > 0 ? resolve('value') : ''
  const getVerb = measures.length === 0
    ? (en ? 'Get: (pick a metric)' : 'წყარო: (აირჩიეთ მეტრიკა)')
    : (en ? `Get: ${metricLabel}` : `წყარო: ${metricLabel}`)
  out.push({ op: 'source', verb: getVerb, nouns: grainDims(spec.query).map(resolve) })

  // ── Tail: the pure transform verbs ────────────────────────────────────────────
  for (const step of spec.pipe ?? []) {
    out.push({ op: step.op, verb: verbLabel(step.op, locale), nouns: stepFieldNouns(step, resolve) })
  }
  return out
}

/** The steward-only wire truth: the raw DataSpec + the lowered ObsQuery. */
export interface StewardDetail {
  /** The raw DataSpec, pretty-printed (the steward-advanced JSON door). */
  json:     string
  /** The lowered ObsQuery — the wire query the Get read resolves to (SDMX-grade). */
  obsQuery: string
}

/**
 * The steward-plane detail: the raw DataSpec JSON + the lowered ObsQuery (the wire
 * truth behind the governed rendering). `queryReadObs` is the SAME lowering the live
 * source read uses (`usePipelineSourceRows`) — the pane shows exactly what hits the store.
 */
export function describeStewardDetail(spec: QuerySpec): StewardDetail {
  // Fail-soft: lowering an unregistered/half-authored metric-id must never throw the
  // pane (the same fail-soft discipline the live grid holds — Law 11). A failed lower
  // shows an honest note, not a crash.
  let obsQuery: string
  try {
    obsQuery = JSON.stringify(queryReadObs(spec.query), null, 2)
  } catch {
    obsQuery = '// query could not be lowered (unresolved reference)'
  }
  return { json: JSON.stringify(spec, null, 2), obsQuery }
}
