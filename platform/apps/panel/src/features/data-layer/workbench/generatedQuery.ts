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
import type { SourceStep, TransformStep } from '@statdash/engine'
import { sourceHeadObs } from '@statdash/engine'
import type { ColumnLabelResolver } from '../pipeline-preview/columnLabels'
import type { Locale } from '../../../types/constructor'
import { verbLabelForOp } from './verbProjection'
import { fromWorkbenchModel, isHeadBound, sourceGrainDims, sourceMeasure, type WorkbenchModel } from './workbenchModel'

// ── The friendly verb label per op — a PROJECTION of the registry `category` ─────
//
//  The generated-query pane shows a READABLE verb, never the raw op tag (E4: a
//  "friendly declarative rendering"). W-P3 (pre-note #2): this is no longer a local
//  hand map — the verb is DERIVED from the op's registry `category` (the SSOT) via
//  `verbLabelForOp`, so the pane's verbs and the "+add step" palette speak the SAME
//  seven verbs by construction. Fallback = the op name itself (honest, never a blank).

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

/** Normalize a measure ref (string | string[]) to a list. */
function readMeasures(measure: string | string[] | undefined): string[] {
  return Array.isArray(measure) ? measure : measure ? [measure] : []
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
 * The GOVERNED, bilingual declarative rendering of a PIPELINE (the author plane). The
 * head is the Get read (the source metric + its governed grain dims); each tail step is
 * its friendly verb + the governed field nouns it touches. Resolves every noun through
 * `resolve` (the same governed catalog the live grid speaks) — so it structurally cannot
 * show a raw code (FF-AUTHOR-NO-QUERY). Spine-agnostic: reads the canonical WorkbenchModel,
 * so a legacy `query` (via its desugared view) and a native `pipeline` render identically.
 */
export function describeAuthorSteps(
  model:   WorkbenchModel,
  resolve: ColumnLabelResolver,
  locale:  Locale,
): AuthorStep[] {
  const en = locale === 'en'
  const out: AuthorStep[] = []

  const measures = readMeasures(sourceMeasure(model.head))
  const tail = model.tail

  // No metric bound AND no steps → there is no pipeline to describe yet. Return an EMPTY
  // rendering (the pane shows an honest "bind a metric" hint) rather than a vestigial
  // "Get: (pick a metric)" one-liner floating with nothing under it (SPEC §9 / Law 11).
  if (measures.length === 0 && tail.length === 0) return out

  // ── Head: the Get read — the metric + the governed grain nouns (year, pinned dims) ──
  // The bound metric's governed label = the value column's governed header (the SAME
  // resolution the grid uses: `resolve('value')`), never the raw metric-id string.
  const metricLabel = measures.length > 0 ? resolve('value') : ''
  const getVerb = measures.length === 0
    ? (en ? 'Get: (pick a metric)' : 'წყარო: (აირჩიეთ მეტრიკა)')
    : (en ? `Get: ${metricLabel}` : `წყარო: ${metricLabel}`)
  out.push({ op: 'source', verb: getVerb, nouns: sourceGrainDims(model.head).map(resolve) })

  // ── Tail: the pure transform verbs ────────────────────────────────────────────
  for (const step of tail) {
    out.push({ op: step.op, verb: verbLabelForOp(step.op, locale), nouns: stepFieldNouns(step, resolve) })
  }
  return out
}

/** The steward-only wire truth: the raw pipeline DataSpec + the lowered head ObsQuery. */
export interface StewardDetail {
  /** The raw DataSpec (the emitted `pipeline`), pretty-printed (the steward JSON door). */
  json:     string
  /** The lowered ObsQuery — the wire read the Get head issues to the store, derived from
   *  the engine SSOT `sourceHeadObs` (never a pane-local re-lowering, FF-ONE-DERIVATION-
   *  PATH). A steward `query` head → its ObsQuery verbatim; a grain-∅ governed head → the
   *  resolved `{ measure }` browse read; a grained governed / inline / unbound head has no
   *  single ObsQuery → a DECLARED honest note (never an empty void, Law 11). */
  obsQuery: string
}

/**
 * The DECLARED wire note for a head whose obs read is not a single ObsQuery (`sourceHeadObs`
 * returns `undefined`): unbound / inline / grained-governed. NEVER an empty string — Law 11
 * in our own instrument (the pane must always answer "what is asked of the store?"). Bilingual.
 */
function stewardHeadNote(head: SourceStep, locale: Locale): string {
  const en = locale === 'en'
  // Unbound FIRST — a `metrics: []` head is `'metrics' in head` yet reads nothing.
  if (!isHeadBound(head)) {
    return en ? 'Bind a metric — the query will appear here' : 'მიაბი მეტრიკა — მოთხოვნა აქ გამოჩნდება'
  }
  if ('rows' in head) {
    return en ? 'No wire query (inline rows)' : 'wire-მოთხოვნა არ არის (inline rows)'
  }
  // A GRAINED governed head — the shaped M2 read, warmed per requirement through the metric
  // resolver's grain algebra (sourceHeadObs returns undefined BY DESIGN for this form).
  return en
    ? 'Governed source — lowered through the metric resolver (grain algebra)'
    : 'მართული წყარო — იტანება მეტრიკის რეზოლვერით (გრეინ-ალგებრა)'
}

/**
 * The steward-plane detail: the raw `pipeline` JSON + the lowered head ObsQuery (the wire
 * truth behind the governed rendering). The ObsQuery comes from the ONE engine SSOT
 * `sourceHeadObs(head)` — the EXACT obs read/warm the live source read & useNodeRows align
 * to — so the pane shows precisely what the head issues to the store (assert-equal, not
 * resemble). When there is no single ObsQuery (grained governed / inline / unbound), a
 * DECLARED bilingual note stands in its place — never an empty, height-less void (Law 11).
 */
export function describeStewardDetail(model: WorkbenchModel, locale: Locale): StewardDetail {
  const spec = fromWorkbenchModel(model)
  const head = model.head
  // An UNBOUND governed head (`metrics: []`) still yields a degenerate `{ measure: [] }`
  // from sourceHeadObs — a read of nothing. That is not the wire truth an author wants to
  // see; it is the affordance to bind. So the DECLARED note wins for an unbound head, and
  // the SSOT ObsQuery is shown only for a genuinely-bound read (steward query / grain-∅
  // governed browse) — the EQUALITY fitness holds for exactly those bound-read forms.
  const obs = isHeadBound(head) ? sourceHeadObs(head) : undefined
  const obsQuery = obs !== undefined
    ? JSON.stringify(obs, null, 2)          // steward query verbatim OR grain-∅ governed { measure }
    : stewardHeadNote(head, locale)         // no single read ⇒ a declared honest note (never a void)
  return { json: JSON.stringify(spec, null, 2), obsQuery }
}
