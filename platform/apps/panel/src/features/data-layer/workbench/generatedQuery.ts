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
//    • STEWARD — `describeStewardDetail`: the STORED artifact's byte-true JSON (never the
//      lowered assembly posing as it, card 0112 §R4 dialect-honesty fix) + the labeled
//      canonical assembly + the lowered ObsQuery (the wire truth) — the steward-only
//      advanced door (progressive disclosure).
//
import type { DataSpec, SourceStep, TransformStep, PropField } from '@statdash/engine'
import { sourceHeadObs, getTransformStepSchema } from '@statdash/engine'
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

/** Normalize a measure ref (string | string[]) to a list. */
function readMeasures(measure: string | string[] | undefined): string[] {
  return Array.isArray(measure) ? measure : measure ? [measure] : []
}

// The governed-noun extraction speaks only FIELD NAMES, never member VALUES — so a
// filter's raw member code (e.g. a region code) is NEVER surfaced in the author plane.
// It is now DERIVED FROM THE SCHEMA ROLES (card 0087 — killing the FIELD_VALUE_KEYS /
// FIELD_RECORD_KEYS hand-maps): a field declared role `field` carries an input column
// (string → the column; string[] → the columns; object map → its KEYS), and role
// `newName` carries a produced identifier. `member` (values) / `expr` / `literal` are
// NOT nouns. Law 1: no dim is special-cased — a new op's nouns fall out of its declared
// roles with zero change here.
function pushRoleNouns(role: PropField['role'], value: unknown, out: string[]): void {
  const pushStr = (v: unknown) => { if (typeof v === 'string' && v.length > 0) out.push(v) }
  if (role !== 'field' && role !== 'newName') return
  if (Array.isArray(value)) value.forEach(pushStr)
  else if (role === 'field' && value && typeof value === 'object') Object.keys(value).forEach(pushStr)
  else pushStr(value)
}

/** The governed field nouns a tail step consumes/produces — derived from the op's schema
 *  roles (field / newName only; never member values), each resolved to a governed label.
 *  Deduped, ordered. A schema-less op contributes no nouns (honest). */
function stepFieldNouns(step: TransformStep, resolve: ColumnLabelResolver): string[] {
  const rec = step as unknown as Record<string, unknown>
  const schema = (getTransformStepSchema(step.op) ?? []) as PropField[]
  const raw: string[] = []
  for (const f of schema) pushRoleNouns(f.role, rec[f.field], raw)

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

/**
 * The steward-only wire truth (card 0112 §R4 — the dialect-honesty fix, D5). TWO
 * serializations, each HONESTLY labeled — never the assembly presented AS the artifact:
 *   • `storedJson`    — the artifact AS PERSISTED, byte-true (a legacy `query`'s own
 *                        fields verbatim — never the lowered pipeline standing in for it).
 *   • `canonicalJson` — the engine `desugarToPipeline` assembly, a declared PROJECTION.
 * `dialect` names both discriminants so the pane can decide whether to show one block
 * (they coincide — a stored `pipeline`) or two (they diverge — a stored `query`).
 */
export interface StewardDetail {
  /** The STORED artifact's own serialization, pretty-printed — byte-true (never
   *  reconstructed via `fromWorkbenchModel`). Absent `model.storedSpec` (an ad-hoc/
   *  from-scratch model) falls back to the model's own pipeline emission — the two
   *  dialects then trivially coincide. */
  storedJson:    string
  /** The lowered PIPELINE assembly (`fromWorkbenchModel`), pretty-printed — ALWAYS a
   *  declared projection, labeled "lowered — engine desugarToPipeline" by the pane,
   *  never shown as if it were the stored artifact. */
  canonicalJson: string
  /** The two discriminants at the seam (Law 11: declare the dialect, never hide it). */
  dialect: { stored: DataSpec['type']; shown: DataSpec['type'] }
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
 * The steward-plane detail (card 0112 §R4 kill-design, D5): the STORED artifact's own
 * byte-true JSON + the labeled `desugarToPipeline` assembly + the lowered head ObsQuery.
 * The ObsQuery comes from the ONE engine SSOT `sourceHeadObs(head)` — the EXACT obs
 * read/warm the live source read & useNodeRows align to — so the pane shows precisely
 * what the head issues to the store (assert-equal, not resemble). When there is no single
 * ObsQuery (grained governed / inline / unbound), a DECLARED bilingual note stands in its
 * place — never an empty, height-less void (Law 11).
 *
 * `storedJson` NEVER re-derives from `head`/`tail`/`encoding` (that would silently drop a
 * legacy `query`'s own fields — fromDim/toDim/timeDimension/rowLimit — reproducing the R4
 * lie one layer down). It serializes `model.storedSpec` verbatim — the artifact exactly as
 * persisted. `canonicalJson` is the SAME `fromWorkbenchModel` assembly the emission flip
 * writes on edit — always present, always labeled a projection by the pane, never the
 * artifact itself.
 */
export function describeStewardDetail(model: WorkbenchModel, locale: Locale): StewardDetail {
  const canonical = fromWorkbenchModel(model)
  // No prior persisted spec (ad-hoc/from-scratch model) ⇒ there is nothing to diverge FROM;
  // the model's own pipeline emission stands in for "the stored artifact" — dialects coincide.
  const stored = model.storedSpec ?? canonical
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
  return {
    storedJson:    JSON.stringify(stored, null, 2),
    canonicalJson: JSON.stringify(canonical, null, 2),
    dialect:       { stored: stored.type, shown: canonical.type },
    obsQuery,
  }
}
